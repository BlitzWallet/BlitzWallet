import { useEffect, useRef, useCallback } from 'react';
import { useGlobalContextProvider } from './context';
import {
  collection,
  onSnapshot,
  query,
} from '@react-native-firebase/firestore';
import { db } from '../db/initializeFirebase';
import { batchDeleteLnurlPayments } from '../db';
// import {initializeTempSparkWallet} from '../app/functions/spark';
// import {getBitcoinKeyPair, getSharedKey} from '../app/functions/lnurl';
import { useSparkWallet } from './sparkContext';
// import {retrieveData} from '../app/functions';
import {
  addBulkUnpaidSparkLightningTransactions,
  bulkUpdateSparkTransactions,
  getBulkSparkTransactions,
} from '../app/functions/spark/transactions';
import i18next from 'i18next';

export default function HandleLNURLPayments() {
  const { sparkInformation } = useSparkWallet();
  const { masterInfoObject } = useGlobalContextProvider();
  const sparkAddress = sparkInformation?.sparkAddress;
  const identityPubKey = sparkInformation?.identityPubKey;

  // Initialize refs
  const loadListener = useRef(false); // Changed to boolean for clarity
  const isProcessingRef = useRef(false);

  const paymentQueueRef = useRef([]);

  const parseDescription = message => {
    try {
      const parsed = JSON.parse(message);
      return i18next.t(parsed.translation, { name: parsed.name });
    } catch (err) {
      console.log(err);
      return message;
    }
  };

  useEffect(() => {
    if (!masterInfoObject.uuid) return;
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

  // Process payment queue.
  //
  // A lnurlPayments doc now arrives AFTER the payment is confirmed, so the
  // matching spark transaction may already exist. On cold start the backlog can
  // be large, so the whole queue is drained with a fixed, small number of bulk
  // SQL statements rather than one call per payment:
  //   1. one bulk exists-check (getBulkSparkTransactions)
  //   2. one bulk description patch for payments already received (updateOnly =>
  //      never inserts a phantom row)
  //   3. one bulk insert of unpaid invoices for payments not yet received (so
  //      the description attaches when they settle, matched by sparkID)
  //   4. one Firestore batch delete of the processed docs
  const processQueue = useCallback(async () => {
    if (!masterInfoObject?.uuid) return;
    if (!sparkAddress || !identityPubKey) return;
    if (isProcessingRef.current) return;

    isProcessingRef.current = true;

    try {
      const currentQueue = [...paymentQueueRef.current];
      console.log(`Processing ${currentQueue.length} LNURL payments`);
      if (currentQueue.length === 0) return;

      // Only items with a sparkID can be matched/attached.
      const processable = currentQueue.filter(payment => {
        if (!payment.sparkID) {
          console.warn(`Skipping payment ${payment.id} - missing sparkID`);
          return false;
        }
        return true;
      });

      const processedIds = currentQueue.map(payment => payment.id);

      if (processable.length > 0) {
        const sparkIDs = processable.map(payment => payment.sparkID);

        // One query: which of these payments already have a spark transaction
        // row (settled or pending placeholder) that just needs its description.
        const existing = await getBulkSparkTransactions(sparkIDs);

        const patchTxs = [];
        const unpaidTxs = [];

        for (const payment of processable) {
          const description = parseDescription(payment.description) || '';

          if (existing.has(payment.sparkID)) {
            // Payment already received — patch the description onto it.
            patchTxs.push({
              id: payment.sparkID,
              accountId: identityPubKey,
              details: { description },
              updateOnly: true,
            });
          } else {
            // Not received yet — pre-create the unpaid invoice so the
            // description attaches when the payment settles.
            unpaidTxs.push({
              id: payment.sparkID,
              amount: payment.amountSats,
              expiration: payment.expiredTime,
              description,
              shouldNavigate: false,
              details: {
                sendingUUID: payment.senderUUID,
                isBlitzContactPayment: payment.isBlitzContactPayment,
                createdTime: payment.createdAt,
                sharedPublicKey: payment.sharedPublicKey || '',
                sparkPubKey: payment.sparkPubKey || '',
                isLNURL: true,
              },
            });
          }
        }

        if (patchTxs.length > 0) {
          await bulkUpdateSparkTransactions(
            patchTxs,
            'transactions',
            0,
            0,
            true, // shouldUpdateDescription
          );
        }

        if (unpaidTxs.length > 0) {
          await addBulkUnpaidSparkLightningTransactions(unpaidTxs);
        }
      }

      // Drop processed items from the in-memory queue.
      paymentQueueRef.current = paymentQueueRef.current.filter(
        item => !processedIds.includes(item.id),
      );

      // One Firestore batch delete for the whole processed set.
      if (processedIds.length > 0) {
        await batchDeleteLnurlPayments(masterInfoObject.uuid, processedIds);
      }
    } catch (error) {
      console.error('Error in processQueue:', error);
      // Leave items in the queue; the next snapshot/tick retries the batch.
    } finally {
      isProcessingRef.current = false;
    }
  }, [sparkAddress, identityPubKey, masterInfoObject.uuid]);

  return null;
}
