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
  NWC_SECURE_STORE_MNEMOINC,
  MAX_DERIVED_ACCOUNTS,
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

export const MAIN_ACCOUNT_UUID = 'MW09xd09d8f0a9sf2n332';
export const NWC_ACCOUNT_UUID = 'NWC038rsd0f8234ajsf';

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
  const lnurlSyncInFlight = useRef(false);
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

        setCustodyAccounts(decryptedList);
      } catch (err) {
        console.log('Custody account intialization error', err);
      }
    }

    console.log('Initializing accounts....');
    if (!accountMnemoinc) return;
    initializeAccouts();
  }, [accountMnemoinc]);

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

          const clearedAccounts = custodyAccounts.map(account => ({
            ...account,
            isActive: false,
          }));

          writeCustodyAccounts(clearedAccounts, accountMnemoinc).catch(err =>
            console.log('Session reset custody write failed', err),
          );

          setCustodyAccounts(clearedAccounts);
        }

        hasSessionReset.current = true;
      } catch (err) {
        console.log('Session reset error', err);
        hasSessionReset.current = true;
      }
    }

    clearActiveAccountsOnSessionStart();
  }, [custodyAccounts, accountMnemoinc]);

  const removeAccount = useCallback(
    async account => {
      try {
        const currentPins = masterInfoObject.pinnedAccounts || [];
        let accountInformation = JSON.parse(JSON.stringify(custodyAccounts));
        let newAccounts = accountInformation.filter(accounts => {
          return accounts.uuid !== account.uuid;
        });
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
        await writeCustodyAccounts(newAccounts, accountMnemoinc);
        setCustodyAccounts(newAccounts);
        return { didWork: true };
      } catch (err) {
        console.log('Remove account error', err);
        return { didWork: false, err: err.message };
      }
    },
    [
      custodyAccounts,
      masterInfoObject,
      publicKey,
      accountMnemoinc,
      toggleMasterInfoObject,
    ],
  );
  const createAccount = useCallback(
    async accountInformation => {
      try {
        let savedAccountInformation = JSON.parse(
          JSON.stringify(custodyAccounts),
        );

        savedAccountInformation.push(accountInformation);

        await writeCustodyAccounts(savedAccountInformation, accountMnemoinc);
        setCustodyAccounts(savedAccountInformation);
        return { didWork: true };
      } catch (err) {
        console.log('Create custody account error', err);
        return { didWork: false, err: err.message };
      }
    },
    [custodyAccounts, accountMnemoinc],
  );

  const updateAccount = useCallback(
    async account => {
      try {
        let accountInformation = JSON.parse(JSON.stringify(custodyAccounts));
        let newAccounts = accountInformation.map(accounts => {
          if (account.uuid === accounts.uuid) {
            return { ...accounts, ...account };
          } else return accounts;
        });

        await writeCustodyAccounts(newAccounts, accountMnemoinc);
        setCustodyAccounts(newAccounts);
        return { didWork: true };
      } catch (err) {
        console.log('Remove account error', err);
        return { didWork: false, err: err.message };
      }
    },
    [custodyAccounts, accountMnemoinc],
  );
  const updateAccountCacheOnly = useCallback(
    async account => {
      try {
        if (!account) throw new Error('No account selected');
        let accountInformation = JSON.parse(JSON.stringify(custodyAccounts));
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

        setCustodyAccounts(newAccounts);
        return { didWork: true };
      } catch (err) {
        console.log('Remove account error', err);
        return { didWork: false, err: err.message };
      }
    },
    [custodyAccounts, accountMnemoinc],
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

        await createAccount(accountInfo);

        // CRITICAL: Do NOT update nextAccountDerivationIndex
        // This is a restoration of an existing index, not a new sequential account

        return { didWork: true };
      } catch (err) {
        console.log('Restore derived account error', err);
        return { didWork: false, error: err.message };
      }
    },
    [
      masterInfoObject.nextAccountDerivationIndex,
      custodyAccounts,
      createAccount,
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
      // masterInfoObject is already loaded from Firebase by GlobalContextProvider
      const nextIndex = Math.min(
        Math.max(
          3,
          Math.floor(Number(masterInfoObject.nextAccountDerivationIndex || 3)),
        ),
        MAX_DERIVED_ACCOUNTS - 1,
      );

      if (!nextIndex || nextIndex === 0) {
        console.log('No derived accounts to restore');
        return { didWork: true, accountsRestored: 0 };
      }

      const existingDerivedIndexes = new Set(
        custodyAccounts
          .map(account => account.derivationIndex)
          .filter(index => typeof index === 'number'),
      );

      const accountsToRestore = [];
      for (let i = 4; i <= nextIndex; i++) {
        if (existingDerivedIndexes.has(i)) continue;
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
      }

      if (accountsToRestore.length) {
        const mergedAccounts = [...custodyAccounts, ...accountsToRestore];
        await writeCustodyAccounts(mergedAccounts, accountMnemoinc);
        setCustodyAccounts(mergedAccounts);
      }

      console.log(`Restored ${accountsToRestore.length} derived account(s)`);
      return { didWork: true, accountsRestored: accountsToRestore.length };
    } catch (err) {
      console.log('Restore derived accounts error', err);
      return { didWork: false, error: err.message };
    }
  }, [
    masterInfoObject.nextAccountDerivationIndex,
    custodyAccounts,
    accountMnemoinc,
    t,
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
      await setLocalStorageItem('hasRunAutoRestore', JSON.stringify(true));
      await restoreDerivedAccountsFromCloud();
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
    setCustodyAccounts([]);
    resetCustodyCryptoState();
    hasSessionReset.current = false;
    hasAutoRestoreCheckRun.current = false;
  }, [authResetkey]);

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
