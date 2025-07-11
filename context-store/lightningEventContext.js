// import {createContext, useContext, useEffect, useRef, useState} from 'react';
// import {AppState} from 'react-native';
// import startUpdateInterval from '../app/functions/LNBackupUdate';
// import {BreezEventVariant} from '@breeztech/react-native-breez-sdk';
// import {useNodeContext} from './nodeContext';
// import {shouldBlockNavigation} from '../app/functions/sendBitcoin';

// const LightningEventContext = createContext(null);

// export function LightningEventProvider({children}) {
//   const {toggleNodeInformation} = useNodeContext();
//   const intervalId = useRef(null);
//   const debounceTimer = useRef(null);
//   const currentTransactionIDS = useRef([]);
//   const isWaitingForActiveRef = useRef(false);
//   const backgroundNotificationEvent = useRef(null);
//   const [pendingNavigation, setPendingNavigation] = useState(null);
//   const [lightningEvent, setLightningEvent] = useState(null);

//   const debouncedStartInterval = () => {
//     if (debounceTimer.current) {
//       clearTimeout(debounceTimer.current);
//     }
//     debounceTimer.current = setTimeout(() => {
//       if (intervalId.current) clearInterval(intervalId.current);
//       intervalId.current = startUpdateInterval(toggleNodeInformation);
//     }, 2000);
//   };

//   useEffect(() => {
//     console.log('lightningevent changed:', lightningEvent);
//   }, [lightningEvent]);

//   const waitForActiveScreen = () => {
//     const subscription = AppState.addEventListener('change', state => {
//       console.log('RUNNINGIN WAIT FOR AVTIVE SCREEN', state);
//       if (state === 'active' && backgroundNotificationEvent.current) {
//         isWaitingForActiveRef.current = false;

//         console.log('RUNNING NAVIGATION FROM THE BACKGROUND');
//         setPendingNavigation({
//           routes: [
//             {
//               name: 'HomeAdmin',
//               params: {screen: 'Home'},
//             },
//             {
//               name: 'ConfirmTxPage',
//               params: {
//                 for: backgroundNotificationEvent.current?.type,
//                 information: backgroundNotificationEvent.current?.details,
//                 formattingType: 'lightningNode',
//               },
//             },
//           ],
//         });
//         backgroundNotificationEvent.current = null;
//         subscription.remove();
//         return true;
//       }
//     });
//   };

//   const shouldNavigate = event => {
//     console.log('RUNNING IN SHOULD NAVIGATE', event.type);
//     setLightningEvent(null);
//     if (
//       event?.type != BreezEventVariant.INVOICE_PAID &&
//       event?.type != BreezEventVariant.PAYMENT_SUCCEED
//     )
//       return false;
//     backgroundNotificationEvent.current = event;

//     const paymentHash =
//       event?.type === BreezEventVariant.INVOICE_PAID
//         ? event.details.payment.id
//         : event.details.id;

//     if (currentTransactionIDS.current.includes(paymentHash)) return false;
//     currentTransactionIDS.current.push(paymentHash);

//     const isUsingLNURLDescription =
//       event?.type === BreezEventVariant.INVOICE_PAID
//         ? event?.details?.payment?.details?.data?.lnAddress
//         : event?.details?.details?.data?.lnAddress;

//     const description =
//       event?.type === BreezEventVariant.INVOICE_PAID //NO LNURL EXISTS
//         ? (isUsingLNURLDescription &&
//             event?.details?.payment?.details?.data?.label) ||
//           event?.details?.payment?.description
//         : (isUsingLNURLDescription && event?.details?.details?.data?.label) ||
//           event?.details?.description;
//     console.log('ln invoice payment description', description);

//     if (
//       event?.type === BreezEventVariant.PAYMENT_SUCCEED ||
//       event?.details?.status === 'pending' ||
//       (event?.type === BreezEventVariant.INVOICE_PAID &&
//         shouldBlockNavigation(description))
//     )
//       return false;
//     return true;
//   };

//   useEffect(() => {
//     if (!lightningEvent) return;
//     const response = shouldNavigate(lightningEvent);
//     if (response) {
//       console.log('SETTING PENDING NAVIGATION');
//       console.log('current app state in ln', AppState.currentState);
//       if (AppState.currentState == 'background') {
//         if (!isWaitingForActiveRef.current) {
//           isWaitingForActiveRef.current = true;
//           waitForActiveScreen();
//         }
//         return;
//       }
//       setPendingNavigation({
//         routes: [
//           {
//             name: 'HomeAdmin',
//             params: {screen: 'Home'},
//           },
//           {
//             name: 'ConfirmTxPage',
//             params: {
//               for: lightningEvent.type,
//               information: lightningEvent?.details,
//               formattingType: 'lightningNode',
//             },
//           },
//         ],
//       });
//     }
//   }, [lightningEvent]);

//   const onLightningBreezEvent = e => {
//     console.log('Running in breez event in useContext');
//     console.log(e);
//     setLightningEvent(e);
//     if (
//       e?.type != BreezEventVariant.INVOICE_PAID &&
//       e?.type != BreezEventVariant.PAYMENT_SUCCEED &&
//       e?.type != BreezEventVariant.PAYMENT_FAILED &&
//       e?.type != BreezEventVariant.REVERSE_SWAP_UPDATED
//     )
//       return;
//     debouncedStartInterval();
//   };

//   return (
//     <LightningEventContext.Provider
//       value={{
//         onLightningBreezEvent,
//         pendingNavigation,
//         setPendingNavigation, // Include this so we can clear it after navigation
//       }}>
//       {children}
//     </LightningEventContext.Provider>
//   );
// }
// export const useLightningEvent = () => {
//   return useContext(LightningEventContext); // Use the correct context
// };
