import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  decryptMessage,
  encriptMessage,
} from '../app/functions/messaging/encodingAndDecodingMessages';
import {useKeysContext} from './keys';
import {sumProofsValue} from '../app/functions/eCash/proofs';
import {MintQuoteState} from '@cashu/cashu-ts';
import {
  checkMintQuote,
  claimUnclaimedEcashQuotes,
  formatEcashTx,
  hanleEcashQuoteStorage,
  mintEcash,
} from '../app/functions/eCash/wallet';
import {
  getAllMints,
  getSelectedMint,
  getStoredEcashTransactions,
  getStoredProofs,
  MINT_EVENT_UPDATE_NAME,
  PROOF_EVENT_UPDATE_NAME,
  sqlEventEmitter,
  storeEcashTransactions,
  storeProofs,
  TRANSACTIONS_EVENT_UPDATE_NAME,
} from '../app/functions/eCash/db';
import EventEmitter from 'events';
import {addDataToCollection} from '../db';
import {useGlobalContextProvider} from './context';
export const ECASH_QUOTE_EVENT_NAME = 'GENERATED_ECASH_QUPTE_EVENT';
export const ecashEventEmitter = new EventEmitter();

// Create a context for the WebView ref
const GlobaleCash = createContext(null);

export const GlobaleCashVariables = ({children}) => {
  const {contactsPrivateKey, publicKey} = useKeysContext();
  const countersRef = useRef({});
  const [globalEcashInformation, setGlobalEcashInformation] = useState([]);
  const [ecashWalletInformation, setEcashWalletInformation] = useState({
    didConnectToNode: null,
    balance: 0,
    transactions: [],
    mintURL: '',
    proofs: [],
  });
  const {masterInfoObject} = useGlobalContextProvider();
  const [usersMintList, setUesrsMintList] = useState([]);
  const didRunUnclaimedEcashQuotes = useRef(false);
  const isInitialRender = useRef(true);
  const [pendingNavigation, setPendingNavigation] = useState(null);

  const toggleEcashWalletInformation = useCallback(newData => {
    setEcashWalletInformation(prev => ({...prev, ...newData}));
  }, []);
  const toggleMintList = useCallback(newList => {
    setUesrsMintList(newList);
  }, []);

  useEffect(() => {
    const updateTransactions = async eventType => {
      console.log('Receved a transaction event emitter of type', eventType);
      const storedTransactions = await getStoredEcashTransactions();

      toggleEcashWalletInformation({transactions: storedTransactions});
    };
    const updateBalance = async eventType => {
      console.log('Receved a proofs event emitter of type', eventType);
      const [storedProofs, mintList] = await Promise.all([
        getStoredProofs(),
        getAllMints(),
      ]);
      const balance = sumProofsValue(storedProofs);
      toggleEcashWalletInformation({balance: balance, proofs: storedProofs});
      toggleMintList(mintList);
    };
    const updateMint = async eventType => {
      console.log('Receved a mint update event emitter of type', eventType);
      const [selectedMint, mintList, storedTransactions, storedProofs] =
        await Promise.all([
          getSelectedMint(),
          getAllMints(),
          getStoredEcashTransactions(),
          getStoredProofs(),
        ]);
      const balance = sumProofsValue(storedProofs);

      toggleEcashWalletInformation({
        mintURL: selectedMint,
        balance,
        transactions: storedTransactions,
        proofs: storedProofs,
      });
      toggleMintList(mintList);
    };
    sqlEventEmitter.on(TRANSACTIONS_EVENT_UPDATE_NAME, updateTransactions);
    sqlEventEmitter.on(PROOF_EVENT_UPDATE_NAME, updateBalance);
    sqlEventEmitter.on(MINT_EVENT_UPDATE_NAME, updateMint);
    return () => {
      sqlEventEmitter.off(TRANSACTIONS_EVENT_UPDATE_NAME, updateTransactions);
      sqlEventEmitter.off(PROOF_EVENT_UPDATE_NAME, updateBalance);
      sqlEventEmitter.off(MINT_EVENT_UPDATE_NAME, updateMint);
    };
  }, []);

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    if (masterInfoObject.enabledEcash) {
      const loadSavedMint = async () => {
        const [selectedMint, mintList, storedTransactions, storedProofs] =
          await Promise.all([
            getSelectedMint(),
            getAllMints(),
            getStoredEcashTransactions(),
            getStoredProofs(),
          ]);
        if (!selectedMint) {
          toggleEcashWalletInformation({
            didConnectToNode: true,
          });

          return;
        }
        const balance = sumProofsValue(storedProofs);

        toggleEcashWalletInformation({
          didConnectToNode: true,
          mintURL: selectedMint,
          balance,
          transactions: storedTransactions,
          proofs: storedProofs,
        });
        toggleMintList(mintList);
      };
      loadSavedMint();
    } else {
      toggleEcashWalletInformation({
        didConnectToNode: null,
        balance: 0,
        transactions: [],
        mintURL: '',
        proofs: [],
      });
    }
  }, [masterInfoObject]);

  const toggleGLobalEcashInformation = (newData, writeToDB) => {
    setGlobalEcashInformation(prev => {
      if (writeToDB) {
        addDataToCollection(
          {eCashInformation: newData},
          'blitzWalletUsers',
          publicKey,
        );
      }
      return newData;
    });
  };

  const parsedEcashInformation = useMemo(() => {
    if (!publicKey || !globalEcashInformation) return [];
    return typeof globalEcashInformation === 'string'
      ? [
          ...JSON.parse(
            decryptMessage(
              contactsPrivateKey,
              publicKey,
              globalEcashInformation,
            ),
          ),
        ]
      : [];
  }, [globalEcashInformation, publicKey]);

  useEffect(() => {
    function listenForPayment(event) {
      const receiveEcashQuote = event?.quote;
      const mintURL = event?.mintURL;
      const shouldNavigate =
        typeof event?.shouldNavigate !== 'boolean' || event?.shouldNavigate;
      console.log('received event for quote', event);
      // Initialize the counter for this specific quote
      if (!countersRef.current[receiveEcashQuote]) {
        countersRef.current[receiveEcashQuote] = 0; // Initialize counter if not already
      }

      const intervalId = setInterval(async () => {
        countersRef.current[receiveEcashQuote] += 1;
        console.log(
          countersRef.current,
          countersRef.current[receiveEcashQuote],
          'ECASH INTERVAL NUMBER',
          receiveEcashQuote,
        );
        const response = await checkMintQuote({
          quote: receiveEcashQuote,
          mintURL: mintURL,
        });
        console.log(response);
        if (response.state === MintQuoteState.PAID) {
          clearInterval(intervalId);
          const didMint = await mintEcash({
            quote: response.quote,
            invoice: response.request,
            mintURL: mintURL,
          });

          if (didMint.prasedInvoice) {
            const formattedEcashTx = formatEcashTx({
              amount: didMint.prasedInvoice.amountMsat / 1000,
              fee: 0,
              paymentType: 'received',
              description: didMint.prasedInvoice.description,
              invoice: response.request,
            });

            await storeProofs([...didMint.proofs], mintURL);
            await storeEcashTransactions([formattedEcashTx], mintURL);
            await hanleEcashQuoteStorage(receiveEcashQuote, false);
            if (!shouldNavigate) return;
            setPendingNavigation({
              index: 0, // The top-level route index
              routes: [
                {
                  name: 'HomeAdmin', // Navigate to HomeAdmin
                  params: {
                    screen: 'Home',
                  },
                },
                {
                  name: 'ConfirmTxPage', // Navigate to ExpandedAddContactsPage
                  params: {
                    for: 'invoicePaid',
                    information: {
                      status: 'complete',
                      feeSat: 0,
                      amountSat: Math.round(
                        didMint.prasedInvoice.amountMsat / 1000,
                      ),
                      details: {error: ''},
                    },
                    formattingType: 'ecash',
                  },
                },
              ],
              // Array of routes to set in the stack
            });
          }
        }
        // Clear the interval after 4 executions for this quote
        if (countersRef.current[receiveEcashQuote] >= 15) {
          clearInterval(intervalId);
        }
      }, 10000);
    }

    ecashEventEmitter.on(ECASH_QUOTE_EVENT_NAME, listenForPayment);
    return () =>
      ecashEventEmitter.off(ECASH_QUOTE_EVENT_NAME, listenForPayment);
  }, []);

  useEffect(() => {
    if (!ecashWalletInformation.mintURL) return;
    if (didRunUnclaimedEcashQuotes.current) return;
    didRunUnclaimedEcashQuotes.current = true;
    claimUnclaimedEcashQuotes(); //if a receive ecash timeout clears before payment is receve this will try and claim the ecash quote on the next wallet load
  }, [ecashWalletInformation.mintURL]);

  const memoedValues = useMemo(() => {
    return {
      parsedEcashInformation,
      globalEcashInformation,
      toggleGLobalEcashInformation,
      ecashWalletInformation,
      toggleEcashWalletInformation,
      usersMintList,
      toggleMintList,
      pendingNavigation,
      setPendingNavigation,
    };
  }, [
    parsedEcashInformation,
    globalEcashInformation,
    toggleGLobalEcashInformation,
    ecashWalletInformation,
    toggleEcashWalletInformation,
    usersMintList,
    toggleMintList,
    pendingNavigation,
    setPendingNavigation,
  ]);

  return (
    <GlobaleCash.Provider value={memoedValues}>{children}</GlobaleCash.Provider>
  );
};

export const useGlobaleCash = () => {
  return React.useContext(GlobaleCash);
};
