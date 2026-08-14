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
  deletePairingHandshake,
  getPairingPointer,
  joinPairingSession,
  setPairingDoc,
  subscribePairingDoc,
  subscribePairingSession,
} from '../db';
import { firebaseAuth } from '../db/initializeFirebase';

// Per-state server deadline (rules: request.time < stateTs + 3m). Only used to
// anchor the passive expiry fallback below; never gates a transition.
const PAIRING_STATE_TTL_MS = 180000;
// The passive expiry fallback actively cancels the session and deletes our
// handshake docs once the deadline has clearly passed. The deadline is
// anchored at the snapshot's arrival (startedAt) and elapsed with the device
// clock, so absolute device/server clock skew cancels out; the small slack
// only covers snapshot delivery latency and timer jitter.
const PAIRING_EXPIRY_SLACK_MS = 10 * 1000;

// True iff a pointer names a session worth trying (exists + points at a
// session). Liveness is NOT judged here — the WAITING→JOINED rule is the real
// gate, and the child's clock never decides correctness.
function isLivePointer(p) {
  return !!(p && p.sessionId && p.commit);
}

// Shared session for the child-side claim handshake. Owns the live Firestore
// listeners (session doc + handshake docs), the ephemeral key + shared secret
// in memory, and teardown so the three claim screens can read/drive one session
// instead of each re-running it. This is the child mirror of
// childPairingContext.js: it reads the parent's pointer (by username) to learn
// the live sessionId + commit, atomically claims the session (WAITING→JOINED),
// writes childHello, listens for the grant, and imports the seed. The child's
// terminal is a successful decrypt of the grant (a valid AES-GCM tag), never
// the session's COMPLETED marker (D5).
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
  // Holds the backgrounded cancelPairingSession promise from the last decline so
  // a back-to-back re-pair can drain it before opening a new session (never
  // overlap the previous session's cleanup).
  const pendingDeclineRef = useRef(null);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Tear down a live session and land on a terminal status, keeping the error
  // message (when provided) so the terminal screens can explain why the pairing
  // ended. Cancelling the session is best-effort (it may already be terminal);
  // our own handshake docs are deleted unless the seed already landed or the
  // session was declined (then the docs are left for the peer to read). Mirror
  // of the parent-side endSession in childPairingContext.js.
  const endSession = useCallback((nextStatus, message = '') => {
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
    if (session?.rid && session?.sessionId) {
      cancelPairingSession(session.rid, session.sessionId);
      if (!session.imported && !session.declined) {
        deletePairingHandshake(session.rid, session.sessionId);
      }
    }
    setPairingAnchor(null);
    setSas('');
    setErrorMessage(message);
    setStatus(nextStatus);
  }, []);

  const resetSession = useCallback(async (nextStatus = 'idle') => {
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
    setSas('');
    setErrorMessage('');
    setStatus(nextStatus);
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
        setErrorMessage(t('settings.childAccounts.claim.tamper'));
        setStatus('error');
      }
    },
    [setAccountMnemonic, t],
  );

  const submitName = useCallback(
    async rawName => {
      const rid = normalizePairingName(rawName);
      if (!rid || status === 'joining') {
        if (!rid)
          setErrorMessage(t('settings.childAccounts.claim.askToRestart'));
        return;
      }
      setErrorMessage('');
      setStatus('joining');
      if (pendingDeclineRef.current) {
        await pendingDeclineRef.current;
        pendingDeclineRef.current = null;
      }

      try {
        if (!firebaseAuth.currentUser) {
          await signInAnonymously(firebaseAuth);
        }
        const uid = firebaseAuth.currentUser.uid;

        // Read the pointer to learn the live sessionId + commit. The parent
        // opens the session before showing their name, but allow a few retries
        // in case the child types it first.
        let pointer = null;
        for (let i = 0; i < 6 && !isLivePointer(pointer); i++) {
          pointer = await getPairingPointer(rid);
          if (!isLivePointer(pointer))
            await new Promise(r => setTimeout(r, 800));
        }
        if (!isLivePointer(pointer)) {
          setStatus('idle');
          setErrorMessage(t('settings.childAccounts.claim.askToRestart'));
          return;
        }

        // Commit-reveal: we reveal childEphPub now; the parent reveals its own
        // pubkey afterwards. We only derive the shared secret + SAS once the
        // revealed pubkey matches the commitment, so a MITM can't grind keys.
        const eph = makeChildEphKey();

        // Atomically claim the session (rules: WAITING→JOINED, exactly one
        // winner, server deadline). A denial is NOT diagnosed (D4): a genuinely
        // claimed session, a dead parent's past-deadline session, and a
        // squatter are indistinguishable without trusting the child's clock —
        // all collapse to the one "start a new pairing" copy.
        const didJoin = await joinPairingSession(rid, pointer.sessionId, uid);
        if (!didJoin) {
          setStatus('idle');
          setErrorMessage(t('settings.childAccounts.claim.askToRestart'));
          return;
        }

        sessionRef.current = {
          rid,
          sessionId: pointer.sessionId,
          eph,
          commit: pointer.commit,
        };

        const didHello = await setPairingDoc(
          rid,
          pointer.sessionId,
          'childHello',
          {
            v: 1,
            childEphPub: eph.pub,
          },
        );
        if (!didHello) {
          sessionRef.current = null;
          setStatus('idle');
          setErrorMessage(t('settings.childAccounts.claim.askToRestart'));
          return;
        }

        // Watch the session doc: CANCELLED → the parent canceled; deleted
        // (native TTL) → derived expiry; COMPLETED is deliberately ignored —
        // the child's terminal is decrypting the grant, never this marker (D5).
        sessionUnsubRef.current = subscribePairingSession(
          rid,
          pointer.sessionId,
          data => {
            const s = sessionRef.current;
            if (!s || s.imported || s.declined) return;
            if (!data) {
              // Session GC'd — purely passive: flip the screen, no teardown.
              setStatus('expired');
              return;
            }
            if (data.status === 'JOINED' && data.joinedAt) {
              setPairingAnchor({
                anchor: data.joinedAt.toMillis(),
                startedAt: Date.now(),
              });
            } else if (data.status === 'VERIFYING' && data.verifyingAt) {
              // setPairingAnchor({
              //   anchor: data.verifyingAt.toMillis(),
              //   startedAt: Date.now(),
              // });
            } else if (data.status === 'CANCELLED') {
              setErrorMessage(
                t('settings.childAccounts.claim.canceledByParent'),
              );
              setStatus('error');
            }
          },
        );

        // Wait for the parent to reveal its ephemeral pubkey, verify it against
        // the commitment, then compute the SAS.
        revealUnsubRef.current = subscribePairingDoc(
          rid,
          pointer.sessionId,
          'parentReveal',
          reveal => {
            const s = sessionRef.current;
            if (!s || s.sharedX || !reveal?.parentEphPub) return;
            try {
              if (!verifyKeyCommitment(s.commit, reveal.parentEphPub)) {
                // Revealed key doesn't match the commitment -> possible MITM.
                setErrorMessage(t('settings.childAccounts.claim.tamper'));
                setStatus('error');
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
        console.log('child claim name error', err);
        setStatus('idle');
        setErrorMessage(t('settings.childAccounts.claim.askToRestart'));
      }
    },
    [status, t],
  );

  const confirmMatch = useCallback(async () => {
    const session = sessionRef.current;
    // Only the SAS-confirm screen may start the grant wait: rejecting after the
    // session already ended (or double-confirming) must be a no-op, mirroring
    // the parent-side guard.
    if (!session?.sharedX || statusRef.current !== 'confirm') return;
    // The human has visually compared the SAS on both phones. Now wait for the
    // parent to deliver the encrypted grant. A MITM that substituted keys would
    // have produced a different SAS, so a matched SAS means we can trust it.
    setErrorMessage('');
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
      setStatus('expired');
      setErrorMessage(t('settings.childAccounts.claim.expired'));
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

  const declineMatch = useCallback(() => {
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
      submitName,
      confirmMatch,
      declineMatch,
      resetSession,
      isEnded,
    }),
    [
      status,
      sas,
      errorMessage,
      submitName,
      confirmMatch,
      declineMatch,
      resetSession,
      isEnded,
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
