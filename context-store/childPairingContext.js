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
  deletePairingHandshake,
  endPairingSession,
  ownsUniqueNameReservation,
  setPairingDoc,
  startPairingSession,
  subscribePairingDoc,
} from '../db';
import { crashlyticsRecordErrorReport } from '../app/functions/crashlyticsLogs';

const PAIRING_TTL_MS = 180000; // 3 min, matches the handshake doc expiresAt rule.
// Written expiresAt = now + TTL - slack. The rule caps expiresAt at
// request.time + 180000, so a device clock even slightly fast would exceed the
// cap and be rules-denied. Subtracting slack keeps every write under the cap.
const PAIRING_SKEW_SLACK_MS = 10000;

// Shared session for the parent-side child-pairing handshake. Owns the live
// Firestore listener, the child's secret seed in memory, and TTL cleanup so the
// four pairing screens can read/drive one session instead of each re-running it.
// The rendezvous is the parent's own username (normalizePairingName), and each
// session gets a fresh sessionId nonce so back-to-back re-pairs use a clean
// handshake namespace.
const ChildPairingContext = createContext(null);

export function ChildPairingProvider({ children }) {
  const { t } = useTranslation();
  const { accountMnemoinc, publicKey } = useKeysContext();
  const { globalContactsInformation } = useGlobalContactsInfo();
  const parentUniqueName = globalContactsInformation?.myProfile?.uniqueName;

  // status: idle | preparing | waiting | confirm | granting | done | error | expired
  const [status, setStatus] = useState('idle');
  const [sas, setSas] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const statusRef = useRef('idle');
  const sessionRef = useRef(null);
  const startingRef = useRef(false);
  const unsubRef = useRef(null);
  const cancelUnsubRef = useRef(null);
  const pairingStartTime = useRef(null);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Tear down a live session and land on a terminal status. Unlike
  // resetSession, this keeps the error message (when provided) so the terminal
  // screens (ChildLinkError) can explain why the pairing ended. Every terminal
  // path must route through here so confirmMatch's session/status guards always
  // see a dead session afterwards — otherwise a stale Match press (e.g. from the
  // confirmation modal left open over an ended session) could re-enter granting
  // from error/expired. It also marks the pointer terminal so the parent can
  // immediately re-pair (a stable username rid, unlike the old random-per-session
  // rid, would otherwise stay blocked by the live pointer until TTL).
  const endSession = useCallback((nextStatus, message = '') => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    if (cancelUnsubRef.current) {
      cancelUnsubRef.current();
      cancelUnsubRef.current = null;
    }
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session?.childMnemonic) session.childMnemonic = null; // wipe seed from memory
    if (session?.rid && session?.sessionId) {
      // Always mark the pointer terminal so re-pairing is unblocked immediately.
      endPairingSession(session.rid, session.sessionId);
      // A declined session leaves its docs (incl. the cancel signal) for the peer
      // to read; a granted session leaves its grant doc for the child to read.
      // Otherwise best-effort delete our own handshake docs.
      if (!session.granted && !session.declined) {
        deletePairingHandshake(session.rid, session.sessionId);
      }
    }
    setSas('');
    setErrorMessage(message);
    setStatus(nextStatus);
  }, []);

  const resetSession = useCallback(
    async (nextStatus = 'idle') => {
      endSession(nextStatus);
    },
    [endSession],
  );

  const startPairing = useCallback(
    async reshareChild => {
      // The child account already exists (created on the spending-limit screen).
      // This only runs the pairing handshake — re-runnable any time, e.g. if the
      // child loses their wallet and must re-pair.
      // Only one live handshake at a time. Re-entry — e.g. the link screen
      // re-focusing after the user backs out of the match screen — must not tear
      // down the in-flight session and open a new one.
      if (sessionRef.current || startingRef.current) return;
      startingRef.current = true;
      const startTime = Date.now();
      pairingStartTime.current = startTime;
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

        const expiresAt = Date.now() + PAIRING_TTL_MS - PAIRING_SKEW_SLACK_MS;

        // Fresh per-session ephemeral key. We publish only a commitment to its
        // pubkey now and reveal the pubkey after the child reveals theirs, so a
        // MITM can't grind either key to force a matching SAS.
        const parentEph = makeChildEphKey();

        // Open the session first (transaction enforces one live session at a
        // time). Only on success do we adopt the session — so a
        // SESSION_IN_PROGRESS / rules-denied / clock-skew start error lands on
        // `error` with sessionRef still null (nothing to tear down, nobody
        // else's session touched).
        const sessionId = await startPairingSession(rid, publicKey, {
          commit: makeKeyCommitment(parentEph.pub),
          expiresAt,
        });

        sessionRef.current = {
          rid,
          sessionId,
          childIndex,
          childMnemonic,
          name: childName,
          spendingLimit: childLimit,
          parentEph,
        };

        // Listen the whole session for a decline from the child so we don't hang
        // waiting on childConfirm/grant until the TTL expires.
        cancelUnsubRef.current = subscribePairingDoc(
          rid,
          sessionId,
          'cancel',
          () => {
            const s = sessionRef.current;
            if (!s || s.granted || s.declined) return;
            endSession(
              'error',
              t('settings.childAccounts.pairing.declinedByChild'),
            );
          },
        );

        // Listen for the child's ephemeral pubkey. Only then reveal our own
        // ephemeral pubkey (the child verifies it against the commitment), and
        // compute the SAS.
        unsubRef.current = subscribePairingDoc(
          rid,
          sessionId,
          'childHello',
          async childHello => {
            const s = sessionRef.current;
            if (!childHello?.childEphPub || !s || s.sharedX) return;
            const sharedX = deriveSharedX(
              s.parentEph.priv,
              childHello.childEphPub,
            );
            s.sharedX = sharedX;
            s.childEphPub = childHello.childEphPub;
            const didReveal = await setPairingDoc(rid, sessionId, 'parentReveal', {
              v: 1,
              parentEphPub: s.parentEph.pub,
              expiresAt: Date.now() + PAIRING_TTL_MS - PAIRING_SKEW_SLACK_MS,
            });
            if (!didReveal) {
              // The session was torn down under us (peer delete / TTL): the rule
              // denies our parentReveal. The session is dead — don't advance to SAS.
              endSession('error', t('settings.childAccounts.pairing.expired'));
              return;
            }
            setSas(
              computeSAS(sharedX, childHello.childEphPub, s.parentEph.pub),
            );
            setStatus('confirm');
          },
        );

        setStatus('waiting');
      } catch (err) {
        console.log('child pairing setup error', err);
        crashlyticsRecordErrorReport(err.message);
        // SESSION_IN_PROGRESS and any other start error collapse to one state
        // (clock skew makes distinguishing them unreliable — see Risks/L5).
        sessionRef.current = null;
        setStatus('error');
        setErrorMessage(t('settings.childAccounts.pairing.startFailed'));
      } finally {
        startingRef.current = false;
      }
    },
    [resetSession, endSession, accountMnemoinc, publicKey, parentUniqueName, t],
  );

  const declineMatch = useCallback(async () => {
    const session = sessionRef.current;
    if (session?.rid && session?.sessionId && !session?.granted) {
      session.declined = true; // guards our own cancel listener + skips doc delete
      await setPairingDoc(session.rid, session.sessionId, 'cancel', {
        v: 1,
        expiresAt: Date.now() + PAIRING_TTL_MS - PAIRING_SKEW_SLACK_MS,
      });
    }
    await resetSession();
  }, [resetSession]);

  const confirmMatch = useCallback(async () => {
    const session = sessionRef.current;
    if (statusRef.current !== 'confirm') return;
    if (!session?.sharedX || !session?.childMnemonic) return;
    setStatus('granting');

    // Wait for the child to confirm the match before delivering the grant, so the
    // parent doesn't jump to success while the child is still verifying. Fires
    // immediately if the child already confirmed. Mirror of the child waiting on
    // the parent's grant doc.
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    unsubRef.current = subscribePairingDoc(
      session.rid,
      session.sessionId,
      'childConfirm',
      async () => {
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
              expiresAt: Date.now() + PAIRING_TTL_MS - PAIRING_SKEW_SLACK_MS,
            },
          );
          if (!didGrant) throw new Error('Failed to deliver grant');

          session.granted = true;
          session.childMnemonic = null; // wipe seed from memory
          if (unsubRef.current) {
            unsubRef.current();
            unsubRef.current = null;
          }
          // Mark the pointer terminal now that the grant is delivered so the
          // parent can immediately re-pair a second child. Leave the grant doc
          // for the child to read (TTL cleans it up).
          endPairingSession(session.rid, session.sessionId);
          setStatus('done');
        } catch (err) {
          console.log('child grant error', err);
          crashlyticsRecordErrorReport(err.message);
          endSession('error');
        }
      },
    );
  }, [endSession]);

  // Expiry backstop.
  useEffect(() => {
    if (status !== 'waiting' && status !== 'confirm' && status !== 'granting')
      return;
    const expiresAt = pairingStartTime.current + PAIRING_TTL_MS;
    const timer = setTimeout(() => {
      resetSession('expired');
    }, Math.max(0, expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [status, resetSession]);

  useEffect(() => {
    return () => {
      // On unmount (flow popped off the stack): tear down the listener, mark the
      // pointer terminal, and delete our own handshake docs unless the grant was
      // already delivered / the session declined (then the docs are left for the
      // peer and TTL cleans up).
      if (unsubRef.current) unsubRef.current();
      if (cancelUnsubRef.current) cancelUnsubRef.current();
      const session = sessionRef.current;
      if (session?.childMnemonic) session.childMnemonic = null;
      if (session?.rid && session?.sessionId) {
        endPairingSession(session.rid, session.sessionId);
        if (!session.granted && !session.declined)
          deletePairingHandshake(session.rid, session.sessionId);
      }
    };
  }, []);

  const isEnded = status === 'error' || status === 'expired';

  const contextValue = useMemo(
    () => ({
      status,
      sas,
      errorMessage,
      parentUniqueName,
      startPairing,
      confirmMatch,
      declineMatch,
      resetSession,
      isEnded,
      pairingStartTime,
    }),
    [
      status,
      sas,
      errorMessage,
      parentUniqueName,
      startPairing,
      confirmMatch,
      declineMatch,
      resetSession,
      isEnded,
      pairingStartTime,
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
