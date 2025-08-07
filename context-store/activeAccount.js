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
  storeData,
} from '../app/functions';
import {CUSTODY_ACCOUNTS_STORAGE_KEY} from '../app/constants';
import {useKeysContext} from './keys';
import {
  decryptMnemonic,
  encryptMnemonic,
} from '../app/functions/handleMnemonic';

// Create a context for the WebView ref
const ActiveCustodyAccount = createContext(null);

export const ActiveCustodyAccountProvider = ({children}) => {
  const [custodyAccounts, setCustodyAccounts] = useState([]);
  const {accountMnemoinc} = useKeysContext();

  const selectedAltAccount = custodyAccounts.filter(item => item.isActive);
  const isUsingAltAccount = !!selectedAltAccount.length;
  console.log(
    'decoded account list',
    custodyAccounts,
    selectedAltAccount,
    isUsingAltAccount,
  );
  useEffect(() => {
    async function initializeAccouts() {
      try {
        const accoutList = await getLocalStorageItem(
          CUSTODY_ACCOUNTS_STORAGE_KEY,
        ).then(data => JSON.parse(data) || []);

        console.log(accoutList, 'custody account list');

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
      let accountInformation = JSON.parse(JSON.stringify(custodyAccounts));
      let newAccounts = accountInformation.map(accounts => {
        if (account.uuid === accounts.uuid) {
          return {...accounts, ...account};
        } else return accounts;
      });

      setCustodyAccounts(newAccounts);
      return {didWork: true};
    } catch (err) {
      console.log('Remove account error', err);
      return {didWork: false, err: err.message};
    }
  };

  const currentWalletMnemoinc = useMemo(() => {
    if (isUsingAltAccount) return selectedAltAccount[0].mnemoinc;
    else return accountMnemoinc;
  }, [accountMnemoinc, selectedAltAccount, isUsingAltAccount]);

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
      }}>
      {children}
    </ActiveCustodyAccount.Provider>
  );
};

export const useActiveCustodyAccount = () => {
  return React.useContext(ActiveCustodyAccount);
};
