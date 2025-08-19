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
} from '../app/constants';
import {useKeysContext} from './keys';
import {
  decryptMnemonic,
  encryptMnemonic,
} from '../app/functions/handleMnemonic';
import {useGlobalContextProvider} from './context';

// Create a context for the WebView ref
const ActiveCustodyAccount = createContext(null);

export const ActiveCustodyAccountProvider = ({children}) => {
  const {masterInfoObject} = useGlobalContextProvider();
  const [custodyAccounts, setCustodyAccounts] = useState([]);
  const [isUsingNostr, setIsUsingNostr] = useState(false);
  const {accountMnemoinc} = useKeysContext();
  const [nostrSeed, setNostrSeed] = useState('');
  const hasSessionReset = useRef(false);
  const selectedAltAccount = custodyAccounts.filter(item => item.isActive);
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
      return {didWork: true};
    } catch (err) {
      console.log('Remove account error', err);
      return {didWork: false, err: err.message};
    }
  };
  const createAccount = async accountInformation => {
    try {
      let savedAccountInformation = JSON.parse(JSON.stringify(custodyAccounts));

      savedAccountInformation.push(accountInformation);

      console.log(savedAccountInformation);
      await setLocalStorageItem(
        CUSTODY_ACCOUNTS_STORAGE_KEY,
        JSON.stringify(
          encriptAccountsList(savedAccountInformation),
          accountMnemoinc,
        ),
      );
      setCustodyAccounts(savedAccountInformation);
      return {didWork: true};
    } catch (err) {
      console.log('Create custody account error', err);
      return {didWork: false, err: err.message};
    }
  };

  const updateAccount = async account => {
    try {
      let accountInformation = JSON.parse(JSON.stringify(custodyAccounts));
      let newAccounts = accountInformation.map(accounts => {
        if (account.uuid === accounts.uuid) {
          return {...accounts, ...account};
        } else return accounts;
      });

      await setLocalStorageItem(
        CUSTODY_ACCOUNTS_STORAGE_KEY,
        JSON.stringify(encriptAccountsList(newAccounts), accountMnemoinc),
      );
      setCustodyAccounts(newAccounts);
      return {didWork: true};
    } catch (err) {
      console.log('Remove account error', err);
      return {didWork: false, err: err.message};
    }
  };
  const updateAccountCacheOnly = async account => {
    try {
      if (!account) throw new Error('No account selected');
      let accountInformation = JSON.parse(JSON.stringify(custodyAccounts));
      let newAccounts = accountInformation.map(accounts => {
        if (account.uuid === accounts.uuid) {
          return {...accounts, ...account};
        } else return {...accounts, isActive: false};
      });

      setCustodyAccounts(newAccounts);
      return {didWork: true};
    } catch (err) {
      console.log('Remove account error', err);
      return {didWork: false, err: err.message};
    }
  };

  const currentWalletMnemoinc = useMemo(() => {
    if (isUsingAltAccount) {
      return selectedAltAccount[0].mnemoinc;
    } else if (isUsingNostr) {
      return nostrSeed;
    } else {
      return accountMnemoinc;
    }
  }, [
    accountMnemoinc,
    selectedAltAccount,
    isUsingAltAccount,
    isUsingNostr,
    nostrSeed,
  ]);

  const isUsingAltAccount = currentWalletMnemoinc !== accountMnemoinc;

  return (
    <ActiveCustodyAccount.Provider
      value={{
        custodyAccounts,
        removeAccount,
        createAccount,
        updateAccount,
        updateAccountCacheOnly,
        selectedAltAccount,
        isUsingAltAccount,
        currentWalletMnemoinc,
        toggleIsUsingNostr,
        isUsingNostr,
        nostrSeed,
      }}>
      {children}
    </ActiveCustodyAccount.Provider>
  );
};

export const useActiveCustodyAccount = () => {
  return React.useContext(ActiveCustodyAccount);
};
