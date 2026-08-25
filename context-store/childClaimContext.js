import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { signInAnonymously } from '@react-native-firebase/auth';
import { useKeysContext } from './keys';
import isValidMnemonic from '../app/functions/isValidMnemonic';
import {
  computeSAS,
  decryptSeedPayload,
  deriveSeedKey,
  deriveSharedX,
  makeChildEphKey,
  normalizePairingName,
  verifyKeyCommitment,
} from '../app/functions/accounts/childPairing';
import {
  cancelPairingSession,
  claimPairingSession,
  deletePairingHandshake,
  setPairingDoc,
  subscribePairingDoc,
  subscribePairingSession,
} from '../db';
import { firebaseAuth } from '../db/initializeFirebase';
import { setLocalStorageItem } from '../app/functions/localStorage';
import { PENDING_PARENT_CONTACT_KEY } from '../app/constants';

// Per-state server deadline (rules: request.time < stateTs + 3m). Only used to
// anchor the passive expiry fallback below; never gates a transition.
const PAIRING_STATE_TTL_MS = 180000;
// The passive expiry fallback actively cancels the session and deletes our
// handshake docs once the deadline has clearly passed. The deadline is
// anchored at the snapshot's arrival (startedAt) and elapsed with the device
// clock, so absolute device/server clock skew cancels out; the small slack
// only covers snapshot delivery latency and timer jitter.
const PAIRING_EXPIRY_SLACK_MS = 10 * 1000;

// Shared session for the child-side claim handshake. Owns the live Firestore
// listeners (session doc + handshake docs), the ephemeral key + shared secret
// in memory, and teardown so the three claim screens can read/drive one session
// instead of each re-running it. This is the child mirror of
// childPairingContext.js: it reads the session doc DIRECTLY by the parent's
// secret 6-digit code (there is no public pointer), atomically claims the
// session (WAITING→JOINED), writes childHello, listens for the grant, and
// imports the seed. The child's terminal is a successful decrypt of the grant
// (a valid AES-GCM tag), never the session's COMPLETED marker (D5).
// Map the /childPairingClaim endpoint's error code to a user-facing copy key.
// A wrong code and an expired/gone session are indistinguishable to a guesser by
// design (both → wrongCode, the read oracle is closed); a live but already-
// claimed session → slotTaken; the rate limiter → its own "slow down" copy;
// everything else (transport failure / unexpected) → the generic restart copy.
function claimErrorCopy(error) {
  switch (error) {
    case 'not_found':
    case 'expired':
    case 'invalid_request':
      return 'settings.childAccounts.claim.wrongCode';
    case 'taken':
      return 'settings.childAccounts.claim.slotTaken';
    case 'rate_limited':
      return 'settings.childAccounts.claim.rateLimited';
    default:
      return 'settings.childAccounts.claim.askToRestart';
  }
}

const ChildClaimContext = createContext(null);

export function ChildClaimProvider({ children }) {
  const { t } = useTranslation();
  const { setAccountMnemonic } = useKeysContext();

  // status: idle | joining | confirm | awaiting | done | error | expired
  const [status, setStatus] = useState('idle');
  const [sas, setSas] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  // Server timestamp (anchor) + device arrival time (startedAt) of the current
  // session state (joinedAt / verifyingAt, from the session snapshot). Drives
  // the passive expiry fallback via elapsed time so device clock skew cancels
  // out; never gates a transition.
  const [pairingAnchor, setPairingAnchor] = useState(null);

  const statusRef = useRef('idle');
  const sessionRef = useRef(null);
  const sessionUnsubRef = useRef(null);
  const revealUnsubRef = useRef(null);
  const grantUnsubRef = useRef(null);
  // Generation counter for the async submitPairing race: bumped on every start /
  // reset / teardown so a submitPairing that survived a reset can detect it
  // (myGen !== genRef) and release the claimed server session instead of acting
  // on the new one. The parent side needs no counter — its session object always
  // exists before its awaits (identity check).
  const genRef = useRef(0);
  // Holds the backgrounded cancelPairingSession promise from the last decline so
  // a back-to-back re-pair can drain it before opening a new session (never
  // overlap the previous session's cleanup).
  const pendingDeclineRef = useRef(null);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Unsubscribe every live listener and drop the session (wiping key material)
  // without touching server state. Shared teardown for endSession/resetSession
  // and for the entry of submitPairing: a re-submit from any terminal state must
  // not leak the previous session's listeners (or its key material) onto the new
  // one.
  const teardownListeners = () => {
    if (sessionUnsubRef.current) {
      sessionUnsubRef.current();
      sessionUnsubRef.current = null;
    }
    if (revealUnsubRef.current) {
      revealUnsubRef.current();
      revealUnsubRef.current = null;
    }
    if (grantUnsubRef.current) {
      grantUnsubRef.current();
      grantUnsubRef.current = null;
    }
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session?.eph) session.eph = null;
  };

  // Tear down a live session and land on a terminal status, keeping the error
  // message (when provided) so the terminal screens can explain why the pairing
  // ended. Cancelling the session is best-effort (it may already be terminal);
  // our own handshake docs are deleted unless the seed already landed or the
  // session was declined (then the docs are left for the peer to read). Mirror
  // of the parent-side endSession in childPairingContext.js.
  const endSession = useCallback(
    (nextStatus, message = '', skipCancel = false) => {
      genRef.current += 1;
      const session = sessionRef.current;
      teardownListeners();
      if (session?.rid && session?.sessionId) {
        !skipCancel && cancelPairingSession(session.rid, session.sessionId);
        if (!session.imported && !session.declined) {
          deletePairingHandshake(session.rid, session.sessionId);
        }
      }
      setPairingAnchor(null);
      setSas('');
      setErrorMessage(message);
      setStatus(nextStatus);
    },
    [],
  );

  const resetSession = useCallback(async (nextStatus = 'idle') => {
    genRef.current += 1;
    const session = sessionRef.current;
    teardownListeners();
    // Local state clears synchronously — never gated on the server write below
    // (offline Firestore deletes can stay queued indefinitely) — so leaving a
    // failed pairing drops its terminal status/error at once instead of
    // rendering the stale copy until the write settles.
    setSas('');
    setErrorMessage('');
    setStatus(nextStatus);
    // A declined session leaves its docs (incl. the cancel signal) for the peer to
    // read; TTL cleans up. Otherwise tear our own handshake docs down unless the
    // seed already landed.
    if (
      session?.rid &&
      session?.sessionId &&
      !session?.imported &&
      !session?.declined
    ) {
      await deletePairingHandshake(session.rid, session.sessionId);
    }
  }, []);

  const importSeed = useCallback(
    async grant => {
      const session = sessionRef.current;
      if (!session || session.imported) return;
      try {
        const seedKey = deriveSeedKey(session.sharedX);
        const payload = decryptSeedPayload(seedKey, {
          iv: grant.iv,
          ct: grant.ciphertext,
          tag: grant.tag,
        }); // throws on tamper / wrong key

        if (payload.v !== 1) {
          throw new Error('Unsupported grant version');
        }

        const seed = String(payload.mnemonic || '').trim();
        if (!seed || !isValidMnemonic(seed.split(' '))) {
          throw new Error('Invalid seed payload');
        }
        session.imported = true;

        // No local child marker needed: the child's top-level user doc (created
        // by the parent at pairing) carries isChildAccount, so first-login init
        // learns it's a child straight from the doc.
        // Persist the parent's normalized username so globalContacts can
        // auto-add the parent as a non-deletable contact after home. Must land
        // BEFORE setAccountMnemonic: that drives the app into onboarding's
        // loadingScreen, whose wipe snapshots PRESERVED_KEYS (which includes
        // this key) around removeAllLocalData.
        await setLocalStorageItem(PENDING_PARENT_CONTACT_KEY, session.rid);
        setAccountMnemonic(seed);
        if (sessionUnsubRef.current) {
          sessionUnsubRef.current();
          sessionUnsubRef.current = null;
        }
        if (revealUnsubRef.current) {
          revealUnsubRef.current();
          revealUnsubRef.current = null;
        }
        if (grantUnsubRef.current) {
          grantUnsubRef.current();
          grantUnsubRef.current = null;
        }
        setPairingAnchor(null);
        await deletePairingHandshake(session.rid, session.sessionId);
        session.eph = null;
        setStatus('done');
      } catch (err) {
        console.log('child grant decrypt error', err);
        endSession('error', t('settings.childAccounts.claim.tamper'));
      }
    },
    [setAccountMnemonic, t],
  );

  const confirmMatch = useCallback(async () => {
    const session = sessionRef.current;
    if (!session?.sharedX) return;
    // Only the SAS-confirm screen may start the grant wait on the code path:
    // rejecting after the session already ended (or double-confirming) must be
    // a no-op, mirroring the parent-side guard. The QR path self-confirms from
    // the parentReveal listener (status is still 'joining' there) once the
    // reveal matches the scanned pubkey — the key-equality check IS the
    // confirmation.
    if (statusRef.current !== 'confirm' && !session.scannedParentPub) return;
    // Code path: the human has visually compared the SAS on both phones. QR
    // path: the reveal matched the pubkey from the trusted physical channel.
    // Either way, now wait for the parent to deliver the encrypted grant.
    setErrorMessage('');
    statusRef.current = 'awaiting';
    setStatus('awaiting');

    // Tell the parent we confirmed the match so it can deliver the grant and
    // advance — the mirror of the child waiting on the parent's grant doc. A
    // rules-denied write (deadline passed / session ended) is the real expiry
    // signal; no client timer decides it.
    const didConfirm = await setPairingDoc(
      session.rid,
      session.sessionId,
      'childConfirm',
      { v: 1 },
    );
    if (!didConfirm) {
      endSession('expired', t('settings.childAccounts.claim.expired'));
      return;
    }

    grantUnsubRef.current = subscribePairingDoc(
      session.rid,
      session.sessionId,
      'grant',
      grant => {
        if (grant?.ciphertext) importSeed(grant);
      },
    );
  }, [importSeed, t]);

  const submitPairing = useCallback(
    async ({ name, code, scannedParentPub }) => {
      const rid = normalizePairingName(name);
      const pairCode = String(code || '').trim();
      const badInput = !rid || !/^[0-9]{6}$/.test(pairCode);
      if (badInput || statusRef.current === 'joining') {
        if (badInput)
          setErrorMessage(t('settings.childAccounts.claim.wrongCode'));
        return;
      }
      // A re-submit from any terminal state must not leak the previous session's
      // listeners (or its key material) onto the new one.
      teardownListeners();
      setErrorMessage('');
      statusRef.current = 'joining';
      setStatus('joining');
      const myGen = (genRef.current += 1);
      if (pendingDeclineRef.current) {
        await pendingDeclineRef.current;
        pendingDeclineRef.current = null;
      }
      if (myGen !== genRef.current) return;

      try {
        if (!firebaseAuth.currentUser) {
          await signInAnonymously(firebaseAuth);
          if (myGen !== genRef.current) return;
        }

        // Discover + atomically claim through the rate-limited proxy endpoint.
        // The client can no longer read the session by code (get oracle closed)
        // or blind-claim it (client WAITING→JOINED deleted), so this single
        // admin-mediated call is the only claim path — and its per-IP + per-uid
        // limiters make a code scan infeasible. It returns the parent's commit
        // for the verifyKeyCommitment check on the reveal below.
        const claim = await claimPairingSession(rid, pairCode);
        if (myGen !== genRef.current) {
          cancelPairingSession(rid, pairCode);
          return;
        }
        if (!claim.ok) {
          setStatus('idle');
          setErrorMessage(t(claimErrorCopy(claim.error)));
          return;
        }

        // Commit-reveal: we reveal childEphPub now; the parent reveals its own
        // pubkey afterwards. Shared secret + SAS are only derived once the
        // revealed key matches the commitment, so a MITM can't grind keys.
        const eph = makeChildEphKey();

        sessionRef.current = {
          rid,
          sessionId: pairCode,
          eph,
          commit: claim.commit,
          // QR path only: the parent pubkey embedded in the scanned QR. The
          // reveal must match it (automatic key-equality check replaces the
          // human SAS comparison); undefined on the code path.
          scannedParentPub,
        };

        const didHello = await setPairingDoc(rid, pairCode, 'childHello', {
          v: 1,
          childEphPub: eph.pub,
        });
        if (myGen !== genRef.current) {
          cancelPairingSession(rid, pairCode);
          return;
        }
        if (!didHello) {
          sessionRef.current = null;
          setStatus('idle');
          setErrorMessage(t('settings.childAccounts.claim.askToRestart'));
          return;
        }

        sessionUnsubRef.current = subscribePairingSession(
          rid,
          pairCode,
          data => {
            const s = sessionRef.current;
            if (!s || s.imported || s.declined) return;
            if (!data) {
              endSession('expired');
              return;
            }
            if (data.status === 'JOINED' && data.joinedAt) {
              setPairingAnchor({
                anchor: data.joinedAt.toMillis(),
                startedAt: Date.now(),
              });
            } else if (data.status === 'CANCELLED') {
              endSession(
                'error',
                t('settings.childAccounts.claim.canceledByParent'),
                true,
              );
            }
          },
        );

        revealUnsubRef.current = subscribePairingDoc(
          rid,
          pairCode,
          'parentReveal',
          reveal => {
            const s = sessionRef.current;
            if (!s || s.sharedX || !reveal?.parentEphPub) return;
            try {
              if (!verifyKeyCommitment(s.commit, reveal.parentEphPub)) {
                endSession('error', t('settings.childAccounts.claim.tamper'));
                return;
              }
              // QR path: the wire peer must be the QR's parent — a MITM that
              // substituted keys would reveal a different pubkey than the one
              // the child scanned over the trusted physical channel. Equal ⇒
              // skip the SAS screen and auto-confirm (the human never
              // compares patterns on this path).
              if (s.scannedParentPub) {
                if (reveal.parentEphPub !== s.scannedParentPub) {
                  endSession('error', t('settings.childAccounts.claim.tamper'));
                  return;
                }
                const sharedX = deriveSharedX(s.eph.priv, reveal.parentEphPub);
                s.sharedX = sharedX;
                s.parentEphPub = reveal.parentEphPub;
                confirmMatch();
                return;
              }
              const sharedX = deriveSharedX(s.eph.priv, reveal.parentEphPub);
              s.sharedX = sharedX;
              s.parentEphPub = reveal.parentEphPub;
              setSas(computeSAS(sharedX, s.eph.pub, reveal.parentEphPub));
              setStatus('confirm');
            } catch (err) {
              console.log('child claim reveal error', err);
              endSession('error', t('settings.childAccounts.claim.tamper'));
            }
          },
        );
      } catch (err) {
        console.log('child claim submit error', err);
        setStatus('idle');
        setErrorMessage(t('settings.childAccounts.claim.askToRestart'));
      }
    },
    [t, endSession, confirmMatch],
  );

  const declineMatch = useCallback(() => {
    genRef.current += 1;
    const session = sessionRef.current;
    let cleanup = Promise.resolve();
    if (session?.rid && session?.sessionId && !session?.imported) {
      session.declined = true; // guards our listener + makes resetSession skip its writes
      cleanup = cancelPairingSession(session.rid, session.sessionId);
    }
    resetSession(); // synchronous local teardown (declined=true => no extra writes)
    pendingDeclineRef.current = cleanup;
    return cleanup;
  }, [resetSession]);

  // Passive expiry fallback (D1/D2): actively end the session — cancel it and
  // delete our handshake docs — once the current state's deadline + small
  // slack has passed. The deadline is elapsed from the snapshot's arrival
  // (startedAt), so device clock skew cancels out and the timer always fires
  // past the true server deadline. A rules-denied transition write remains the
  // primary expiry signal; this timer is the cleanup net so a dead session
  // dies immediately instead of lingering for native TTL.
  useEffect(() => {
    if (status !== 'joining' && status !== 'awaiting') return;
    if (!pairingAnchor?.startedAt) return;
    const fireAt =
      pairingAnchor.startedAt + PAIRING_STATE_TTL_MS + PAIRING_EXPIRY_SLACK_MS;
    const timer = setTimeout(() => {
      endSession('expired', t('settings.childAccounts.claim.expired'));
    }, Math.max(0, fireAt - Date.now()));
    return () => clearTimeout(timer);
  }, [status, pairingAnchor, endSession, t]);

  useEffect(() => {
    return () => {
      // On unmount (flow popped off the stack): tear down the listeners and
      // delete our own handshake docs unless the grant was already imported.
      if (sessionUnsubRef.current) sessionUnsubRef.current();
      if (revealUnsubRef.current) revealUnsubRef.current();
      if (grantUnsubRef.current) grantUnsubRef.current();
      const session = sessionRef.current;
      if (session?.eph) session.eph = null;
      if (
        session?.rid &&
        session?.sessionId &&
        !session?.imported &&
        !session?.declined
      )
        deletePairingHandshake(session.rid, session.sessionId);
    };
  }, []);

  const isEnded = status === 'error' || status === 'expired';

  const contextValue = useMemo(
    () => ({
      status,
      sas,
      errorMessage,
      submitPairing,
      confirmMatch,
      declineMatch,
      resetSession,
      isEnded,
      sessionRef,
    }),
    [
      status,
      sas,
      errorMessage,
      submitPairing,
      confirmMatch,
      declineMatch,
      resetSession,
      isEnded,
      sessionRef,
    ],
  );

  return (
    <ChildClaimContext.Provider value={contextValue}>
      {children}
    </ChildClaimContext.Provider>
  );
}

export function useChildClaim() {
  const ctx = useContext(ChildClaimContext);
  if (!ctx) {
    throw new Error('useChildClaim must be used within ChildClaimProvider');
  }
  return ctx;
}
