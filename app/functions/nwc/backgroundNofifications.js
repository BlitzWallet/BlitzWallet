import {
  getNWCData,
  getSupportedMethods,
  isWithinNWCBalanceTimeFrame,
  splitAndStoreNWCData,
} from '.';
import {
  decryptMessage,
  encriptMessage,
} from '../messaging/encodingAndDecodingMessages';
import {publishToSingleRelay} from './publishResponse';
import {
  getNWCLightningReceiveRequest,
  getNWCSparkBalance,
  getNWCSparkTransactions,
  initializeNWCWallet,
  NWCSparkLightningPaymentStatus,
  nwcWallet,
  sendNWCSparkLightningPayment,
} from './wallet';
import bolt11 from 'bolt11';
import {getSparkPaymentStatus, sparkPaymentType} from '../spark';
import {pushInstantNotification} from '../notifications';
import NWCInvoiceManager from './cachedNWCTxs';
import {NOSTR_RELAY_URL, NWC_IDENTITY_PUB_KEY} from '../../constants';
import {finalizeEvent, nip44} from 'nostr-tools';
import {getFunctions} from '@react-native-firebase/functions';
import fetchBackend from '../../../db/handleBackend';
import {getLocalStorageItem} from '../localStorage';
import sha256Hash from '../hash';

const handledEventIds = new Set();
let nwcAccounts, fullStorageObject;
let walletInitializationPromise = null;

const RELAY_URL = NOSTR_RELAY_URL;

const ERROR_CODES = {
  INTERNAL: 'INTERNAL',
  RESTRICTED: 'RESTRICTED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
};

const createErrorResponse = (method, code, message) => ({
  result_type: method,
  error: {code, message},
});

const ensureWalletConnection = async () => {
  if (nwcWallet) {
    return {isConnected: true};
  }

  if (walletInitializationPromise) {
    console.log('Wallet initialization already in progress, waiting...');
    return await walletInitializationPromise;
  }

  walletInitializationPromise = initializeNWCWallet();

  try {
    const result = await walletInitializationPromise;
    // Clear the promise on successful completion
    walletInitializationPromise = null;
    return result;
  } catch (error) {
    // Clear the promise on error so retry is possible
    walletInitializationPromise = null;
    throw error;
  }
};

const handleGetInfo = selectedNWCAccount => ({
  result_type: 'get_info',
  result: {
    alias: 'N/A',
    color: 'N/A',
    pubkey: 'N/A',
    network: 'mainnet',
    block_height: 1,
    block_hash: 'N/A',
    methods: getSupportedMethods(selectedNWCAccount.permissions),
    notifications: ['payment_received'],
  },
});

const handleGetTransactions = async requestParams => {
  const connectResponse = await ensureWalletConnection();
  if (!connectResponse.isConnected) {
    return createErrorResponse(
      'list_transactions',
      ERROR_CODES.INTERNAL,
      'Unable to connect to wallet',
    );
  }

  const {from, until, limit = 20, offset = 0, type} = requestParams;

  let allTransactions = [];
  let currentOffset = 0;
  const chunkSize = 100;
  let hasMore = true;

  while (hasMore) {
    const chunk = await getNWCSparkTransactions(chunkSize, currentOffset);

    if (!chunk || chunk.transfers.length === 0) {
      hasMore = false;
      break;
    }

    allTransactions = allTransactions.concat(chunk.transfers);
    currentOffset += chunkSize;

    // Stop fetching if we have enough for this request (with buffer for filtering)
    if (allTransactions.length >= offset + limit) {
      break;
    }

    // Stop if we got less than requested (end of data)
    if (chunk.transfers.length < chunkSize) {
      hasMore = false;
    }
  }

  let filteredTransactions = allTransactions.filter(tx => {
    // Filter by timestamp range if provided
    const type = sparkPaymentType(tx);
    if (tx === 'sparl') return false;
    if (from || until) {
      const txTime = tx.createdTime
        ? new Date(tx.createdTime).getTime() / 1000
        : null;
      if (!txTime) return false;

      if (from && txTime < from) return false;
      if (until && txTime > until) return false;
    }

    // Filter by transaction type if specified
    if (type) {
      const isIncoming = tx.transferDirection === 'INCOMING';
      const isOutgoing = tx.transferDirection === 'OUTGOING';

      if (type === 'incoming' && !isIncoming) return false;
      if (type === 'outgoing' && !isOutgoing) return false;
    }

    return true;
  });

  const paginatedTransactions = filteredTransactions.slice(
    offset,
    offset + limit,
  );

  const formatted = paginatedTransactions.map(tx => ({
    type: tx.transferDirection?.toLowerCase() || 'unknown',
    invoice: '',
    description: '',
    description_hash: null,
    preimage: '',
    payment_hash: '',
    amount: tx.totalValue * 1000,
    fees_paid: 0,
    created_at: tx.createdTime
      ? Math.floor(new Date(tx.createdTime).getTime() / 1000)
      : null,
    settled_at: tx.expiryTime
      ? Math.floor(new Date(tx.updatedTime).getTime() / 1000)
      : null,
    metadata: {},
  }));

  return {
    result_type: 'list_transactions',
    result: {
      transactions: formatted,
    },
  };
};

const handleMakeInvoice = async (
  requestParams,
  selectedNWCAccount,
  fullStorageObject,
  event,
) => {
  const sparkPubKey = JSON.parse(
    await getLocalStorageItem(NWC_IDENTITY_PUB_KEY),
  );

  if (!sparkPubKey) {
    return createErrorResponse(
      'make_invoice',
      ERROR_CODES.INTERNAL,
      'Unable to connect to wallet',
    );
  }

  await fetchBackend(
    'handleNWCEvent',
    {
      requestMethod: 'make_invoice',
      amount: Math.round(requestParams.amount / 1000),
      description: requestParams.description,
      expiry: requestParams.expiry,
      publicKey: selectedNWCAccount.publicKey,
      privateKey: selectedNWCAccount.privateKey,
      sparkIdentityPubKey: sparkPubKey,
      event: {clientPubKey: event.clientPubKey, id: event.id},
    },
    selectedNWCAccount.privateKey,
    selectedNWCAccount.publicKey,
  );
  await splitAndStoreNWCData({
    ...fullStorageObject,
    accounts: {
      ...fullStorageObject.accounts,
      [selectedNWCAccount.publicKey]: {
        ...selectedNWCAccount,
        shouldGetNewBalance: true,
      },
    },
  });
};

const handlePublish = async (data, nwcAccounts) => {
  const formattedEvents = data.requestObjects.map(item => {
    const account = nwcAccounts[item.account];
    console.log({
      notification_type: item.notification_type,
      notificaion: item.notification,
    });

    const coversationKey = nip44.v2.utils.getConversationKey(
      account.privateKey,
      item.event.clientPubKey,
    );

    const legacyNWCNotificationResponse = {
      kind: 23196,
      created_at: Math.round(Date.now() / 1000),
      tags: [
        ['p', item.event.clientPubKey],
        ['e', item.event.id],
      ],
      content: encriptMessage(
        account.privateKey,
        item.event.clientPubKey,
        JSON.stringify({
          notification_type: item.notification_type,
          notificaion: item.notification,
        }),
      ),
    };
    const newNWCNotificationResponse = {
      kind: 23197,
      created_at: Math.round(Date.now() / 1000),
      tags: [['p', item.event.clientPubKey]],
      content: nip44.v2.encrypt(
        JSON.stringify({
          notification_type: item.notification_type,
          notificaion: item.notification,
        }),
        coversationKey,
      ),
    };
    console.log(legacyNWCNotificationResponse, newNWCNotificationResponse);

    const finalizedEventLeg = finalizeEvent(
      legacyNWCNotificationResponse,
      Buffer.from(account.privateKey, 'hex'),
    );
    const finalizedEventNew = finalizeEvent(
      newNWCNotificationResponse,
      Buffer.from(account.privateKey, 'hex'),
    );
    return [finalizedEventLeg, finalizedEventNew];
  });

  // Post all events in parallel and wait for all to complete
  const publishPromises = formattedEvents
    .flat(1)
    .map(event => publishToSingleRelay([event], RELAY_URL));

  try {
    const results = await Promise.all(publishPromises);
    console.log('All events published successfully:', results);
  } catch (error) {
    console.error('Error publishing events:', error);
  }
};

const handleLookupInvoice = async (
  requestParams,
  event,
  selectedNWCAccount,
) => {
  let foundInvoice = null;
  const {payment_hash, invoice} = requestParams;
  try {
    foundInvoice = await NWCInvoiceManager.handleLookupInvoice(requestParams);
  } catch (err) {
    console.log('Error handling lookup', err);
    return createErrorResponse(
      'lookup_invoice',
      ERROR_CODES.INTERNAL,
      err.message,
    );
  }

  if (foundInvoice) {
    const {sparkID, ...invoiceWithoutSparkID} = foundInvoice;
    if (invoiceWithoutSparkID.status !== 'pending') {
      return {
        result_type: 'lookup_invoice',
        result: invoiceWithoutSparkID,
      };
    }

    const connectResponse = await ensureWalletConnection();
    if (!connectResponse.isConnected) {
      return createErrorResponse(
        'lookup_invoice',
        ERROR_CODES.INTERNAL,
        'Unable to connect to wallet',
      );
    }

    let sparkPaymentResponse;
    if (invoiceWithoutSparkID.type === 'INCOMING') {
      sparkPaymentResponse = await getNWCLightningReceiveRequest(sparkID);
    } else {
      sparkPaymentResponse = await NWCSparkLightningPaymentStatus(sparkID);
    }

    if (!sparkPaymentResponse.didWork)
      return createErrorResponse(
        'lookup_invoice',
        ERROR_CODES.INTERNAL,
        'Unable to lookup invoice.',
      );
    const data = sparkPaymentResponse.paymentResponse;
    const status = getSparkPaymentStatus(data.status);

    if (status !== 'pending') {
      await NWCInvoiceManager.markInvoiceAsNotPending(
        invoiceWithoutSparkID.payment_hash,
        status,
        data.paymentPreimage,
      );
      return {
        result_type: 'lookup_invoice',
        result: {
          ...invoiceWithoutSparkID,
          status: status,
          preimage: data.paymentPreimage || '',
          settled_at: Date.now(),
        },
      };
    }
    return {
      result_type: 'lookup_invoice',
      result: invoiceWithoutSparkID,
    };
  }

  await fetchBackend(
    'handleNWCEvent',
    {
      requestMethod: 'lookup_invoice',
      invoice: invoice,
      payment_hash: payment_hash,
      publicKey: selectedNWCAccount.publicKey,
      privateKey: selectedNWCAccount.privateKey,
      event: {clientPubKey: event.clientPubKey, id: event.id},
    },
    selectedNWCAccount.privateKey,
    selectedNWCAccount.publicKey,
  );
};

const handlePayInvoice = async (
  requestParams,
  selectedNWCAccount,
  fullStorageObject,
) => {
  const connectResponse = await ensureWalletConnection();

  const decoded = bolt11.decode(requestParams.invoice);
  const paymentAmount = Math.round(decoded.millisatoshis / 1000);
  const timeFrame = isWithinNWCBalanceTimeFrame(
    selectedNWCAccount.budgetRenewalSettings.option,
    selectedNWCAccount.lastRotated,
  );

  if (
    selectedNWCAccount.budgetRenewalSettings.amount !== 'Unlimited' &&
    selectedNWCAccount.budgetRenewalSettings.amount <
      selectedNWCAccount.totalSent + paymentAmount &&
    timeFrame
  ) {
    return createErrorResponse(
      'pay_invoice',
      ERROR_CODES.QUOTA_EXCEEDED,
      'The wallet has exceeded its spending quota.',
    );
  } else if (!timeFrame) {
    await splitAndStoreNWCData({
      ...fullStorageObject,
      accounts: {
        ...fullStorageObject.accounts,
        [selectedNWCAccount.publicKey]: {
          ...selectedNWCAccount,
          lastRotated: new Date().getTime(),
          totalSent: 0,
        },
      },
    });
  }

  if (!connectResponse.isConnected) {
    // const currentExpense
    return createErrorResponse(
      'pay_invoice',
      ERROR_CODES.INTERNAL,
      'Unable to connect to wallet',
    );
  }

  const invoice = await sendNWCSparkLightningPayment({
    invoice: requestParams.invoice,
  });

  if (!invoice.didWork) {
    return createErrorResponse(
      'pay_invoice',
      ERROR_CODES.INTERNAL,
      'Unable to send payment',
    );
  }

  const response = invoice.paymentResponse;
  await new Promise(res => setTimeout(res, 1000));

  const status = await NWCSparkLightningPaymentStatus(response.id);

  await NWCInvoiceManager.storeCreatedInvoice({
    payment_hash: sha256Hash(status?.paymentResponse?.paymentPreimage || ''),
    invoice: response.encodedInvoice,
    amount: paymentAmount,
    fee: Math.round(response.fee.originalValue / 1000),
    description: '',
    status: getSparkPaymentStatus(status?.paymentResponse.status),
    created_at: response.createdAt,
    sparkID: response.id,
    type: 'OUTGOING',
    preimage: status?.paymentResponse?.paymentPreimage || '',
  });

  if (!status.didWork) {
    return createErrorResponse(
      'pay_invoice',
      ERROR_CODES.INTERNAL,
      'Unable to retrieve payment status',
    );
  }

  await splitAndStoreNWCData({
    ...fullStorageObject,
    accounts: {
      ...fullStorageObject.accounts,
      [selectedNWCAccount.publicKey]: {
        ...selectedNWCAccount,
        shouldGetNewBalance: true,
      },
    },
  });

  return {
    result_type: 'pay_invoice',
    result: {
      preimage: status.paymentResponse.paymentPreimage || '',
    },
  };
};

const handleGetBalance = async (selectedNWCAccount, fullStorageObject) => {
  console.log('running in get balance');
  if (
    !selectedNWCAccount.shouldGetNewBalance &&
    selectedNWCAccount.walletBalance &&
    selectedNWCAccount.lastChecked - Date.now() < 60 * 60
  ) {
    console.log('running cached wallet balance');
    return {
      result_type: 'get_balance',
      result: {
        balance: Number(selectedNWCAccount.walletBalance) * 1000,
      },
    };
  }
  const connectResponse = await ensureWalletConnection();
  console.log('conection response');
  if (!connectResponse.isConnected) {
    return createErrorResponse(
      'get_balance',
      ERROR_CODES.INTERNAL,
      'Unable to connect to wallet',
    );
  }

  const balance = await getNWCSparkBalance();

  await splitAndStoreNWCData({
    ...fullStorageObject,
    accounts: {
      ...fullStorageObject.accounts,
      [selectedNWCAccount.publicKey]: {
        ...selectedNWCAccount,
        shouldGetNewBalance: false,
        walletBalance: Number(balance.balance),
        lastChecked: Date.now(),
      },
    },
  });
  return {
    result_type: 'get_balance',
    result: {
      balance: Number(balance.balance) * 1000,
    },
  };
};

const processEvent = async (event, selectedNWCAccount) => {
  const {requestMethod, requestParams} = event;

  console.log('request method', requestMethod);
  console.log('request params', requestParams);

  let returnObject;

  switch (requestMethod) {
    case 'get_info':
      returnObject = handleGetInfo(selectedNWCAccount);
      break;

    case 'list_transactions':
      if (!selectedNWCAccount.permissions.transactionHistory) {
        returnObject = createErrorResponse(
          requestMethod,
          ERROR_CODES.RESTRICTED,
          'Requested service is not authorized',
        );
        break;
      }
      returnObject = await handleGetTransactions(requestParams);
      break;
    case 'make_invoice':
      if (!selectedNWCAccount.permissions.receivePayments) {
        returnObject = createErrorResponse(
          requestMethod,
          ERROR_CODES.RESTRICTED,
          'Requested service is not authorized',
        );
        break;
      }
      await handleMakeInvoice(
        requestParams,
        selectedNWCAccount,
        fullStorageObject,
        event,
      );
      break;
    case 'lookup_invoice':
      if (!selectedNWCAccount.permissions.lookupInvoice) {
        returnObject = createErrorResponse(
          requestMethod,
          ERROR_CODES.RESTRICTED,
          'Requested service is not authorized',
        );
        break;
      }
      await handleLookupInvoice(requestParams, event, selectedNWCAccount);
      break;
    case 'pay_invoice':
      if (!selectedNWCAccount.permissions.sendPayments) {
        returnObject = createErrorResponse(
          requestMethod,
          ERROR_CODES.RESTRICTED,
          'Requested service is not authorized',
        );
        break;
      }
      returnObject = await handlePayInvoice(
        requestParams,
        selectedNWCAccount,
        fullStorageObject,
      );
      break;

    case 'get_balance':
      if (!selectedNWCAccount.permissions.getBalance) {
        returnObject = createErrorResponse(
          requestMethod,
          ERROR_CODES.RESTRICTED,
          'Requested service is not authorized',
        );
        break;
      }
      returnObject = await handleGetBalance(
        selectedNWCAccount,
        fullStorageObject,
      );
      break;

    default:
      returnObject = createErrorResponse(
        requestMethod,
        ERROR_CODES.RESTRICTED,
        'Requested service is not authorized',
      );
  }

  if (typeof returnObject !== 'object' || returnObject === null) {
    console.log('Invalid return object from event handler:', returnObject);
    return;
  }

  return returnObject;
};

function decryptEventMessage(selectedNWCAccount, event) {
  const decryptedContent = decryptMessage(
    selectedNWCAccount.privateKey,
    event.clientPubKey,
    event.content,
  );

  const data = JSON.parse(decryptedContent);
  return data;
}

export default async function handleNWCBackgroundEvent(notificationData) {
  try {
    // Initialize accounts if not already done
    if (__DEV__) {
      getFunctions().useEmulator(process.env.DEVICE_IP, 5001);
    }
    let {
      data: {body: nwcEvent},
    } = notificationData;
    console.log('background nwc event', nwcEvent);
    if (!nwcEvent) return;

    try {
      nwcEvent = JSON.parse(nwcEvent);
    } catch (err) {
      nwcEvent = nwcEvent;
    }

    fullStorageObject = await getNWCData();
    nwcAccounts = fullStorageObject.accounts;

    if (nwcEvent.requestMethod === 'publish_notification') {
      await handlePublish(nwcEvent, nwcAccounts);
      return;
    }

    // // Filter out already handled events upfront
    const newEvents = nwcEvent?.events;
    if (!newEvents) return;

    pushInstantNotification(
      `Received ${newEvents.length} event${newEvents.length === 1 ? '' : 's'}`,
      'Nostr Connect',
    );

    const filteredEvents = newEvents
      .map((event, index) => {
        const selectedNWCAccount = nwcAccounts[event.pubkey];
        const parsedData = decryptEventMessage(selectedNWCAccount, event);

        const {method: requestMethod, params: requestParams} = parsedData;
        const handledKey = `${event.clientPubKey}-${requestMethod}`;

        if (handledEventIds.has(handledKey)) return false;
        handledEventIds.add(handledKey);
        return {requestMethod, requestParams, ...event, content: parsedData};
      })
      .filter(Boolean);

    await filteredEvents.forEach(async (event, index) => {
      const selectedNWCAccount = nwcAccounts[event.pubkey];
      console.log(selectedNWCAccount, 'SELECTED NWC ACCOUNT');
      if (!selectedNWCAccount) return null;

      try {
        const returnObject = await processEvent(event, selectedNWCAccount);
        if (!returnObject) return;

        const eventTemplate = {
          kind: 23195,
          created_at: Math.floor(Date.now() / 1000),
          tags: [
            ['p', event.clientPubKey],
            ['e', event.id],
          ],
          content: encriptMessage(
            selectedNWCAccount.privateKey,
            event.clientPubKey,
            JSON.stringify(returnObject),
          ),
        };

        const finalizedEvent = finalizeEvent(
          eventTemplate,
          Buffer.from(selectedNWCAccount.privateKey, 'hex'),
        );

        await publishToSingleRelay([finalizedEvent], RELAY_URL);
      } catch (error) {
        console.error('Error processing event:', event.id, error);
        return null;
      }
    });
    handledEventIds.clear();
  } catch (err) {
    console.error('Error handling background nwc event', err);
  }
}
