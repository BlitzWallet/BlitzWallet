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
import { deriveChildMnemonic } from '../app/functions/accounts/childAccounts';
import {
  computeSAS,
  deriveSeedKey,
  deriveSharedX,
  encryptSeedPayload,
  makePairingCode,
  rendezvousId,
} from '../app/functions/accounts/childPairing';
import {
  deletePairingHandshake,
  setPairingDoc,
  subscribePairingDoc,
} from '../db';
import { crashlyticsRecordErrorReport } from '../app/functions/crashlyticsLogs';

const PAIRING_TTL_MS = 180000; // 3 min, matches the handshake doc expiresAt rule.

// Shared session for the parent-side child-pairing handshake. Owns the live
// Firestore listener, the child's secret seed in memory, and TTL cleanup so the
// four pairing screens can read/drive one session instead of each re-running it.
const ChildPairingContext = createContext(null);

export function ChildPairingProvider({ children }) {
  const { t } = useTranslation();
  const { accountMnemoinc, publicKey, contactsPrivateKey } = useKeysContext();

  // status: idle | preparing | waiting | confirm | granting | done | error | expired
  const [status, setStatus] = useState('idle');
  const [code, setCode] = useState('');
  const [sas, setSas] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const sessionRef = useRef(null);
  const unsubRef = useRef(null);
  const cancelUnsubRef = useRef(null);
  const pairingStartTime = useRef(null);

  const resetSession = useCallback(async (status = 'idle') => {
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
    // A declined session leaves its docs (incl. the cancel signal) for the peer to
    // read; TTL cleans up. Otherwise tear the handshake down unless the grant landed.
    if (session?.rid && !session?.granted && !session?.declined) {
      deletePairingHandshake(session.rid);
    }
    setCode('');
    setSas('');
    setErrorMessage('');
    setStatus(status);
  }, []);

  const startPairing = useCallback(
    async reshareChild => {
      // The child account already exists (created on the spending-limit screen).
      // This only runs the pairing handshake — re-runnable any time, e.g. if the
      // child loses their wallet and must re-pair.
      // Only one live handshake at a time. Re-entry — e.g. the link screen
      // re-focusing after the user backs out of the match screen — must not tear
      // down the in-flight session and mint a new pairing code.
      if (sessionRef.current) return;
      const startTime = Date.now();
      pairingStartTime.current = startTime;
      await resetSession();
      setStatus('preparing');
      try {
        if (!reshareChild) throw new Error('No child provided for pairing');

        const childIndex = reshareChild.childIndex;
        const childName = reshareChild.name;
        const childLimit = reshareChild.spendingLimit ?? null;
        const childMnemonic = await deriveChildMnemonic(
          accountMnemoinc,
          childIndex,
        );

        const pairingCode = makePairingCode();
        const rid = rendezvousId(pairingCode);
        const expiresAt = Date.now() + PAIRING_TTL_MS;

        sessionRef.current = {
          rid,
          childIndex,
          childMnemonic,
          name: childName,
          spendingLimit: childLimit,
        };

        const didHello = await setPairingDoc(rid, 'parentHello', {
          v: 1,
          parentWalletPub: publicKey,
          name: childName,
          expiresAt,
        });
        if (!didHello) throw new Error('Failed to open pairing session');

        // Listen the whole session for a decline from the child so we don't hang
        // waiting on childConfirm/grant until the TTL expires.
        cancelUnsubRef.current = subscribePairingDoc(rid, 'cancel', () => {
          const s = sessionRef.current;
          if (!s || s.granted || s.declined) return;
          setErrorMessage(t('settings.childAccounts.pairing.declinedByChild'));
          setStatus('error');
        });

        // Listen for the child's ephemeral pubkey, then compute the SAS.
        unsubRef.current = subscribePairingDoc(
          rid,
          'childHello',
          childHello => {
            if (!childHello?.childEphPub || sessionRef.current?.sharedX) return;
            const sharedX = deriveSharedX(
              contactsPrivateKey,
              childHello.childEphPub,
            );
            sessionRef.current.sharedX = sharedX;
            sessionRef.current.childEphPub = childHello.childEphPub;
            setSas(computeSAS(sharedX, childHello.childEphPub, publicKey));
            setStatus('confirm');
          },
        );

        const now = Date.now();
        const runTime = now - startTime;
        const timeLeft = 1000 - runTime;
        if (timeLeft > 0) await new Promise(res => setTimeout(res, timeLeft));
        setCode(pairingCode);
        setStatus('waiting');
      } catch (err) {
        console.log('child pairing setup error', err);
        crashlyticsRecordErrorReport(err.message);
        setStatus('error');
      }
    },
    [resetSession, accountMnemoinc, publicKey, contactsPrivateKey, t],
  );

  const declineMatch = useCallback(async () => {
    const session = sessionRef.current;
    if (session?.rid && !session?.granted) {
      session.declined = true; // guards our own cancel listener + skips doc delete
      await setPairingDoc(session.rid, 'cancel', {
        v: 1,
        expiresAt: Date.now() + PAIRING_TTL_MS,
      });
    }
    await resetSession();
  }, [resetSession]);

  const confirmMatch = useCallback(async () => {
    const session = sessionRef.current;
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
          const didGrant = await setPairingDoc(session.rid, 'grant', {
            v: 1,
            iv: enc.iv,
            ciphertext: enc.ct,
            tag: enc.tag,
            expiresAt: Date.now() + PAIRING_TTL_MS,
          });
          if (!didGrant) throw new Error('Failed to deliver grant');

          session.granted = true;
          session.childMnemonic = null; // wipe seed from memory
          if (unsubRef.current) {
            unsubRef.current();
            unsubRef.current = null;
          }
          setStatus('done');
        } catch (err) {
          console.log('child grant error', err);
          crashlyticsRecordErrorReport(err.message);
          setStatus('error');
        }
      },
    );
  }, []);

  // Expiry backstop.
  useEffect(() => {
    if (status !== 'waiting' && status !== 'confirm' && status !== 'granting')
      return;
    const timer = setTimeout(() => {
      resetSession('expired');
    }, PAIRING_TTL_MS);
    return () => clearTimeout(timer);
  }, [status, resetSession]);

  useEffect(() => {
    return () => {
      // On unmount (flow popped off the stack): tear down the listener and delete
      // the handshake docs unless the grant was already delivered (then TTL cleans
      // up so the child can still read it).
      if (unsubRef.current) unsubRef.current();
      if (cancelUnsubRef.current) cancelUnsubRef.current();
      const session = sessionRef.current;
      if (session?.childMnemonic) session.childMnemonic = null;
      if (session?.rid && !session?.granted && !session?.declined)
        deletePairingHandshake(session.rid);
    };
  }, []);

  const isEnded = status === 'error' || status === 'expired';

  const contextValue = useMemo(
    () => ({
      status,
      code,
      sas,
      errorMessage,
      startPairing,
      confirmMatch,
      declineMatch,
      resetSession,
      isEnded,
      pairingStartTime,
    }),
    [
      status,
      code,
      sas,
      errorMessage,
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
