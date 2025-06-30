import {useEffect, useRef, useCallback} from 'react';
import {useGlobalContextProvider} from './context';
import {collection, onSnapshot, query} from '@react-native-firebase/firestore';
import {db} from '../db/initializeFirebase';
import {batchDeleteLnurlPayments} from '../db';
// import {initializeTempSparkWallet} from '../app/functions/spark';
// import {getBitcoinKeyPair, getSharedKey} from '../app/functions/lnurl';
import {useSparkWallet} from './sparkContext';
// import {retrieveData} from '../app/functions';
import {addSingleUnpaidSparkLightningTransaction} from '../app/functions/spark/transactions';

export default function HandleLNURLPayments() {
  const {sparkInformation, setNumberOfIncomingLNURLPayments} = useSparkWallet();
  const {masterInfoObject} = useGlobalContextProvider();
  const sparkAddress = sparkInformation.sparkAddress;

  // Initialize refs
  const loadListener = useRef(false); // Changed to boolean for clarity
  const timeoutRef = useRef(null);
  const isProcessingRef = useRef(false);

  const paymentQueueRef = useRef([]);

  const deleteActiveLNURLPaymentsRef = useRef([]);

  useEffect(() => {
    if (!sparkAddress || loadListener.current) return;
    loadListener.current = true;

    const setupListener = () => {
      const paymentsRef = collection(
        db,
        'blitzWalletUsers',
        masterInfoObject.uuid,
        'lnurlPayments',
      );
      // Remove the timestamp filter to get ALL payments initially
      const q = query(paymentsRef);

      let isInitialLoad = true;

      const unsubscribe = onSnapshot(q, snapshot => {
        if (isInitialLoad) {
          // First load - process all existing payments
          snapshot.docs.forEach(doc => {
            const payment = doc.data();
            paymentQueueRef.current.push({
              ...payment,
              id: doc.id,
              shouldNavigate: false, // Don't navigate for restored payments
              runCount: 0,
            });
          });

          if (paymentQueueRef.current.length > 0) {
            console.log(
              `Restoring ${paymentQueueRef.current.length} offline lnurl payments`,
            );
            processQueue();
          }

          isInitialLoad = false;
        } else {
          // Handle real-time updates
          snapshot?.docChanges().forEach(change => {
            if (change.type === 'added') {
              const payment = change.doc.data();
              paymentQueueRef.current.push({
                ...payment,
                id: change.doc.id,
                shouldNavigate: false,
                runCount: 0,
              });
            }
          });

          if (snapshot?.docChanges().length > 0) {
            processQueue();
          }
        }
      });
      return unsubscribe;
    };
    const unsubscribe = setupListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      loadListener.current = false;
    };
  }, [sparkAddress, masterInfoObject.uuid]);

  // Process payment queue
  const processQueue = useCallback(async () => {
    if (!sparkAddress) return;
    if (isProcessingRef.current) return;

    isProcessingRef.current = true;

    try {
      const currentQueue = [...paymentQueueRef.current];
      console.log(`Processing ${currentQueue.length} LNURL payments`);
      if (currentQueue.length === 0) return;

      const newQueue = [];
      const processedIds = [];

      for (const payment of currentQueue) {
        console.log(`Processing LNURL payment ${payment.id}`, payment);
        await addSingleUnpaidSparkLightningTransaction({
          id: payment.sparkID,
          amount: payment.amountSats,
          expiration: payment.expiredTime,
          description: payment.description,
          shouldNavigate: payment.shouldNavigate,
          details: {
            sharedPublicKey: payment.sharedPublicKey,
            sparkPubKey: payment.sparkPubKey,
          },
        });
        processedIds.push(payment.id);
        deleteActiveLNURLPaymentsRef.current.push(payment.id);
      }

      // Update queue and clean up processed payments
      paymentQueueRef.current = paymentQueueRef.current
        .filter(
          item =>
            !processedIds.includes(item.id) &&
            !currentQueue.some(processed => processed.id === item.id),
        )
        .concat(newQueue);

      if (deleteActiveLNURLPaymentsRef.current.length > 0) {
        try {
          await batchDeleteLnurlPayments(
            masterInfoObject.uuid,
            deleteActiveLNURLPaymentsRef.current,
          );
          deleteActiveLNURLPaymentsRef.current = [];
        } catch (error) {
          console.error('Error deleting processed payments:', error);
        }
      }

      if (newQueue.length > 0) {
        timeoutRef.current = setTimeout(() => {
          processQueue();
        }, 10000);
      }
    } catch (error) {
      console.error('Error in processQueue:', error);
    } finally {
      isProcessingRef.current = false;
    }
  }, [
    sparkAddress,
    masterInfoObject.uuid,
    setNumberOfIncomingLNURLPayments,
    // setBlockedIdentityPubKeys,
  ]);

  return null;
}
