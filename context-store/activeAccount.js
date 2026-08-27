import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  getLocalStorageItem,
  retrieveData,
  setLocalStorageItem,
} from '../app/functions';
import {
  CUSTODY_ACCOUNTS_STORAGE_KEY,
  CUSTODY_ACCOUNT_NAMES_KEY,
  NWC_SECURE_STORE_MNEMOINC,
  MAX_DERIVED_ACCOUNTS,
  MAIN_ACCOUNT_UUID,
  NWC_ACCOUNT_UUID,
} from '../app/constants';
import { useKeysContext } from './keys';
import {
  loadCustodyAccounts,
  writeCustodyAccounts,
  resetCustodyCryptoState,
} from '../app/functions/custodyAccountsCrypto';
import { useGlobalContextProvider } from './context';
import { useAuthContext } from './authContext';
import {
  deriveAccountMnemonic,
  generateAccountUuid,
} from '../app/functions/accounts/derivedAccounts';
import { deriveChildMnemonic } from '../app/functions/accounts/childAccounts';
import { assignLnurlId } from '../app/functions/accounts/assignLnurlId';
import { deriveSparkIdentityKey } from '../app/functions/gift/deriveGiftWallet';
import { deleteLnurlRegistryEntry } from '../db';
import { useAppStatus } from './appStatus';
import { useTranslation } from 'react-i18next';

// One-time migration: accounts created before deterministic ids carried a
// random customUUID() id, which no longer matches after restoring a seed on a
// new device and breaks accountsLnurl registry matching. Rewrite each
// account's uuid to the first 16 hex chars of its Spark identity pubkey (the
// same scheme new accounts use). Gated by a localStorage flag so launch never
// pays the key-derivation cost more than once. accountsLnurl itself is left
// alone (unreleased feature).
async function migrateToDeterministicUuids(accounts, masterSeed) {
  try {
    const hasMigrated = await getLocalStorageItem(
      'hasRunDeterministicUuidMigration',
    );
    if (JSON.parse(hasMigrated)) return accounts;
    let didChange = false;
    let hadFailure = false;
    const migrated = [];
    for (const account of accounts) {
      try {
        const mnemonic =
          account.mnemoinc ||
          (account.derivationIndex !== undefined
            ? await deriveAccountMnemonic(masterSeed, account.derivationIndex)
            : null);
        if (!mnemonic) {
          migrated.push(account);
          continue;
        }
        const uuid = await generateAccountUuid(mnemonic);
        if (uuid === account.uuid) {
          migrated.push(account);
          continue;
        }
        didChange = true;
        migrated.push({ ...account, uuid });
      } catch (err) {
        // One bad account must not wedge the batch: keep it unchanged and
        // skip the completion flag so it retries on the next launch.
        console.log(
          `Deterministic UUID migration failed for account ${account.uuid}`,
          err,
        );
        hadFailure = true;
        migrated.push(account);
      }
    }

    if (didChange) await writeCustodyAccounts(migrated, masterSeed);
    if (!hadFailure) {
      await setLocalStorageItem(
        'hasRunDeterministicUuidMigration',
        JSON.stringify(true),
      );
    }
    return didChange ? migrated : accounts;
  } catch (err) {
    console.log('Deterministic account UUID migration error', err);
    return accounts;
  }
}

// Cloud-restore derivations are yielded back to the JS thread every this many
// accounts so an inflated nextAccountDerivationIndex can't monopolize the
// event loop and freeze the UI.
const RESTORE_BATCH_SIZE = 10;

// Create a context for the WebView ref
const ActiveCustodyAccount = createContext(null);

export const ActiveCustodyAccountProvider = ({ children }) => {
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { didGetToHomepage } = useAppStatus();
  const { authResetkey } = useAuthContext();
  const { t } = useTranslation();
  const [custodyAccounts, setCustodyAccounts] = useState([]);
  const [isUsingNostr, setIsUsingNostr] = useState(false);
  const { accountMnemoinc, publicKey } = useKeysContext();
  const [nostrSeed, setNostrSeed] = useState('');
  const [activeDerivedMnemonic, setActiveDerivedMnemonic] = useState(null);
  const hasSessionReset = useRef(false);
  const hasAutoRestoreCheckRun = useRef(false);
  // True only after initializeAccouts decrypted the store on disk (or found it
  // empty). Cloud restore refuses to run against an unloaded list so an empty
  // in-memory ref can't be mistaken for "nothing on disk".
  const hasLoadedCustodyAccountsRef = useRef(false);
  // Latest known account list. State is only ever set through setAccounts, so
  // persisted mutations base on this ref instead of a stale render closure.
  const custodyAccountsRef = useRef([]);
  // Serializes persisted list mutations (create / remove / update / session
  // reset / auto-restore): each waits for the previous write, so concurrent
  // mutations can't read-modify-write the same base list and drop an account.
  const custodyWriteQueue = useRef(Promise.resolve());
  const lnurlSyncInFlight = useRef(false);
  // Indices with a restoreDerivedAccount derivation in flight. Concurrent
  // callers share one stale custodyAccounts closure, so the existence check
  // alone can't stop a same-index race from duplicating derivations/writes.
  const restoresInFlight = useRef(new Set());
  // After a fast-failing registry write the rollback re-triggers this effect
  // (accountsLnurl dep), which would spin on derived-pubkey derivation + retry.
  // Cooldown breaks the tight loop; a later account/doc change retries.
  const lnurlSyncCooldownRef = useRef(0);
  const selectedAltAccount = useMemo(
    () => custodyAccounts.filter(item => item.isActive),
    [custodyAccounts],
  );
  const didSelectAltAccount = !!selectedAltAccount.length;
  const isInitialRender = useRef(true);
  const enabledNWC = masterInfoObject.didViewNWCMessage;

  useEffect(() => {
    if (nostrSeed.length || !enabledNWC) return;
    async function getNostrSeed() {
      const NWCMnemoinc = (await retrieveData(NWC_SECURE_STORE_MNEMOINC)).value;
      if (!NWCMnemoinc) return;
      setNostrSeed(NWCMnemoinc);
    }
    getNostrSeed();
  }, [nostrSeed, enabledNWC]);

  const toggleIsUsingNostr = useCallback(value => {
    setIsUsingNostr(value);
  }, []);

  const setAccounts = useCallback(next => {
    custodyAccountsRef.current = next;
    setCustodyAccounts(next);
  }, []);

  // Run one persisted mutation at a time. The mutator receives the freshest
  // list and may return null to skip the write (nothing to change).
  const queueCustodyWrite = useCallback(
    mutator => {
      const task = async () => {
        const next = await mutator(custodyAccountsRef.current);
        if (!next) return custodyAccountsRef.current;
        await writeCustodyAccounts(next, accountMnemoinc);
        setAccounts(next);
        return next;
      };
      const result = custodyWriteQueue.current.then(task, task);
      custodyWriteQueue.current = result.catch(() => {});
      return result;
    },
    [accountMnemoinc, setAccounts],
  );
  useEffect(() => {
    async function initializeAccouts() {
      try {
        const accoutList = await getLocalStorageItem(
          CUSTODY_ACCOUNTS_STORAGE_KEY,
        );
        // loadCustodyAccounts decrypts v3 envelopes with the seed-derived key
        // and lazily migrates legacy EvpKDF lists (fails closed, never
        // overwrites unreadable data).
        let decryptedList = await loadCustodyAccounts(
          accoutList,
          accountMnemoinc,
        );
        decryptedList = await migrateToDeterministicUuids(
          decryptedList,
          accountMnemoinc,
        );

        setAccounts(decryptedList);
        hasLoadedCustodyAccountsRef.current = true;
      } catch (err) {
        console.log('Custody account intialization error', err);
      }
    }

    console.log('Initializing accounts....');
    if (!accountMnemoinc) return;
    initializeAccouts();
  }, [accountMnemoinc, setAccounts]);

  // Clear active account once per session to sync with default accountMnemonic
  useEffect(() => {
    if (!custodyAccounts.length || hasSessionReset.current || !accountMnemoinc)
      return;

    async function clearActiveAccountsOnSessionStart() {
      try {
        const hasActiveAccounts = custodyAccounts.some(
          account => account.isActive,
        );

        if (hasActiveAccounts) {
          console.log('Clearing active accounts for session sync...');

          queueCustodyWrite(current => {
            if (!current.some(account => account.isActive)) return null;
            return current.map(account => ({ ...account, isActive: false }));
          }).catch(err =>
            console.log('Session reset custody write failed', err),
          );
        }

        hasSessionReset.current = true;
      } catch (err) {
        console.log('Session reset error', err);
        hasSessionReset.current = true;
      }
    }

    clearActiveAccountsOnSessionStart();
  }, [custodyAccounts, accountMnemoinc, queueCustodyWrite]);

  const removeAccount = useCallback(
    async account => {
      try {
        const currentPins = masterInfoObject.pinnedAccounts || [];
        const isPinned = currentPins.includes(account.uuid);
        if (isPinned) {
          // clear from pinned list
          toggleMasterInfoObject({
            pinnedAccounts: currentPins.filter(id => id !== account.uuid),
          });
        }
        // Prune the imported account's registry entry: it pins the account's
        // spark identity pubkey server-side, and merge-writes can't remove a map
        // key. Derived/child entries are re-derivable, so only imported accounts
        // carry an unrecoverable seed worth pruning.
        if (account.mnemoinc) {
          const registry = masterInfoObject.accountsLnurl || {};
          const hit = Object.entries(registry).find(
            ([, v]) => v.uuid === account.uuid,
          );
          if (hit) {
            // Gate local removal on a confirmed prune: the imported seed only
            // lives in the custody store, so destroying it while the address is
            // still live server-side would strand inbound payments.
            const pruned = await deleteLnurlRegistryEntry(publicKey, hit[0]);
            if (!pruned) {
              return {
                didWork: false,
                err: 'Could not remove the account address. Please try again.',
              };
            }
          }
        }
        //   clear spark information here too. Delte txs from database, reove listeners
        await queueCustodyWrite(current =>
          current.filter(item => item.uuid !== account.uuid),
        );
        return { didWork: true };
      } catch (err) {
        console.log('Remove account error', err);
        return { didWork: false, err: err.message };
      }
    },
    [masterInfoObject, publicKey, toggleMasterInfoObject, queueCustodyWrite],
  );
  const createAccount = useCallback(
    async accountInformation => {
      try {
        await queueCustodyWrite(current => [...current, accountInformation]);
        return { didWork: true };
      } catch (err) {
        console.log('Create custody account error', err);
        return { didWork: false, err: err.message };
      }
    },
    [queueCustodyWrite],
  );

  const updateAccount = useCallback(
    async account => {
      try {
        await queueCustodyWrite(current =>
          current.map(item =>
            item.uuid === account.uuid ? { ...item, ...account } : item,
          ),
        );
        return { didWork: true };
      } catch (err) {
        console.log('Remove account error', err);
        return { didWork: false, err: err.message };
      }
    },
    [queueCustodyWrite],
  );
  const updateAccountCacheOnly = useCallback(
    async account => {
      try {
        if (!account) throw new Error('No account selected');
        let accountInformation = JSON.parse(
          JSON.stringify(custodyAccountsRef.current),
        );
        let newAccounts = accountInformation.map(accounts => {
          if (account.uuid === accounts.uuid) {
            return { ...accounts, ...account };
          } else return { ...accounts, isActive: false };
        });

        if (account.isActive && typeof account.derivationIndex === 'number') {
          const derivedMnemonic = await deriveAccountMnemonic(
            accountMnemoinc,
            account.derivationIndex,
          );
          setActiveDerivedMnemonic(derivedMnemonic);
        } else {
          setActiveDerivedMnemonic(null);
        }

        setAccounts(newAccounts);
        return { didWork: true };
      } catch (err) {
        console.log('Remove account error', err);
        return { didWork: false, err: err.message };
      }
    },
    [accountMnemoinc, setAccounts],
  );

  const createDerivedAccount = useCallback(
    async accountName => {
      try {
        const nextCloudIndex = masterInfoObject.nextAccountDerivationIndex || 3;

        const nextIndex = nextCloudIndex + 1;

        // Enforce hard cap to prevent overlap with gifts range (starts at index 1000)
        if (nextIndex >= MAX_DERIVED_ACCOUNTS) {
          return {
            didWork: false,
            error: `Maximum of ${MAX_DERIVED_ACCOUNTS} accounts reached. Please delete unused accounts.`,
          };
        }

        // Don't store the mnemonic, just metadata. The uuid is derived from
        // the account's Spark identity pubkey so it survives seed restores
        // and keeps matching the accountsLnurl registry.
        const derivedMnemonic = await deriveAccountMnemonic(
          accountMnemoinc,
          nextIndex,
        );
        const accountInfo = {
          uuid: await generateAccountUuid(derivedMnemonic),
          name: accountName,
          derivationIndex: nextIndex,
          dateCreated: Date.now(),
          isActive: false,
          accountType: 'derived',
          profileEmoji: '',
        };

        await createAccount(accountInfo);

        // Update masterInfoObject with new index (automatically syncs to Firebase)
        await toggleMasterInfoObject({
          nextAccountDerivationIndex: nextIndex,
        });

        return { didWork: true, uuid: accountInfo.uuid };
      } catch (err) {
        console.log('Create derived account error', err);
        return { didWork: false, error: err.message };
      }
    },
    [
      masterInfoObject.nextAccountDerivationIndex,
      createAccount,
      toggleMasterInfoObject,
      accountMnemoinc,
    ],
  );

  const restoreDerivedAccount = useCallback(
    async (accountName, derivationIndex) => {
      // Declared out here so the finally clause can see it (the try block is
      // its own scope) and so early validation returns skip the release.
      let ownsRestoreLock = false;
      try {
        // Validation #1: Type check
        if (
          typeof derivationIndex !== 'number' ||
          !Number.isInteger(derivationIndex)
        ) {
          return {
            didWork: false,
            error: 'Derivation index must be a whole number',
          };
        }

        // Validation #2: Range check (minimum)
        if (derivationIndex < 3) {
          return {
            didWork: false,
            error:
              'Derivation index must be 3 or higher (indices 0-2 are reserved)',
          };
        }

        // Validation #3: Range check (maximum - gifts boundary)
        if (derivationIndex >= MAX_DERIVED_ACCOUNTS) {
          return {
            didWork: false,
            error: `Derivation index must be less than ${MAX_DERIVED_ACCOUNTS} (gift wallet range)`,
          };
        }

        // Validation #4: Check against nextAccountDerivationIndex
        const nextCloudIndex = masterInfoObject.nextAccountDerivationIndex || 3;
        if (derivationIndex > nextCloudIndex) {
          return {
            didWork: false,
            error: `Cannot restore index ${derivationIndex}. Highest created account is ${
              nextCloudIndex - 1
            }`,
          };
        }

        // Validation #5: Check if account already exists (idempotency)
        const existingAccount = custodyAccounts.find(
          acc => acc.derivationIndex === derivationIndex,
        );
        if (existingAccount) {
          return {
            didWork: false,
            error: `Account at index ${derivationIndex} already exists: "${existingAccount.name}"`,
          };
        }

        // Concurrent invocations pass validation #5 against the same stale
        // list, so gate the expensive derivation per index and re-check
        // inside the serialized write (same pattern as the cloud restore).
        ownsRestoreLock = !restoresInFlight.current.has(derivationIndex);
        if (!ownsRestoreLock) {
          return { didWork: false, error: 'Restore already in progress' };
        }
        restoresInFlight.current.add(derivationIndex);

        // Create account with EXACT same structure as auto-restore. The uuid
        // is derived from the account's Spark identity pubkey so it matches
        // the id a fresh restore on another device would generate.
        const derivedMnemonic = await deriveAccountMnemonic(
          accountMnemoinc,
          derivationIndex,
        );
        const accountInfo = {
          uuid: await generateAccountUuid(derivedMnemonic),
          name: accountName,
          derivationIndex: derivationIndex,
          dateCreated: Date.now(),
          isActive: false,
          accountType: 'derived',
          profileEmoji: '',
        };

        await queueCustodyWrite(current => {
          const alreadyExists = current.some(
            acc => acc.derivationIndex === derivationIndex,
          );
          if (alreadyExists) return null;
          return [...current, accountInfo];
        });

        // CRITICAL: Do NOT update nextAccountDerivationIndex
        // This is a restoration of an existing index, not a new sequential account

        return { didWork: true };
      } catch (err) {
        console.log('Restore derived account error', err);
        return { didWork: false, error: err.message };
      } finally {
        // Only the caller that acquired the lock may release it: rejected
        // concurrent callers exit through this finally too.
        if (ownsRestoreLock) restoresInFlight.current.delete(derivationIndex);
      }
    },
    [
      masterInfoObject.nextAccountDerivationIndex,
      custodyAccounts,
      queueCustodyWrite,
      accountMnemoinc,
    ],
  );

  const getAccountMnemonic = useCallback(
    async account => {
      try {
        if (!account) throw new Error('No account provided');
        // Linked (child) accounts derive from the parent seed via childIndex.
        if (account.childIndex !== undefined) {
          return await deriveChildMnemonic(accountMnemoinc, account.childIndex);
        }
        // For derived accounts, re-derive on demand from main seed
        if (account.derivationIndex !== undefined) {
          const derivedMnemonic = await deriveAccountMnemonic(
            accountMnemoinc,
            account.derivationIndex,
          );
          return derivedMnemonic;
        }
        // For imported accounts, return stored mnemonic
        return account.mnemoinc;
      } catch (err) {
        console.log('Get account mnemonic error', err);
        throw err;
      }
    },
    [accountMnemoinc],
  );

  const restoreDerivedAccountsFromCloud = useCallback(async () => {
    try {
      // nextAccountDerivationIndex comes from Firebase and is untrusted
      // (Firebase compromise or a sync bug could inflate it). Validate it
      // against the decrypted store on disk before entering the derivation
      // loop: refuse to run until the disk list is loaded, reject values
      // outside the derivation range instead of clamping them, and enumerate
      // the indexes actually missing from disk up front so no key derivation
      // happens unless the store genuinely has gaps.
      if (!hasLoadedCustodyAccountsRef.current) {
        console.log('Cloud restore skipped: disk account list not loaded yet');
        return { didWork: false, error: 'Account list not loaded yet' };
      }

      const cloudIndex = Number(
        masterInfoObject.nextAccountDerivationIndex || 3,
      );
      const isValidIndex =
        Number.isInteger(cloudIndex) &&
        cloudIndex >= 3 &&
        cloudIndex <= MAX_DERIVED_ACCOUNTS - 1;
      if (!isValidIndex) {
        console.log(
          'Cloud restore skipped: invalid nextAccountDerivationIndex',
          masterInfoObject.nextAccountDerivationIndex,
        );
        return { didWork: false, error: 'Invalid nextAccountDerivationIndex' };
      }

      const existingDerivedIndexes = new Set(
        custodyAccountsRef.current
          .map(account => account.derivationIndex)
          .filter(index => typeof index === 'number'),
      );

      const missingIndexes = [];
      for (let i = 4; i <= cloudIndex; i++) {
        if (!existingDerivedIndexes.has(i)) missingIndexes.push(i);
      }
      if (!missingIndexes.length) {
        console.log('No derived accounts to restore');
        return { didWork: true, accountsRestored: 0 };
      }

      const accountsToRestore = [];
      let processedInBatch = 0;
      for (const i of missingIndexes) {
        const derivedMnemonic = await deriveAccountMnemonic(accountMnemoinc, i);
        accountsToRestore.push({
          uuid: await generateAccountUuid(derivedMnemonic),
          name: t('accountCard.fallbackAccountName', { index: i }),
          derivationIndex: i,
          dateCreated: Date.now(),
          accountType: 'derived',
          isActive: false,
          profileEmoji: '',
        });
        processedInBatch += 1;
        if (
          processedInBatch === RESTORE_BATCH_SIZE &&
          accountsToRestore.length < missingIndexes.length
        ) {
          // Yield to the event loop between batches so a large backlog
          // (corrupted cloud index restoring ~MAX_DERIVED_ACCOUNTS wallets)
          // can't freeze the UI in a single tick.
          processedInBatch = 0;
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      let accountsRestored = 0;
      if (accountsToRestore.length) {
        await queueCustodyWrite(current => {
          // Re-filter against the freshest list: a concurrent create/restore
          // may have added one of these indexes while deriving above.
          const existing = new Set(
            current
              .map(account => account.derivationIndex)
              .filter(index => typeof index === 'number'),
          );
          const toAdd = accountsToRestore.filter(
            account => !existing.has(account.derivationIndex),
          );
          if (!toAdd.length) return null;
          accountsRestored = toAdd.length;
          return [...current, ...toAdd];
        });
      }

      console.log(`Restored ${accountsRestored} derived account(s)`);
      return { didWork: true, accountsRestored };
    } catch (err) {
      console.log('Restore derived accounts error', err);
      return { didWork: false, error: err.message };
    }
  }, [
    masterInfoObject.nextAccountDerivationIndex,
    accountMnemoinc,
    t,
    queueCustodyWrite,
  ]);

  useEffect(() => {
    async function restoreIfNeeded() {
      const cloudIndex = masterInfoObject?.nextAccountDerivationIndex;
      const hasRunRestore = await getLocalStorageItem('hasRunAutoRestore').then(
        data => JSON.parse(data),
      );

      if (hasAutoRestoreCheckRun.current) return;
      if (!accountMnemoinc) return;
      if (cloudIndex === undefined) return;
      if (Number(cloudIndex) <= 0) return;
      if (!didGetToHomepage) return;
      if (hasRunRestore) return;

      if (custodyAccounts.length > 0) {
        hasAutoRestoreCheckRun.current = true;
        await setLocalStorageItem('hasRunAutoRestore', JSON.stringify(true));
        return;
      }

      console.log('Running auto-restore of derived accounts from cloud...');
      hasAutoRestoreCheckRun.current = true;
      const result = await restoreDerivedAccountsFromCloud();
      // Latch the one-time flag only after a successful restore: an
      // interrupted run (killed app, failed write) must retry on the next
      // launch instead of permanently disabling auto-restore.
      if (result?.didWork) {
        await setLocalStorageItem('hasRunAutoRestore', JSON.stringify(true));
      } else {
        hasAutoRestoreCheckRun.current = false;
      }
    }

    restoreIfNeeded();
  }, [accountMnemoinc, custodyAccounts, masterInfoObject, didGetToHomepage]);

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    setNostrSeed('');
    setIsUsingNostr(false);
    setActiveDerivedMnemonic(null);
    setAccounts([]);
    resetCustodyCryptoState();
    // Drop any queued/pending persisted writes: they captured the previous
    // seed and must not chain onto post-reset writes.
    custodyWriteQueue.current = Promise.resolve();
    hasSessionReset.current = false;
    hasAutoRestoreCheckRun.current = false;
    hasLoadedCustodyAccountsRef.current = false;
  }, [authResetkey, setAccounts]);

  const currentWalletMnemoinc = useMemo(() => {
    if (didSelectAltAccount) {
      const activeAccount = selectedAltAccount[0];
      // For derived accounts, we'll need to derive the mnemonic
      // But for backwards compatibility, check if mnemoinc exists first
      if (activeAccount.mnemoinc) {
        return activeAccount.mnemoinc; // Imported account
      }
      return activeDerivedMnemonic || accountMnemoinc;
    } else if (isUsingNostr) {
      return nostrSeed;
    } else {
      return accountMnemoinc;
    }
  }, [
    accountMnemoinc,
    selectedAltAccount,
    didSelectAltAccount,
    isUsingNostr,
    nostrSeed,
    activeDerivedMnemonic,
  ]);

  const isUsingAltAccount = didSelectAltAccount || isUsingNostr;

  const custodyAccountsList = useMemo(() => {
    const mainWalletName = masterInfoObject.isChildAccount
      ? t('settings.accounts.managedWalletPlace')
      : t('settings.accounts.mainWalletPlace');

    return enabledNWC
      ? [
          {
            name: mainWalletName,
            mnemoinc: accountMnemoinc,
            accountType: 'main',
            uuid: MAIN_ACCOUNT_UUID,
          },
          {
            name: t('settings.accounts.nwcWalletPlace'),
            mnemoinc: nostrSeed,
            accountType: 'nwc',
            uuid: NWC_ACCOUNT_UUID,
          },
          ...custodyAccounts,
        ]
      : [
          {
            name: mainWalletName,
            mnemoinc: accountMnemoinc,
            accountType: 'main',
            uuid: MAIN_ACCOUNT_UUID,
          },
          ...custodyAccounts,
        ];
  }, [
    accountMnemoinc,
    custodyAccounts,
    enabledNWC,
    masterInfoObject.isChildAccount,
    nostrSeed,
    t,
  ]);

  // Mirror decrypted account names to a plaintext uuid → name map so the
  // background push handler can label sub-account payments without the master
  // seed (loadCustodyAccounts needs it and can't run in the background). Only
  // names are cached — never seeds.
  useEffect(() => {
    try {
      const nameMap = {};
      for (const acct of custodyAccountsList) {
        if (acct?.uuid) nameMap[acct.uuid] = acct.name;
      }
      setLocalStorageItem(CUSTODY_ACCOUNT_NAMES_KEY, JSON.stringify(nameMap));
    } catch (err) {
      console.log('error updating custody account keymap', err);
    }
  }, [custodyAccountsList]);

  // Publish a per-account LNURL address registry into the user doc so the proxy
  // can mint invoices against each sub-account's own Spark identity key. Additive
  // only: existing entries are never rewritten (published addresses stay stable),
  // main is excluded (its plain address stays canonical), child/linked accounts
  // aren't in custodyAccountsList so they're untouched.
  // ponytail: additive-only sync, prune orphans later if it matters
  useEffect(() => {
    if (!accountMnemoinc || !didGetToHomepage) return;
    if (lnurlSyncInFlight.current) return;
    if (Date.now() < lnurlSyncCooldownRef.current) return;

    const registry = masterInfoObject.accountsLnurl || {};
    const knownUuids = new Set(Object.values(registry).map(v => v.uuid));
    const missing = custodyAccountsList.filter(
      a => a.uuid !== MAIN_ACCOUNT_UUID && !knownUuids.has(a.uuid),
    );
    if (!missing.length) return;

    lnurlSyncInFlight.current = true;
    (async () => {
      try {
        const next = { ...registry };
        let added = false;
        for (const acct of missing) {
          const mnemonic = await getAccountMnemonic(acct);
          if (!mnemonic) continue; // e.g. NWC before nostrSeed loads
          const pubkey = (
            await deriveSparkIdentityKey(mnemonic, 1)
          )?.publicKeyHex?.toLowerCase();
          if (!pubkey) continue;
          // Same pubkey already registered (duplicate-mnemonic import): reuse
          // that entry instead of assigning a colliding id that would overwrite
          // the sibling and flip its uuid mapping.
          if (Object.values(next).some(v => v.identityPubKey === pubkey))
            continue;
          const id = assignLnurlId(pubkey, next);
          next[id] = {
            uuid: acct.uuid,
            identityPubKey: pubkey,
            receiveCurrency: 'btc',
          };
          added = true;
        }
        if (added) {
          const didWrite = await toggleMasterInfoObject({
            accountsLnurl: next,
          });
          // Failed write: roll the optimistic add back so the entry isn't
          // masked until the next launch — the next tick then retries.
          if (!didWrite) {
            toggleMasterInfoObject({ accountsLnurl: registry }, false);
            lnurlSyncCooldownRef.current = Date.now() + 60_000;
          }
        }
      } catch (err) {
        console.log('LNURL account sync error', err);
      } finally {
        lnurlSyncInFlight.current = false;
      }
    })();
  }, [
    accountMnemoinc,
    didGetToHomepage,
    custodyAccountsList,
    masterInfoObject.accountsLnurl,
  ]);

  const activeAccount = useMemo(() => {
    const activeAltAccount = selectedAltAccount[0];
    return custodyAccountsList.find(account => {
      const isMainWallet = account.uuid === MAIN_ACCOUNT_UUID;
      const isNWC = account.uuid === NWC_ACCOUNT_UUID;
      const isActive = isNWC
        ? isUsingNostr
        : isMainWallet
        ? !activeAltAccount && !isUsingNostr
        : activeAltAccount?.uuid === account.uuid;
      return isActive;
    });
  }, [custodyAccountsList, isUsingNostr, selectedAltAccount]);

  const accountValues = useMemo(() => {
    return {
      custodyAccounts,
      removeAccount,
      createAccount,
      updateAccount,
      updateAccountCacheOnly,
      createDerivedAccount,
      restoreDerivedAccount,
      getAccountMnemonic,
      restoreDerivedAccountsFromCloud,
      selectedAltAccount,
      isUsingAltAccount,
      currentWalletMnemoinc,
      toggleIsUsingNostr,
      isUsingNostr,
      nostrSeed,
      activeAccount,
      custodyAccountsList,
    };
  }, [
    custodyAccounts,
    removeAccount,
    createAccount,
    updateAccount,
    updateAccountCacheOnly,
    createDerivedAccount,
    restoreDerivedAccount,
    getAccountMnemonic,
    restoreDerivedAccountsFromCloud,
    selectedAltAccount,
    isUsingAltAccount,
    currentWalletMnemoinc,
    toggleIsUsingNostr,
    isUsingNostr,
    nostrSeed,
    activeAccount,
    custodyAccountsList,
  ]);

  return (
    <ActiveCustodyAccount.Provider value={accountValues}>
      {children}
    </ActiveCustodyAccount.Provider>
  );
};

export const useActiveCustodyAccount = () => {
  return React.useContext(ActiveCustodyAccount);
};
