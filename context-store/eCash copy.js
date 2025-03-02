// import React, {
//   createContext,
//   useEffect,
//   useMemo,
//   useRef,
//   useState,
// } from 'react';
// import {
//   decryptMessage,
//   encriptMessage,
// } from '../app/functions/messaging/encodingAndDecodingMessages';
// import {
//   checkMintQuote,
//   claimUnclaimedEcashQuotes,
//   cleanEcashWalletState,
//   createWallet,
//   formatEcashTx,
//   getProofsToUse,
//   mintEcash,
//   sendEcashToLightningPayment,
// } from '../app/functions/eCash';
// import {addDataToCollection} from '../db';
// import {sumProofsValue} from '../app/functions/eCash/proofs';
// import {parseInvoice, receivePayment} from '@breeztech/react-native-breez-sdk';
// import {MintQuoteState} from '@cashu/cashu-ts';
// import {LIGHTNINGAMOUNTBUFFER} from '../app/constants/math';
// import {useNodeContext} from './nodeContext';
// import {useAppStatus} from './appStatus';
// import {useKeysContext} from './keys';

// // Create a context for the WebView ref
// const GlobaleCash = createContext(null);

// export const GlobaleCashVariables = ({children}) => {
//   const {contactsPrivateKey, publicKey} = useKeysContext();
//   const {didGetToHomepage} = useAppStatus();
//   const {nodeInformation} = useNodeContext();
//   const isInitialCleanWalletStateRender = useRef(true);
//   const countersRef = useRef({});

//   const [globalEcashInformation, setGlobalEcashInformation] = useState([]);

//   const [eCashBalance, setEcashBalance] = useState(0);
//   const [ecashTransactions, setecashTransactions] = useState([]);
//   const [eCashPaymentInformation, setEcashPaymentInformation] = useState({
//     quote: null,
//     invoice: null,
//     proofsToUse: null,
//   });
//   const [eCashNavigate, seteCashNavigate] = useState(null);
//   const eCashIntervalRef = useRef(null);
//   const [receiveEcashQuote, setReceiveEcashQuote] = useState('');
//   const didRunUnclaimedEcashQuotes = useRef(false);

//   const toggleGLobalEcashInformation = (newData, writeToDB) => {
//     setGlobalEcashInformation(prev => {
//       if (writeToDB) {
//         addDataToCollection(
//           {eCashInformation: newData},
//           'blitzWalletUsers',
//           publicKey,
//         );
//       }
//       return newData;
//     });
//   };

//   const parsedEcashInformation = useMemo(() => {
//     if (!publicKey || !globalEcashInformation) return [];
//     return typeof globalEcashInformation === 'string'
//       ? [
//           ...JSON.parse(
//             decryptMessage(
//               contactsPrivateKey,
//               publicKey,
//               globalEcashInformation,
//             ),
//           ),
//         ]
//       : [];
//   }, [globalEcashInformation, publicKey]);

//   const currentMint = useMemo(() => {
//     if (parsedEcashInformation.length === 0) return '';
//     const [currentMint] = parsedEcashInformation.filter(mintInfo => {
//       return mintInfo?.isCurrentMint;
//     });
//     return currentMint;
//   }, [parsedEcashInformation]);

//   const getStoredEcashTransactions = () => {
//     try {
//       const txs = currentMint.transactions;
//       return txs ? txs : [];
//     } catch (error) {
//       console.error('Failed to retrieve txs:', error);
//       return [];
//     }
//   };
//   const removeProofs = (proofsToRemove, proofArray) => {
//     try {
//       const existingProofs = proofArray || currentMint.proofs;
//       const updatedProofs = existingProofs.filter(
//         item1 =>
//           !proofsToRemove.some(
//             item2 =>
//               item1.C === item2.C &&
//               item1.amount === item2.amount &&
//               item1.id === item2.id &&
//               item1.secret === item2.secret,
//           ),
//       );

//       return updatedProofs;
//     } catch (error) {
//       console.error('Failed to remove proofs:', error);
//     }
//   };

//   useEffect(() => {
//     if (eCashBalance == 0) return;
//     console.log('IN CLEAN EACASH FUNCTION');

//     cleanWallet();
//   }, [eCashBalance]);

//   const cleanWallet = async () => {
//     try {
//       let doesNeedToUpdate = false;

//       const newList = await Promise.all(
//         parsedEcashInformation.map(async mint => {
//           const usedProofs = await cleanEcashWalletState(mint);

//           const availableProofs = removeProofs(usedProofs, mint.proofs);

//           if (usedProofs.length > 0) {
//             doesNeedToUpdate = true;
//           }

//           return {...mint, proofs: availableProofs};
//         }),
//       );

//       console.log(doesNeedToUpdate, 'DOES NEED TO UPDATE');
//       if (doesNeedToUpdate) {
//         const em = encriptMessage(
//           contactsPrivateKey,
//           publicKey,
//           JSON.stringify(newList),
//         );
//         toggleGLobalEcashInformation(em, true);
//       }
//       return true;
//     } catch (err) {
//       console.log(err);
//       return false;
//     }
//   };

//   const getEcashBalance = async () => {
//     // const didClean = await cleanWallet();

//     // if (didClean) {
//     const savedProofs = currentMint.proofs;

//     const userBalance = savedProofs.reduce((prev, curr) => {
//       const proof = curr;
//       return (prev += proof.amount);
//     }, 0);
//     return userBalance;
//     // } else {
//     //   return eCashBalance;
//     // }
//   };

//   const saveNewEcashInformation = storageInfo => {
//     const newEcashInformation = [...parsedEcashInformation].map(mint => {
//       if (mint.isCurrentMint) {
//         Object.entries(storageInfo).forEach(entry => {
//           mint[entry[0]] = entry[1];
//         });

//         return mint;
//       } else return mint;
//     });

//     const em = encriptMessage(
//       contactsPrivateKey,
//       publicKey,
//       JSON.stringify(newEcashInformation),
//     );
//     toggleGLobalEcashInformation(em, true);
//   };

//   const sendEcashPayment = async bolt11Invoice => {
//     try {
//       const wallet = await createWallet(currentMint.mintURL);
//       const meltQuote = await wallet.createMeltQuote(bolt11Invoice);
//       const eCashBalance = await getEcashBalance();

//       const {proofsToUse} = getProofsToUse(
//         currentMint.proofs,
//         meltQuote.amount + meltQuote.fee_reserve,
//         'desc',
//       );

//       if (
//         proofsToUse.length === 0 ||
//         eCashBalance < meltQuote.amount + meltQuote.fee_reserve
//       ) {
//         return false;
//       } else {
//         return {quote: meltQuote, proofsToUse};
//       }
//     } catch (err) {
//       console.log(err);
//       return false;
//     }
//   };

//   const drainEcashBalance = async () => {
//     try {
//       if (eCashBalance - 5 < 1) return;
//       const lightningInvoice = await receivePayment({
//         amountMsat: (eCashBalance - 5) * 1000,
//         description: 'Ecash -> LN swap',
//       });

//       const didSendEcashPayment = await sendEcashPayment(
//         lightningInvoice.lnInvoice.bolt11,
//       );
//       setEcashPaymentInformation({
//         quote: didSendEcashPayment.quote,
//         invoice: lightningInvoice.lnInvoice.bolt11,
//         proofsToUse: didSendEcashPayment.proofsToUse,
//         isAutoChannelRebalance: true,
//       });
//     } catch (err) {
//       console.log(err, 'TEST');
//     }
//   };

//   useEffect(() => {
//     if (!didGetToHomepage) return;
//     if (nodeInformation.userBalance === 0) return;
//     if (
//       nodeInformation.inboundLiquidityMsat / 1000 + LIGHTNINGAMOUNTBUFFER <
//       eCashBalance
//     )
//       return;

//     drainEcashBalance();
//   }, [didGetToHomepage]);

//   useEffect(() => {
//     if (!receiveEcashQuote) return;
//     // Initialize the counter for this specific quote
//     if (!countersRef.current[receiveEcashQuote]) {
//       countersRef.current[receiveEcashQuote] = 0; // Initialize counter if not already
//     }

//     const intervalId = setInterval(async () => {
//       countersRef.current[receiveEcashQuote] += 1;
//       console.log(
//         countersRef.current,
//         countersRef.current[receiveEcashQuote],
//         'ECASH INTERVAL NUMBER',
//         receiveEcashQuote,
//       );
//       const response = await checkMintQuote({
//         quote: receiveEcashQuote,
//         mintURL: currentMint.mintURL,
//       });
//       console.log(response);
//       if (response.state === MintQuoteState.PAID) {
//         clearInterval(intervalId);
//         setReceiveEcashQuote('');
//         const didMint = await mintEcash({
//           quote: response.quote,
//           invoice: response.request,
//           mintURL: currentMint.mintURL,
//         });

//         if (didMint.parsedInvoie) {
//           const formattedEcashTx = formatEcashTx({
//             time: Date.now(),
//             amount: didMint.parsedInvoie.invoice.amountMsat / 1000,
//             fee: 0,
//             paymentType: 'received',
//           });

//           saveNewEcashInformation({
//             transactions: !!currentMint?.transactions
//               ? [...currentMint.transactions, formattedEcashTx]
//               : [formattedEcashTx],
//             proofs: !!currentMint?.proofs
//               ? [...currentMint.proofs, ...didMint.proofs]
//               : didMint.proofs,
//           });

//           updateUserBalance();
//           const storedTransactions = getStoredEcashTransactions();
//           setecashTransactions(storedTransactions);

//           eCashNavigate.reset({
//             index: 0, // The top-level route index
//             routes: [
//               {
//                 name: 'HomeAdmin', // Navigate to HomeAdmin
//                 params: {
//                   screen: 'Home',
//                 },
//               },
//               {
//                 name: 'ConfirmTxPage', // Navigate to ExpandedAddContactsPage
//                 params: {
//                   for: 'invoicePaid',
//                   information: {
//                     status: 'complete',
//                     feeSat: 0,
//                     amountSat: Math.round(
//                       didMint.parsedInvoie.invoice.amountMsat / 1000,
//                     ),
//                     details: {error: ''},
//                   },
//                   formattingType: 'ecash',
//                 },
//               },
//             ],
//             // Array of routes to set in the stack
//           });
//         }
//       }
//       // Clear the interval after 4 executions for this quote
//       if (countersRef.current[receiveEcashQuote] >= 15) {
//         clearInterval(intervalId);
//       }
//     }, 10000);
//     return () => clearInterval(intervalId);
//   }, [receiveEcashQuote]);

//   useEffect(() => {
//     if (
//       !eCashPaymentInformation.invoice ||
//       !eCashPaymentInformation.proofsToUse ||
//       !eCashPaymentInformation.quote
//     )
//       return;

//     payLnInvoiceFromEcash();
//   }, [eCashPaymentInformation]);

//   useEffect(() => {
//     async function initEcash() {
//       updateUserBalance();
//       const storedTransactions = getStoredEcashTransactions();
//       setecashTransactions(storedTransactions);
//     }
//     if (!publicKey || parsedEcashInformation.length === 0) return;
//     initEcash();
//   }, [globalEcashInformation]);

//   useEffect(() => {
//     if (!currentMint) return;
//     if (didRunUnclaimedEcashQuotes.current) return;
//     didRunUnclaimedEcashQuotes.current = true;
//     claimUnclaimedEcashQuotes({
//       currentMint: currentMint,
//       saveNewEcashInformation: saveNewEcashInformation,
//       updateUserBalance: updateUserBalance,
//       setecashTransactions: setecashTransactions,
//     }); //if a receive ecash timeout clears before payment is receve this will try and claim the ecash quote on the next wallet load
//   }, [currentMint]);

//   return (
//     <GlobaleCash.Provider
//       value={{
//         eCashBalance,
//         seteCashNavigate,
//         setEcashPaymentInformation,
//         setReceiveEcashQuote,
//         ecashTransactions,
//         parsedEcashInformation,
//         currentMint,
//         saveNewEcashInformation,
//         removeProofs,
//         getStoredEcashTransactions,
//         sendEcashPayment,
//         globalEcashInformation,
//         toggleGLobalEcashInformation,
//       }}>
//       {children}
//     </GlobaleCash.Provider>
//   );

//   async function updateUserBalance() {
//     const userBalance = await getEcashBalance();
//     setEcashBalance(userBalance);
//   }

//   async function payLnInvoiceFromEcash() {
//     const wallet = await createWallet(currentMint.mintURL);
//     const walletProofsToDelete = JSON.parse(
//       JSON.stringify(eCashPaymentInformation.proofsToUse),
//     );
//     let proofs = walletProofsToDelete;
//     let globalProofTracker = JSON.parse(JSON.stringify(currentMint.proofs));
//     let returnChangeGlobal = [];
//     const decodedInvoice = await parseInvoice(eCashPaymentInformation.invoice);
//     const amount = decodedInvoice.amountMsat / 1000;
//     const amountToPay =
//       (eCashPaymentInformation?.quote?.fee_reserve || 5) + amount;

//     console.log('Proofs before send', proofs);
//     console.log(sumProofsValue(proofs), amountToPay);
//     try {
//       if (sumProofsValue(proofs) >= amountToPay) {
//         console.log('[payLnInvoce] use send ', {
//           amountToPay,
//           amount,
//           fee: eCashPaymentInformation?.quote?.fee_reserve,
//           proofs: sumProofsValue(proofs),
//         });
//         const {keep: proofsToKeep, send: proofsToSend} = await wallet.send(
//           amountToPay,
//           proofs,
//           {
//             includeFees: true,
//           },
//         );
//         console.log(proofsToKeep, 'PROOFS TO KEEP');
//         console.log(proofsToSend, 'PROOFS TO SEND');
//         if (proofsToKeep?.length) {
//           returnChangeGlobal.push(...proofsToKeep);
//         }

//         proofs = proofsToSend;
//       } else throw Error('Not enough to cover payment');
//       console.log('Proofs after send', proofs);

//       const payResponse = await sendEcashToLightningPayment({
//         wallet,
//         proofsToSend: proofs,
//         invoice: eCashPaymentInformation.invoice,
//       });
//       // const payResponse = await wallet.payLnInvoice(
//       //   eCashPaymentInformation.invoice,
//       //   proofs,
//       //   eCashPaymentInformation.quote,
//       // );
//       console.log('PAY RSPONSE', payResponse);
//       if (payResponse?.change?.length) {
//         returnChangeGlobal.push(...payResponse?.change);
//       }
//       if (payResponse.isPaid) {
//         const newProofs = removeProofs(
//           walletProofsToDelete,
//           globalProofTracker,
//         );
//         globalProofTracker = newProofs;

//         setEcashPaymentInformation({
//           quote: null,
//           invoice: null,
//           proofsToUse: null,
//         });
//         const realFee =
//           eCashPaymentInformation.quote.fee_reserve -
//           sumProofsValue(payResponse.change);
//         const formattedEcashTx = formatEcashTx({
//           time: Date.now(),
//           amount: eCashPaymentInformation.quote.amount,
//           fee: realFee < 0 ? 0 : realFee,
//           paymentType: 'sent',
//           preImage: payResponse.payment_preimage,
//         });
//         saveNewEcashInformation({
//           transactions: [...currentMint.transactions, formattedEcashTx],
//           proofs: [...globalProofTracker, ...returnChangeGlobal],
//         });
//         clearTimeout(eCashIntervalRef.current);

//         updateUserBalance();
//         const storedTransactions = getStoredEcashTransactions();
//         setecashTransactions(storedTransactions);

//         if (eCashPaymentInformation.isAutoChannelRebalance || !eCashNavigate)
//           return;
//         eCashNavigate.reset({
//           index: 0, // The top-level route index
//           routes: [
//             {
//               name: 'HomeAdmin', // Navigate to HomeAdmin
//               params: {
//                 screen: 'Home',
//               },
//             },

//             {
//               name: 'ConfirmTxPage', // Navigate to ExpandedAddContactsPage
//               params: {
//                 for: 'paymentSucceed',
//                 information: {
//                   status: 'complete',
//                   feeSat: realFee < 0 ? 0 : realFee,
//                   amountSat: eCashPaymentInformation.quote.amount,
//                   details: {error: ''},
//                 },
//                 formattingType: 'ecash',
//               },
//             },
//           ],
//           // Array of routes to set in the stack
//         });
//       }
//     } catch (err) {
//       const newProofs = removeProofs(walletProofsToDelete, globalProofTracker);
//       globalProofTracker = newProofs;
//       setEcashPaymentInformation({
//         quote: null,
//         invoice: null,
//         proofsToUse: null,
//       });
//       saveNewEcashInformation({
//         transactions: currentMint.transactions,
//         proofs: [...globalProofTracker, ...returnChangeGlobal, ...proofs],
//       });
//       if (eCashPaymentInformation.isAutoChannelRebalance || !eCashNavigate)
//         return;

//       eCashNavigate.reset({
//         index: 0, // The top-level route index
//         routes: [
//           {
//             name: 'HomeAdmin', // Navigate to HomeAdmin
//             params: {
//               screen: 'Home',
//             },
//           },

//           {
//             name: 'ConfirmTxPage',
//             params: {
//               for: 'paymentFailed',
//               information: {
//                 status: 'failed',
//                 feeSat: 0,
//                 amountSat: 0,
//                 details: {error: err},
//               },
//               formattingType: 'ecash',
//             },
//           },
//         ],
//       });

//       console.log(`ecash send error`, err);
//     }
//   }
// };

// export const useGlobaleCash = () => {
//   return React.useContext(GlobaleCash);
// };
