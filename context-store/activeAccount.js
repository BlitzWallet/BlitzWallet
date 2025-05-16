import React, {createContext, useEffect, useRef, useState} from 'react';
import {retrieveData, storeData} from '../app/functions';
import {CUSTODY_ACCOUNTS_STORAGE_KEY} from '../app/constants';

// Create a context for the WebView ref
const ActiveCustodyAccount = createContext(null);

export const ActiveCustodyAccountProvider = ({children}) => {
  const [custodyAccounts, setCustodyAccounts] = useState([]);

  useEffect(() => {
    async function initializeAccouts() {
      try {
        const accoutList = await retrieveData(
          CUSTODY_ACCOUNTS_STORAGE_KEY,
        ).then(data => JSON.parse(data) || []);

        setCustodyAccounts(accoutList);
      } catch (err) {
        console.log('Custody account intialization error', err);
      }
    }

    console.log('Initializing accounts....');
    initializeAccouts();
  }, []);

  const removeAccount = async account => {
    try {
      let accountInformation = JSON.parse(JSON.stringify(custodyAccounts));
      let newAccounts = accountInformation.filter(accounts => {
        return accounts.uuid !== account.uuid;
      });
      //   clear spark information here too. Delte txs from database, reove listeners
      await storeData(
        CUSTODY_ACCOUNTS_STORAGE_KEY,
        JSON.stringify(newAccounts),
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
      await storeData(
        CUSTODY_ACCOUNTS_STORAGE_KEY,
        JSON.stringify(savedAccountInformation),
      );
      if (accountInformation.isActive) {
        // Switch spark wallet here
      }
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
      await storeData(
        CUSTODY_ACCOUNTS_STORAGE_KEY,
        JSON.stringify(newAccounts),
      );
      setCustodyAccounts(newAccounts);
      return {didWork: true};
    } catch (err) {
      console.log('Remove account error', err);
      return {didWork: false, err: err.message};
    }
  };

  return (
    <ActiveCustodyAccount.Provider
      value={{custodyAccounts, removeAccount, createAccount, updateAccount}}>
      {children}
    </ActiveCustodyAccount.Provider>
  );
};

export const useActiveCustodyAccount = () => {
  return React.useContext(ActiveCustodyAccount);
};
