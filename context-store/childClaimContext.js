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
  rendezvousId,
} from '../app/functions/accounts/childPairing';
import {
  deletePairingHandshake,
  getPairingDoc,
  setPairingDoc,
  subscribePairingDoc,
} from '../db';
import { firebaseAuth } from '../db/initializeFirebase';

const PAIRING_TTL_MS = 180000; // 3 min, matches the handshake doc expiresAt rule.

// Shared session for the child-side claim handshake. Owns the live Firestore
// listener, the ephemeral key + shared secret in memory, and TTL cleanup so the
// three claim screens can read/drive one session instead of each re-running it.
// This is the child mirror of childPairingContext.js: it reads parentHello,
// writes childHello, listens for the grant, and imports the seed.
const ChildClaimContext = createContext(null);

export function ChildClaimProvider({ children }) {
  const { t } = useTranslation();
  const { setAccountMnemonic } = useKeysContext();

  // status: idle | joining | confirm | awaiting | done | error | expired
  const [status, setStatus] = useState('idle');
  const [sas, setSas] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const sessionRef = useRef(null);
  const unsubRef = useRef(null);
  const expiryRef = useRef(null);

  const resetSession = useCallback(async (status = 'idle') => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    if (expiryRef.current) {
      clearTimeout(expiryRef.current);
      expiryRef.current = null;
    }
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session?.eph) session.eph = null;
    if (session?.rid && !session?.imported) {
      await deletePairingHandshake(session.rid);
    }
    setSas('');
    setErrorMessage('');
    setStatus(status);
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

        const seed = String(payload.mnemonic || '').trim();
        if (!seed || !isValidMnemonic(seed.split(' '))) {
          throw new Error('Invalid seed payload');
        }
        session.imported = true;

        // No local child marker needed: the child's top-level user doc (created
        // by the parent at pairing) carries isChildAccount, so first-login init
        // learns it's a child straight from the doc.
        setAccountMnemonic(seed);
        if (unsubRef.current) {
          unsubRef.current();
          unsubRef.current = null;
        }
        if (expiryRef.current) {
          clearTimeout(expiryRef.current);
          expiryRef.current = null;
        }
        await deletePairingHandshake(session.rid);
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

  const submitCode = useCallback(
    async rawCode => {
      const code = String(rawCode || '')
        .trim()
        .toUpperCase();
      if (!code || status === 'joining') return;
      setErrorMessage('');
      setStatus('joining');

      try {
        if (!firebaseAuth.currentUser) {
          await signInAnonymously(firebaseAuth);
        }

        const eph = makeChildEphKey();
        const rid = rendezvousId(code);

        // The parent writes parentHello before showing the code, but allow a few
        // retries in case the child types it first.
        let parentHello = null;
        for (let i = 0; i < 6 && !parentHello; i++) {
          parentHello = await getPairingDoc(rid, 'parentHello');
          if (!parentHello) await new Promise(r => setTimeout(r, 800));
        }
        if (!parentHello?.parentWalletPub) {
          setStatus('idle');
          setErrorMessage(t('settings.childAccounts.claim.notFound'));
          return;
        }

        const sharedX = deriveSharedX(eph.priv, parentHello.parentWalletPub);
        const localSas = computeSAS(
          sharedX,
          eph.pub,
          parentHello.parentWalletPub,
        );

        sessionRef.current = {
          rid,
          eph,
          sharedX,
          parentWalletPub: parentHello.parentWalletPub,
        };

        const didHello = await setPairingDoc(rid, 'childHello', {
          v: 1,
          childEphPub: eph.pub,
          expiresAt: Date.now() + PAIRING_TTL_MS,
        });
        if (!didHello) throw new Error('Failed to join pairing session');

        setSas(localSas);
        setStatus('confirm');
      } catch (err) {
        console.log('child claim code error', err);
        setStatus('idle');
        setErrorMessage(t('settings.childAccounts.claim.notFound'));
      }
    },
    [status, t],
  );

  const confirmMatch = useCallback(() => {
    const session = sessionRef.current;
    if (!session?.sharedX || status === 'awaiting') return;
    // The human has visually compared the SAS on both phones. Now wait for the
    // parent to deliver the encrypted grant. A MITM that substituted keys would
    // have produced a different SAS, so a matched SAS means we can trust it.
    setErrorMessage('');
    setStatus('awaiting');

    unsubRef.current = subscribePairingDoc(session.rid, 'grant', grant => {
      if (grant?.ciphertext) importSeed(grant);
    });
    // If the parent never confirms, the handshake TTL-expires — surface it.
    expiryRef.current = setTimeout(() => {
      if (sessionRef.current?.imported) return;
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
      setStatus('expired');
    }, PAIRING_TTL_MS);
  }, [status, importSeed]);

  useEffect(() => {
    return () => {
      // On unmount (flow popped off the stack): tear down the listener and delete
      // the handshake docs unless the grant was already imported.
      if (unsubRef.current) unsubRef.current();
      if (expiryRef.current) clearTimeout(expiryRef.current);
      const session = sessionRef.current;
      if (session?.eph) session.eph = null;
      if (session?.rid && !session?.imported)
        deletePairingHandshake(session.rid);
    };
  }, []);

  const isEnded = status === 'error' || status === 'expired';

  const contextValue = useMemo(
    () => ({
      status,
      sas,
      errorMessage,
      submitCode,
      confirmMatch,
      resetSession,
      isEnded,
    }),
    [
      status,
      sas,
      errorMessage,
      submitCode,
      confirmMatch,
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
