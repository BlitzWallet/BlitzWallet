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
import { useKeysContext } from './keys';
import { useGlobalContactsInfo } from './globalContacts';
import { deriveChildMnemonic } from '../app/functions/accounts/childAccounts';
import {
  computeSAS,
  deriveSeedKey,
  deriveSharedX,
  encryptSeedPayload,
  makeChildEphKey,
  makeKeyCommitment,
  normalizePairingName,
} from '../app/functions/accounts/childPairing';
import {
  advanceSessionStatus,
  cancelPairingSession,
  createPairingSession,
  deletePairingHandshake,
  ownsUniqueNameReservation,
  setPairingDoc,
  subscribePairingDoc,
  subscribePairingSession,
} from '../db';
import { useAccountsExpiryTimeTick } from '../app/functions/accounts/expiryTimeTick';
import { buildPairingQr } from '../app/functions/accounts/childPairing';

// Per-state server deadline (rules: request.time < stateTs + 3m). Only the
// server clock judges liveness; this constant drives the cosmetic countdown
// (pairingExpiryClock) and the passive expiry fallback below.
const PAIRING_STATE_TTL_MS = 180000;

// Shared session for the parent-side child-pairing handshake. Owns the live
// Firestore listeners (session doc + handshake docs), the child's secret seed
// in memory, and teardown so the four pairing screens can read/drive one
// session instead of each re-running it. The rendezvous is the parent's own
// username (normalizePairingName), and each session gets a fresh 6-digit
// pairing code (the session doc id) so back-to-back re-pairs use a clean
// session namespace.
const ChildPairingContext = createContext(null);

export function ChildPairingProvider({ children }) {
  const { t } = useTranslation();
  const { accountMnemoinc, publicKey } = useKeysContext();
  const { globalContactsInformation } = useGlobalContactsInfo();
  const parentUniqueName = globalContactsInformation?.myProfile?.uniqueName;
  // The shared 1s app tick. This is the SAME tick that renders the
  // pairingExpiryClock countdown, so the visible clock and the expiry fallback
  // below are atomic — they can never disagree about the time.
  const tick = useAccountsExpiryTimeTick();

  // status: idle | preparing | waiting | confirm | accept | granting | done | error | expired
  // 'accept' (QR path only): the child has connected (childConfirm) and the
  // parent must tap Accept before the seed is granted — the human gate that
  // replaces SAS on the QR path.
  const [status, setStatus] = useState('idle');
  const [sas, setSas] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  // The 6-digit secret code the parent displays and the child types to reach
  // the session (the session doc id IS this code — no public pointer exists).
  const [pairingCode, setPairingCode] = useState('');
  // The parent's ephemeral pubkey for the live session. Together with
  // pairingCode this drives the QR-path payload (qrValue).
  const [parentEphPub, setParentEphPub] = useState('');
  // Which pairing mode opened the live session ('code' | 'qr'). Gates qrValue
  // so a code-mode session never exposes a scannable QR payload.
  const [pairingMode, setPairingMode] = useState('code');
  // Server timestamp (anchor) + device arrival time (startedAt) of the current
  // session state (createdAt / joinedAt / verifyingAt, from the session
  // snapshot). Countdowns are elapsed against startedAt so device clock skew
  // cancels out; never gates a transition.
  const [pairingExpiryClock, setPairingExpiryClock] = useState(null);

  const statusRef = useRef('idle');
  const sessionRef = useRef(null);
  const startingRef = useRef(false);
  const sessionUnsubRef = useRef(null);
  const handshakeUnsubRef = useRef(null);
  // Holds the backgrounded cancelPairingSession promise from the last decline.
  // The parent provider unmounts on decline (back-nav pops ChildPairingStack),
  // so the drain in startPairing is defensive / mirror-symmetry with the child.
  const pendingDeclineRef = useRef(null);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Tear down a live session and land on a terminal status. Unlike
  // resetSession, this keeps the error message (when provided) so the terminal
  // screens (ChildLinkError) can explain why the pairing ended. Every terminal
  // path must route through here so confirmMatch's session/status guards always
  // see a dead session afterwards — otherwise a stale Match press (e.g. from the
  // confirmation modal left open over an ended session) could re-enter granting
  // from error/expired. Cancelling the session is best-effort (it may already
  // be terminal).
  const endSession = useCallback((nextStatus, message = '') => {
    if (sessionUnsubRef.current) {
      sessionUnsubRef.current();
      sessionUnsubRef.current = null;
    }
    if (handshakeUnsubRef.current) {
      handshakeUnsubRef.current();
      handshakeUnsubRef.current = null;
    }
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session?.childMnemonic) session.childMnemonic = null; // wipe seed from memory
    // Only cancel a session that is still live and that WE are ending (expiry /
    // grant error). If it's already terminal — we granted it, we declined it, or
    // we're reacting to the peer's CANCELLED (s.declined set in the listener) —
    // re-cancelling is a terminal→CANCELLED write the rules deny
    // (permission-denied). A granted session leaves its grant doc for the child;
    // a declined session leaves its docs for the peer. So one guard covers both.
    if (
      session?.rid &&
      session?.sessionId &&
      !session.granted &&
      !session.declined
    ) {
      cancelPairingSession(session.rid, session.sessionId);
      deletePairingHandshake(session.rid, session.sessionId);
    }
    setSas('');
    setPairingCode('');
    setParentEphPub('');
    setPairingMode('code');
    setErrorMessage(message);
    setPairingExpiryClock(null);
    setStatus(nextStatus);
  }, []);

  const resetSession = useCallback(
    async (nextStatus = 'idle') => {
      endSession(nextStatus);
    },
    [endSession],
  );

  const startPairing = useCallback(
    async (reshareChild, mode = 'code') => {
      // The child account already exists (created on the spending-limit screen).
      // This only runs the pairing handshake — re-runnable any time, e.g. if the
      // child loses their wallet and must re-pair.
      // Only one live handshake at a time. Re-entry — e.g. the link screen
      // re-focusing after the user backs out of the match screen — must not tear
      // down the in-flight session and open a new one.
      if (sessionRef.current || startingRef.current) return;
      startingRef.current = true;
      if (pendingDeclineRef.current) {
        await pendingDeclineRef.current;
        pendingDeclineRef.current = null;
      }
      await resetSession();
      setStatus('preparing');
      try {
        if (!reshareChild) throw new Error('No child provided for pairing');

        // The rendezvous is the parent's own reserved username. Without a valid
        // (and reserved) name the owner-gated pointer create is denied, so block
        // here with a clear message instead of building an invalid path.
        const rid = normalizePairingName(parentUniqueName);
        if (!rid) {
          setStatus('error');
          setErrorMessage(t('settings.childAccounts.pairing.needsUsername'));
          return;
        }

        // The owner-gated pointer create requires an owned usernames/{rid}
        // reservation. If it isn't ours (someone squatted the name, or our
        // backfill hasn't reserved it yet), the create would be rules-denied and
        // surface as a generic failure. Check first for a clear message.
        const ownsName = await ownsUniqueNameReservation(publicKey, rid);
        if (!ownsName) {
          setStatus('error');
          setErrorMessage(t('settings.childAccounts.pairing.notOwner'));
          return;
        }

        const childIndex = reshareChild.childIndex;
        const childName = reshareChild.name;
        const childLimit = reshareChild.spendingLimit ?? null;
        const childMnemonic = await deriveChildMnemonic(
          accountMnemoinc,
          childIndex,
        );

        // Fresh per-session ephemeral key. We publish only a commitment to its
        // pubkey now and reveal the pubkey after the child reveals theirs, so a
        // MITM can't grind either key to force a matching SAS.
        const parentEph = makeChildEphKey();

        // Open a JIT session (fresh code = isolated namespace; no
        // SESSION_IN_PROGRESS conflict — sessions never collide). Only on
        // success do we adopt the session, so a start error lands on `error`
        // with sessionRef still null (nothing to tear down, nobody else's
        // session touched).
        const code = await createPairingSession(rid, publicKey, {
          commit: makeKeyCommitment(parentEph.pub),
        });
        setPairingCode(code);
        setParentEphPub(parentEph.pub);
        setPairingMode(mode);

        sessionRef.current = {
          rid,
          sessionId: code,
          childIndex,
          childMnemonic,
          name: childName,
          spendingLimit: childLimit,
          parentEph,
          mode,
        };

        // The session doc is the primary driver: every status transition re-anchors
        // the cosmetic countdown to the server timestamp, CANCELLED means the
        // child declined, and a TTL-deleted doc is a derived expiry.
        sessionUnsubRef.current = subscribePairingSession(rid, code, data => {
          const s = sessionRef.current;
          if (!s || s.granted || s.declined) return;
          if (!data) {
            // Session GC'd — purely passive: flip the screen, no teardown.
            setStatus('expired');
            return;
          }
          if (data.status === 'WAITING' && data.createdAt) {
            setPairingExpiryClock({
              anchor: data.createdAt.toMillis(),
              startedAt: Date.now(),
            });
          } else if (data.status === 'JOINED' && data.joinedAt) {
            // setPairingExpiryClock({
            //   anchor: data.joinedAt.toMillis(),
            //   startedAt: Date.now(),
            // });
          } else if (data.status === 'VERIFYING' && data.verifyingAt) {
            // setPairingExpiryClock({
            //   anchor: data.verifyingAt.toMillis(),
            //   startedAt: Date.now(),
            // });
          } else if (data.status === 'CANCELLED') {
            s.declined = true;
            endSession(
              'error',
              t('settings.childAccounts.pairing.declinedByChild'),
            );
          }
          // COMPLETED is deliberately ignored: the parent's terminal is the
          // grant being delivered, not this best-effort marker (D5).
        });

        // Listen for the child's ephemeral pubkey. Only then reveal our own
        // ephemeral pubkey (the child verifies it against the commitment),
        // advance the session to VERIFYING, and compute the SAS.
        handshakeUnsubRef.current = subscribePairingDoc(
          rid,
          code,
          'childHello',
          async childHello => {
            const s = sessionRef.current;
            if (!childHello?.childEphPub || !s || s.sharedX) return;
            try {
              const sharedX = deriveSharedX(
                s.parentEph.priv,
                childHello.childEphPub,
              );
              s.sharedX = sharedX;
              s.childEphPub = childHello.childEphPub;

              // Advance JOINED→VERIFYING BEFORE writing parentReveal: the
              // handshake rules gate parentReveal on the session being VERIFYING.
              const didAdvance = await advanceSessionStatus(
                rid,
                code,
                'VERIFYING',
              );
              if (sessionRef.current !== s) return;
              if (!didAdvance) {
                // Rules-denied — the session deadline passed under us. Surface
                // the derived expiry; never rely on a client timer for this.
                endSession(
                  'expired',
                  t('settings.childAccounts.pairing.expired'),
                );
                return;
              }
              const didReveal = await setPairingDoc(rid, code, 'parentReveal', {
                v: 1,
                parentEphPub: s.parentEph.pub,
              });
              if (sessionRef.current !== s) return;
              if (!didReveal) {
                endSession(
                  'expired',
                  t('settings.childAccounts.pairing.expired'),
                );
                return;
              }
              if (s.mode === 'qr') {
                // QR path: the child scanned our pubkey out-of-band, so the
                // child's automatic key-equality assertion replaces the human
                // SAS comparison (parent→child authentication). But the grant
                // is NOT delivered automatically: the child's childConfirm only
                // surfaces the Accept screen, and the parent must tap Accept
                // before the seed leaves (child→parent authentication). Without
                // this gate a photographed QR would let a scripted claimer win
                // the single-claim race and silently receive the child seed.
                if (handshakeUnsubRef.current) {
                  handshakeUnsubRef.current();
                  handshakeUnsubRef.current = null;
                }
                handshakeUnsubRef.current = subscribePairingDoc(
                  rid,
                  code,
                  'childConfirm',
                  () => {
                    if (statusRef.current !== 'waiting') return;
                    setStatus('accept');
                  },
                );
                return;
              }
              setSas(
                computeSAS(sharedX, childHello.childEphPub, s.parentEph.pub),
              );
              setStatus('confirm');
            } catch (err) {
              console.log('child pairing handshake error', err);
              endSession('error', t('settings.childAccounts.pairing.tamper'));
            }
          },
        );

        setStatus('waiting');
      } catch (err) {
        console.log('child pairing setup error', err);
        sessionRef.current = null;
        setStatus('error');
        setErrorMessage(t('settings.childAccounts.pairing.startFailed'));
      } finally {
        startingRef.current = false;
      }
    },
    [resetSession, endSession, accountMnemoinc, publicKey, parentUniqueName, t],
  );

  const declineMatch = useCallback(() => {
    const session = sessionRef.current;
    let cleanup = Promise.resolve();
    if (session?.rid && session?.sessionId && !session?.granted) {
      session.declined = true; // guards our own session listener + skips doc delete
      cleanup = cancelPairingSession(session.rid, session.sessionId);
    }
    resetSession(); // synchronous local teardown (endSession)
    pendingDeclineRef.current = cleanup;
    return cleanup;
  }, [resetSession]);

  // Encrypt and deliver the child seed. The parent's terminal is this grant
  // being delivered, never the session's COMPLETED marker (D5). Reached only
  // after the parent's authorization: the human SAS compare + Match on the code
  // path, or the Accept tap on the QR path.
  const deliverGrant = useCallback(
    async session => {
      if (session.granted || !session.childMnemonic) return;
      try {
        const seedKey = deriveSeedKey(session.sharedX);
        const enc = encryptSeedPayload(seedKey, {
          v: 1,
          mnemonic: session.childMnemonic,
          name: session.name,
          spendingLimit: session.spendingLimit,
          childIndex: session.childIndex,
          grantedAt: Date.now(),
        });
        const didGrant = await setPairingDoc(
          session.rid,
          session.sessionId,
          'grant',
          {
            v: 1,
            iv: enc.iv,
            ciphertext: enc.ct,
            tag: enc.tag,
          },
        );
        if (!didGrant) throw new Error('Failed to deliver grant');

        session.granted = true;
        session.childMnemonic = null; // wipe seed from memory
        if (handshakeUnsubRef.current) {
          handshakeUnsubRef.current();
          handshakeUnsubRef.current = null;
        }
        if (sessionUnsubRef.current) {
          sessionUnsubRef.current();
          sessionUnsubRef.current = null;
        }
        // Best-effort cosmetic marker (D5): the grant is the parent's
        // terminal, so this may be rules-denied at the deadline boundary —
        // swallow its failure and never depend on it.
        advanceSessionStatus(session.rid, session.sessionId, 'COMPLETED');
        setStatus('done');
      } catch (err) {
        console.log('child grant error', err);
        if (sessionRef.current === session) endSession('error');
      }
    },
    [endSession],
  );

  // Code path: subscribe childConfirm and deliver the grant once the child
  // confirms the SAS. The child writes childConfirm after the human SAS compare;
  // the parent already authorized by pressing Match (confirmMatch guards this).
  const deliverGrantOnChildConfirm = useCallback(
    session => {
      handshakeUnsubRef.current = subscribePairingDoc(
        session.rid,
        session.sessionId,
        'childConfirm',
        () => deliverGrant(session),
      );
    },
    [deliverGrant],
  );

  // QR path Accept tap: the child has connected (status 'accept') and the parent
  // consciously grants access. This is the parent-side human authentication that
  // replaces SAS on the QR path — the grant is written only here, never
  // automatically on childConfirm.
  const acceptPairing = useCallback(() => {
    const session = sessionRef.current;
    if (statusRef.current !== 'accept') return;
    if (!session?.sharedX || !session?.childMnemonic) return;
    statusRef.current = 'granting';
    setStatus('granting');
    deliverGrant(session);
  }, [deliverGrant]);

  const confirmMatch = useCallback(async () => {
    const session = sessionRef.current;
    if (statusRef.current !== 'confirm') return;
    if (!session?.sharedX || !session?.childMnemonic) return;
    statusRef.current = 'granting';
    setStatus('granting');

    // Wait for the child to confirm the match before delivering the grant, so the
    // parent doesn't jump to success while the child is still verifying. Fires
    // immediately if the child already confirmed. Mirror of the child waiting on
    // the parent's grant doc.
    if (handshakeUnsubRef.current) {
      handshakeUnsubRef.current();
      handshakeUnsubRef.current = null;
    }
    deliverGrantOnChildConfirm(session);
  }, [deliverGrantOnChildConfirm]);

  // Passive expiry fallback (D1/D2): actively end the session — cancel it and
  // delete our handshake docs — the moment the countdown reads zero. The
  // deadline is elapsed from the snapshot's arrival (startedAt) and checked
  // against the same shared 1s tick that renders pairingExpiryClock, so the
  // visible countdown and this teardown are atomic: when the clock hits 0 the
  // session dies in the same render (no separate timer, no slack). A
  // rules-denied transition write remains the primary expiry signal; this is
  // the cleanup net so a dead session dies immediately instead of lingering
  // for native TTL.
  useEffect(() => {
    if (
      status !== 'waiting' &&
      status !== 'confirm' &&
      status !== 'accept' &&
      status !== 'granting'
    )
      return;
    if (!pairingExpiryClock?.startedAt) return;
    if (tick >= pairingExpiryClock.startedAt + PAIRING_STATE_TTL_MS) {
      endSession('expired', t('settings.childAccounts.pairing.expired'));
    }
  }, [status, pairingExpiryClock, tick, endSession, t]);

  useEffect(() => {
    return () => {
      // On unmount (flow popped off the stack): tear down the listeners and, if
      // the session is still live, cancel it + delete our own handshake docs.
      // A granted (done) session is COMPLETED and a declined session is
      // CANCELLED — both terminal — so re-cancelling them is a write the rules
      // deny (permission-denied); leave their docs for the peer / TTL.
      if (sessionUnsubRef.current) sessionUnsubRef.current();
      if (handshakeUnsubRef.current) handshakeUnsubRef.current();
      const session = sessionRef.current;
      if (session?.childMnemonic) session.childMnemonic = null;
      if (
        session?.rid &&
        session?.sessionId &&
        !session.granted &&
        !session.declined
      ) {
        cancelPairingSession(session.rid, session.sessionId);
        deletePairingHandshake(session.rid, session.sessionId);
      }
    };
  }, []);

  const isEnded = status === 'error' || status === 'expired';

  // The QR-path payload for the live session (empty outside a live QR-mode
  // session). Both inputs are state set at session creation, so the link
  // screen re-renders with a scannable QR as soon as the session exists.
  const qrValue = useMemo(
    () =>
      pairingMode === 'qr' && pairingCode && parentEphPub
        ? buildPairingQr({
            name: parentUniqueName,
            code: pairingCode,
            parentEphPub,
          })
        : '',
    [pairingMode, pairingCode, parentEphPub, parentUniqueName],
  );

  const contextValue = useMemo(
    () => ({
      status,
      sas,
      errorMessage,
      parentUniqueName,
      pairingCode,
      qrValue,
      startPairing,
      confirmMatch,
      acceptPairing,
      declineMatch,
      resetSession,
      isEnded,
      pairingExpiryClock,
    }),
    [
      status,
      sas,
      errorMessage,
      parentUniqueName,
      pairingCode,
      qrValue,
      startPairing,
      confirmMatch,
      acceptPairing,
      declineMatch,
      resetSession,
      isEnded,
      pairingExpiryClock,
    ],
  );

  return (
    <ChildPairingContext.Provider value={contextValue}>
      {children}
    </ChildPairingContext.Provider>
  );
}

export function useChildPairing() {
  const ctx = useContext(ChildPairingContext);
  if (!ctx) {
    throw new Error('useChildPairing must be used within ChildPairingProvider');
  }
  return ctx;
}
