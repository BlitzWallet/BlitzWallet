import React, {
  createContext,
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
  decryptMnemonic,
  encryptMnemonic,
} from '../app/functions/handleMnemonic';
import { useGlobalContextProvider } from './context';
import { useAuthContext } from './authContext';
import { deriveAccountMnemonic } from '../app/functions/accounts/derivedAccounts';
import customUUID from '../app/functions/customUUID';
import isValidMnemonic from '../app/functions/isValidMnemonic';
import { useAppStatus } from './appStatus';
import { useTranslation } from 'react-i18next';

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
  const { accountMnemoinc } = useKeysContext();
  const [nostrSeed, setNostrSeed] = useState('');
  const [activeDerivedMnemonic, setActiveDerivedMnemonic] = useState(null);
  const hasSessionReset = useRef(false);
  const hasAutoRestoreCheckRun = useRef(false);
  const selectedAltAccount = custodyAccounts.filter(item => item.isActive);
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

  const toggleIsUsingNostr = value => {
    setIsUsingNostr(value);
  };
  useEffect(() => {
    async function initializeAccouts() {
      try {
        const accoutList = await getLocalStorageItem(
          CUSTODY_ACCOUNTS_STORAGE_KEY,
        ).then(data => JSON.parse(data) || []);

        const decryptedList = accoutList.map(item =>
          JSON.parse(decryptMnemonic(item, accountMnemoinc)),
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

          setLocalStorageItem(
            CUSTODY_ACCOUNTS_STORAGE_KEY,
            JSON.stringify(encriptAccountsList(clearedAccounts)),
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

  const encriptAccountsList = custodyAccounts => {
    return custodyAccounts.map(item =>
      encryptMnemonic(JSON.stringify(item), accountMnemoinc),
    );
  };

  const removeAccount = async account => {
    try {
      let accountInformation = JSON.parse(JSON.stringify(custodyAccounts));
      let newAccounts = accountInformation.filter(accounts => {
        return accounts.uuid !== account.uuid;
      });
      //   clear spark information here too. Delte txs from database, reove listeners
      await setLocalStorageItem(
        CUSTODY_ACCOUNTS_STORAGE_KEY,
        JSON.stringify(encriptAccountsList(newAccounts)),
      );
      setCustodyAccounts(newAccounts);
      return { didWork: true };
    } catch (err) {
      console.log('Remove account error', err);
      return { didWork: false, err: err.message };
    }
  };
  const createAccount = async accountInformation => {
    try {
      let savedAccountInformation = JSON.parse(JSON.stringify(custodyAccounts));

      savedAccountInformation.push(accountInformation);

      console.log(savedAccountInformation);
      await setLocalStorageItem(
        CUSTODY_ACCOUNTS_STORAGE_KEY,
        JSON.stringify(encriptAccountsList(savedAccountInformation)),
      );
      setCustodyAccounts(savedAccountInformation);
      return { didWork: true };
    } catch (err) {
      console.log('Create custody account error', err);
      return { didWork: false, err: err.message };
    }
  };

  const updateAccount = async account => {
    try {
      let accountInformation = JSON.parse(JSON.stringify(custodyAccounts));
      let newAccounts = accountInformation.map(accounts => {
        if (account.uuid === accounts.uuid) {
          return { ...accounts, ...account };
        } else return accounts;
      });

      await setLocalStorageItem(
        CUSTODY_ACCOUNTS_STORAGE_KEY,
        JSON.stringify(encriptAccountsList(newAccounts)),
      );
      setCustodyAccounts(newAccounts);
      return { didWork: true };
    } catch (err) {
      console.log('Remove account error', err);
      return { didWork: false, err: err.message };
    }
  };
  const updateAccountCacheOnly = async account => {
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
  };

  const createDerivedAccount = async accountName => {
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

      // Don't store the mnemonic, just metadata
      const accountInfo = {
        uuid: customUUID(),
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

      return { didWork: true };
    } catch (err) {
      console.log('Create derived account error', err);
      return { didWork: false, error: err.message };
    }
  };

  const createImportedAccount = async (accountName, importedSeed) => {
    try {
      if (!importedSeed || typeof importedSeed !== 'string') {
        return { didWork: false, error: 'Invalid seed provided' };
      }

      const words = importedSeed
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
      if (words.length !== 12 || !isValidMnemonic(words)) {
        return {
          didWork: false,
          error: 'Seed must be a valid 12-word recovery phrase',
        };
      }

      const accountInfo = {
        uuid: customUUID(),
        name: accountName,
        mnemoinc: words.join(' '),
        dateCreated: Date.now(),
        isActive: false,
        accountType: 'imported',
        profileEmoji: '',
      };

      await createAccount(accountInfo);
      // NO cloud backup for imported accounts (contains sensitive seed)
      return { didWork: true };
    } catch (err) {
      console.log('Create imported account error', err);
      return { didWork: false, error: err.message };
    }
  };

  const getAccountMnemonic = async account => {
    try {
      if (!account) throw new Error('No account provided');
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
  };

  const restoreDerivedAccountsFromCloud = async () => {
    try {
      // masterInfoObject is already loaded from Firebase by GlobalContextProvider
      const nextIndex = Number(
        masterInfoObject.nextAccountDerivationIndex || 3,
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
      for (let i = 3; i < nextIndex; i++) {
        if (existingDerivedIndexes.has(i)) continue;
        accountsToRestore.push({
          uuid: customUUID(),
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
        await setLocalStorageItem(
          CUSTODY_ACCOUNTS_STORAGE_KEY,
          JSON.stringify(encriptAccountsList(mergedAccounts)),
        );
        setCustodyAccounts(mergedAccounts);
      }

      console.log(`Restored ${accountsToRestore.length} derived account(s)`);
      return { didWork: true, accountsRestored: accountsToRestore.length };
    } catch (err) {
      console.log('Restore derived accounts error', err);
      return { didWork: false, error: err.message };
    }
  };

  useEffect(() => {
    async function restoreIfNeeded() {
      const cloudIndex = masterInfoObject?.nextAccountDerivationIndex;
      if (
        hasAutoRestoreCheckRun.current ||
        !accountMnemoinc ||
        custodyAccounts.length ||
        cloudIndex === undefined ||
        Number(cloudIndex) <= 0 ||
        !didGetToHomepage
      ) {
        return;
      }
      hasAutoRestoreCheckRun.current = true;
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

  return (
    <ActiveCustodyAccount.Provider
      value={{
        custodyAccounts,
        removeAccount,
        createAccount,
        updateAccount,
        updateAccountCacheOnly,
        createDerivedAccount,
        createImportedAccount,
        getAccountMnemonic,
        restoreDerivedAccountsFromCloud,
        selectedAltAccount,
        isUsingAltAccount,
        currentWalletMnemoinc,
        toggleIsUsingNostr,
        isUsingNostr,
        nostrSeed,
      }}
    >
      {children}
    </ActiveCustodyAccount.Provider>
  );
};

export const useActiveCustodyAccount = () => {
  return React.useContext(ActiveCustodyAccount);
};
