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
import {receivePayment} from '@breeztech/react-native-breez-sdk';
import {MintQuoteState} from '@cashu/cashu-ts';
import {LIGHTNINGAMOUNTBUFFER} from '../app/constants/math';
import {useNodeContext} from './nodeContext';
import {useAppStatus} from './appStatus';
import {
  checkMintQuote,
  claimUnclaimedEcashQuotes,
  formatEcashTx,
  getMeltQuote,
  hanleEcashQuoteStorage,
  mintEcash,
  payLnInvoiceFromEcash,
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
export const ECASH_QUOTE_EVENT_NAME = 'GENERATED_ECASH_QUPTE_EVENT';
export const ecashEventEmitter = new EventEmitter();

// Create a context for the WebView ref
const GlobaleCash = createContext(null);

export const GlobaleCashVariables = ({children}) => {
  const {contactsPrivateKey, publicKey} = useKeysContext();
  const {didGetToHomepage} = useAppStatus();
  const {nodeInformation} = useNodeContext();
  const countersRef = useRef({});
  const [globalEcashInformation, setGlobalEcashInformation] = useState([]);
  const [ecashWalletInformation, setEcashWalletInformation] = useState({
    balance: 0,
    transactions: [],
    mintURL: '',
    proofs: [],
  });
  const [usersMintList, setUesrsMintList] = useState([]);
  const didRunUnclaimedEcashQuotes = useRef(false);
  const [pendingNavigation, setPendingNavigation] = useState({});

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
      const storedProofs = await getStoredProofs();
      const balance = sumProofsValue(storedProofs);
      toggleEcashWalletInformation({balance: balance, proofs: storedProofs});
    };
    const updateMint = async eventType => {
      console.log('Receved a mint event emitter of type', eventType);
      const selectedMint = await getSelectedMint();

      const mintList = await getAllMints();
      const storedTransactions = await getStoredEcashTransactions();
      const storedProofs = await getStoredProofs();
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

  const drainEcashBalance = async () => {
    try {
      if (ecashWalletInformation.balance - 5 < 1) return;
      const lightningInvoice = await receivePayment({
        amountMsat: (ecashWalletInformation.balance - 5) * 1000,
        description: 'Auto Channel Rebalance',
      });
      const meltQuote = await getMeltQuote(lightningInvoice.lnInvoice.bolt11);
      if (!meltQuote) throw new Error('unable to create melt quote');
      const didPay = await payLnInvoiceFromEcash({
        quote: meltQuote.quote,
        invoice: lightningInvoice.lnInvoice.bolt11,
        proofsToUse: meltQuote.proofsToUse,
        description: 'Auto Channel Rebalance',
      });

      console.log(didPay, 'pay response in drain ecash balance');
    } catch (err) {
      console.log(err, 'draining ecash balance error');
    }
  };

  useEffect(() => {
    if (!didGetToHomepage) return;
    if (nodeInformation.userBalance === 0) return;
    if (
      nodeInformation.inboundLiquidityMsat / 1000 + LIGHTNINGAMOUNTBUFFER <
      ecashWalletInformation?.balance
    )
      return;

    drainEcashBalance();
  }, [didGetToHomepage]);

  useEffect(() => {
    function listenForPayment(event) {
      const receiveEcashQuote = event?.quote;
      const counter = event?.counter;
      const mintURL = event?.mintURL;
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
            globalCounter: counter,
            mintURL: mintURL,
          });

          if (didMint.prasedInvoice) {
            const formattedEcashTx = formatEcashTx({
              amount: didMint.prasedInvoice.amountMsat / 1000,
              fee: 0,
              paymentType: 'received',
              description: didMint.prasedInvoice.description,
            });

            await storeProofs([...didMint.proofs], mintURL);
            await storeEcashTransactions([formattedEcashTx], mintURL);
            await hanleEcashQuoteStorage(receiveEcashQuote, false);
            await new Promise(res => setTimeout(res, 1000));

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

  return (
    <GlobaleCash.Provider
      value={{
        parsedEcashInformation,
        getStoredEcashTransactions,
        globalEcashInformation,
        toggleGLobalEcashInformation,
        ecashWalletInformation,
        toggleEcashWalletInformation,
        usersMintList,
        toggleMintList,
        pendingNavigation,
        setPendingNavigation,
      }}>
      {children}
    </GlobaleCash.Provider>
  );
};

export const useGlobaleCash = () => {
  return React.useContext(GlobaleCash);
};
