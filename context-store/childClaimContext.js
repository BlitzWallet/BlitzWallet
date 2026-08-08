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
  verifyKeyCommitment,
} from '../app/functions/accounts/childPairing';
import {
  deletePairingHandshake,
  getPairingDoc,
  setPairingDoc,
  subscribePairingDoc,
  subscribePairingDocDeleted,
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
  const cancelUnsubRef = useRef(null);
  const parentGoneUnsubRef = useRef(null);
  const revealUnsubRef = useRef(null);
  const expiryRef = useRef(null);

  const resetSession = useCallback(async (status = 'idle') => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    if (cancelUnsubRef.current) {
      cancelUnsubRef.current();
      cancelUnsubRef.current = null;
    }
    if (parentGoneUnsubRef.current) {
      parentGoneUnsubRef.current();
      parentGoneUnsubRef.current = null;
    }
    if (revealUnsubRef.current) {
      revealUnsubRef.current();
      revealUnsubRef.current = null;
    }
    if (expiryRef.current) {
      clearTimeout(expiryRef.current);
      expiryRef.current = null;
    }
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session?.eph) session.eph = null;
    // A declined session leaves its docs (incl. the cancel signal) for the peer to
    // read; TTL cleans up. Otherwise tear the handshake down unless the seed landed.
    if (session?.rid && !session?.imported && !session?.declined) {
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
        if (unsubRef.current) {
          unsubRef.current();
          unsubRef.current = null;
        }
        if (parentGoneUnsubRef.current) {
          parentGoneUnsubRef.current();
          parentGoneUnsubRef.current = null;
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
      if (code.length <= 5) return;
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
        if (!parentHello?.commit) {
          setStatus('idle');
          setErrorMessage(t('settings.childAccounts.claim.notFound'));
          return;
        }

        // Commit-reveal: we reveal childEphPub now; the parent reveals its own
        // pubkey afterwards. We only derive the shared secret + SAS once the
        // revealed pubkey matches the commitment, so a MITM can't grind keys.
        sessionRef.current = {
          rid,
          eph,
          commit: parentHello.commit,
        };

        const didHello = await setPairingDoc(rid, 'childHello', {
          v: 1,
          childEphPub: eph.pub,
          childAuthUid: firebaseAuth.currentUser.uid,
          expiresAt: Date.now() + PAIRING_TTL_MS,
        });
        if (!didHello) {
          // Write-once lost. Read the slot back: a foreign childEphPub means
          // someone else already claimed this code — surface a distinct abort
          // signal instead of the generic "code not found" so the real child
          // knows to stop.
          const existingHello = await getPairingDoc(rid, 'childHello');
          if (existingHello && existingHello.childEphPub !== eph.pub) {
            setErrorMessage(t('settings.childAccounts.claim.slotTaken'));
            setStatus('error');
            return;
          }
          throw new Error('Failed to join pairing session');
        }

        // Listen the whole session for the parent cancelling so we don't hang
        // waiting on the grant until the TTL expires.
        cancelUnsubRef.current = subscribePairingDoc(rid, 'cancel', () => {
          const s = sessionRef.current;
          if (!s || s.imported || s.declined) return;
          setErrorMessage(t('settings.childAccounts.claim.canceledByParent'));
          setStatus('error');
        });

        // The parent deletes the whole handshake when it times out or leaves;
        // deletion is invisible to subscribePairingDoc, so watch parentHello
        // disappearing and treat it as expiry instead of hanging on the SAS
        // screen forever.
        parentGoneUnsubRef.current = subscribePairingDocDeleted(
          rid,
          'parentHello',
          () => {
            const s = sessionRef.current;
            if (!s || s.imported || s.declined) return;
            setStatus('expired');
          },
        );

        // Wait for the parent to reveal its ephemeral pubkey, verify it against
        // the commitment, then compute the SAS.
        revealUnsubRef.current = subscribePairingDoc(
          rid,
          'parentReveal',
          reveal => {
            const s = sessionRef.current;
            if (!s || s.sharedX || !reveal?.parentEphPub) return;
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
          },
        );

        // If the parent never reveals, surface expiry instead of spinning.
        expiryRef.current = setTimeout(() => {
          const s = sessionRef.current;
          if (!s || s.sharedX || s.imported || s.declined) return;
          setStatus('expired');
        }, PAIRING_TTL_MS);
      } catch (err) {
        console.log('child claim code error', err);
        setStatus('idle');
        setErrorMessage(t('settings.childAccounts.claim.notFound'));
      }
    },
    [status, t],
  );

  const confirmMatch = useCallback(async () => {
    const session = sessionRef.current;
    if (!session?.sharedX || status === 'awaiting') return;
    // The human has visually compared the SAS on both phones. Now wait for the
    // parent to deliver the encrypted grant. A MITM that substituted keys would
    // have produced a different SAS, so a matched SAS means we can trust it.
    setErrorMessage('');
    setStatus('awaiting');

    // Tell the parent we confirmed the match so it can deliver the grant and
    // advance — the mirror of the child waiting on the parent's grant doc.
    await setPairingDoc(session.rid, 'childConfirm', {
      v: 1,
      expiresAt: Date.now() + PAIRING_TTL_MS,
    });

    unsubRef.current = subscribePairingDoc(session.rid, 'grant', grant => {
      if (grant?.ciphertext) importSeed(grant);
    });
    // Replace the reveal-wait timer with the grant-wait timer.
    if (expiryRef.current) clearTimeout(expiryRef.current);
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

  const declineMatch = useCallback(async () => {
    const session = sessionRef.current;
    if (session?.rid && !session?.imported) {
      session.declined = true; // guards our own cancel listener + skips doc delete
      await setPairingDoc(session.rid, 'cancel', {
        v: 1,
        expiresAt: Date.now() + PAIRING_TTL_MS,
      });
    }
    await resetSession();
  }, [resetSession]);

  useEffect(() => {
    return () => {
      // On unmount (flow popped off the stack): tear down the listener and delete
      // the handshake docs unless the grant was already imported.
      if (unsubRef.current) unsubRef.current();
      if (cancelUnsubRef.current) cancelUnsubRef.current();
      if (parentGoneUnsubRef.current) parentGoneUnsubRef.current();
      if (revealUnsubRef.current) revealUnsubRef.current();
      if (expiryRef.current) clearTimeout(expiryRef.current);
      const session = sessionRef.current;
      if (session?.eph) session.eph = null;
      if (session?.rid && !session?.imported && !session?.declined)
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
      declineMatch,
      resetSession,
      isEnded,
    }),
    [
      status,
      sas,
      errorMessage,
      submitCode,
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
