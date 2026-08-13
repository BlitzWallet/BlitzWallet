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
  deletePairingHandshake,
  getPairingDoc,
  getPairingPointer,
  setPairingDoc,
  subscribePairingDoc,
  subscribePairingPointer,
} from '../db';
import { firebaseAuth } from '../db/initializeFirebase';

const PAIRING_TTL_MS = 180000; // 3 min, matches the handshake doc expiresAt rule.
// Written expiresAt = now + TTL - slack. The rule caps expiresAt at
// request.time + 180000, so a device clock even slightly fast would exceed the
// cap and be rules-denied. Subtracting slack keeps every write under the cap.
const PAIRING_SKEW_SLACK_MS = 10000;

// True iff a pointer describes a joinable live session (active, unexpired, with
// a sessionId + commit to derive against).
function isLivePointer(p) {
  return !!(
    p &&
    p.sessionId &&
    p.commit &&
    p.status === 'active' &&
    typeof p.expiresAt === 'number' &&
    p.expiresAt > Date.now()
  );
}

// Shared session for the child-side claim handshake. Owns the live Firestore
// listener, the ephemeral key + shared secret in memory, and TTL cleanup so the
// three claim screens can read/drive one session instead of each re-running it.
// This is the child mirror of childPairingContext.js: it reads the parent's
// pointer (by username) to learn the live sessionId + commit, writes childHello,
// listens for the grant, and imports the seed.
const ChildClaimContext = createContext(null);

export function ChildClaimProvider({ children }) {
  const { t } = useTranslation();
  const { setAccountMnemonic } = useKeysContext();

  // status: idle | joining | confirm | awaiting | done | error | expired
  const [status, setStatus] = useState('idle');
  const [sas, setSas] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const statusRef = useRef('idle');
  const sessionRef = useRef(null);
  const unsubRef = useRef(null);
  const cancelUnsubRef = useRef(null);
  const parentGoneUnsubRef = useRef(null);
  const revealUnsubRef = useRef(null);
  const expiryRef = useRef(null);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

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
    // read; TTL cleans up. Otherwise tear our own handshake docs down unless the
    // seed already landed.
    if (session?.rid && session?.sessionId && !session?.imported && !session?.declined) {
      await deletePairingHandshake(session.rid, session.sessionId);
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
        if (!rid) setErrorMessage(t('settings.childAccounts.claim.notFound'));
        return;
      }
      setErrorMessage('');
      setStatus('joining');

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
          if (!isLivePointer(pointer)) await new Promise(r => setTimeout(r, 800));
        }
        if (!isLivePointer(pointer)) {
          setStatus('idle');
          setErrorMessage(t('settings.childAccounts.claim.notFound'));
          return;
        }

        // Commit-reveal: we reveal childEphPub now; the parent reveals its own
        // pubkey afterwards. We only derive the shared secret + SAS once the
        // revealed pubkey matches the commitment, so a MITM can't grind keys.
        const eph = makeChildEphKey();

        // Join the live session's write-once childHello slot. A race remains: the
        // parent may replace the session (re-pair) between our pointer read and
        // our write, or a live squatter may win the slot first. On denial, re-read
        // the pointer — a changed sessionId means "rotate + retry"; an unchanged
        // one with a foreign childEphPub means a squatter (stop).
        let sessionId = null;
        for (let attempt = 0; attempt < 6; attempt++) {
          const candidate = pointer.sessionId;
          sessionRef.current = { rid, sessionId: candidate, eph, commit: pointer.commit };
          const didHello = await setPairingDoc(rid, candidate, 'childHello', {
            v: 1,
            childEphPub: eph.pub,
            childAuthUid: uid,
            expiresAt: Date.now() + PAIRING_TTL_MS - PAIRING_SKEW_SLACK_MS,
          });
          if (didHello) {
            sessionId = candidate;
            break;
          }
          // Denied. Distinguish rotation (retry) from squat (stop).
          const fresh = await getPairingPointer(rid);
          if (isLivePointer(fresh) && fresh.sessionId !== candidate) {
            pointer = fresh; // parent replaced the session — retry under the new id
            continue;
          }
          const existingHello = await getPairingDoc(rid, candidate, 'childHello');
          sessionRef.current = null;
          if (existingHello && existingHello.childEphPub !== eph.pub) {
            setErrorMessage(t('settings.childAccounts.claim.slotTaken'));
            setStatus('error');
            return;
          }
          throw new Error('Failed to join pairing session');
        }
        if (!sessionId) throw new Error('Failed to join pairing session');

        // Listen the whole session for the parent cancelling so we don't hang
        // waiting on the grant until the TTL expires.
        cancelUnsubRef.current = subscribePairingDoc(
          rid,
          sessionId,
          'cancel',
          () => {
            const s = sessionRef.current;
            if (!s || s.imported || s.declined) return;
            setErrorMessage(t('settings.childAccounts.claim.canceledByParent'));
            setStatus('error');
          },
        );

        // Watch the pointer: if the parent replaces the session (new sessionId),
        // marks it terminal (grant/decline/expiry), or deletes it, the session we
        // joined is gone — surface expiry instead of hanging on the SAS screen.
        parentGoneUnsubRef.current = subscribePairingPointer(rid, data => {
          const s = sessionRef.current;
          if (!s || s.imported || s.declined) return;
          // Once we've derived sharedX (past SAS, awaiting the grant), the parent
          // marks the pointer terminal immediately AFTER writing the grant so it
          // can re-pair — that terminal is the normal success path, not an
          // expiry, and the grant doc is still arriving. Snapshot ordering across
          // the two listeners isn't guaranteed, so don't treat terminal as fatal
          // here; importSeed flips s.imported when the grant lands.
          if (s.sharedX && data?.status === 'terminal') return;
          if (!data || data.sessionId !== sessionId || data.status === 'terminal') {
            setStatus('expired');
          }
        });

        // Wait for the parent to reveal its ephemeral pubkey, verify it against
        // the commitment, then compute the SAS.
        revealUnsubRef.current = subscribePairingDoc(
          rid,
          sessionId,
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
        console.log('child claim name error', err);
        setStatus('idle');
        setErrorMessage(t('settings.childAccounts.claim.notFound'));
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
    // advance — the mirror of the child waiting on the parent's grant doc.
    await setPairingDoc(session.rid, session.sessionId, 'childConfirm', {
      v: 1,
      expiresAt: Date.now() + PAIRING_TTL_MS - PAIRING_SKEW_SLACK_MS,
    });

    unsubRef.current = subscribePairingDoc(
      session.rid,
      session.sessionId,
      'grant',
      grant => {
        if (grant?.ciphertext) importSeed(grant);
      },
    );
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
  }, [importSeed]);

  const declineMatch = useCallback(async () => {
    const session = sessionRef.current;
    if (session?.rid && session?.sessionId && !session?.imported) {
      session.declined = true; // guards our own cancel listener + skips doc delete
      await setPairingDoc(session.rid, session.sessionId, 'cancel', {
        v: 1,
        expiresAt: Date.now() + PAIRING_TTL_MS - PAIRING_SKEW_SLACK_MS,
      });
    }
    await resetSession();
  }, [resetSession]);

  useEffect(() => {
    return () => {
      // On unmount (flow popped off the stack): tear down the listeners and
      // delete our own handshake docs unless the grant was already imported.
      if (unsubRef.current) unsubRef.current();
      if (cancelUnsubRef.current) cancelUnsubRef.current();
      if (parentGoneUnsubRef.current) parentGoneUnsubRef.current();
      if (revealUnsubRef.current) revealUnsubRef.current();
      if (expiryRef.current) clearTimeout(expiryRef.current);
      const session = sessionRef.current;
      if (session?.eph) session.eph = null;
      if (session?.rid && session?.sessionId && !session?.imported && !session?.declined)
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
