import {
  getNWCData,
  getSupportedMethods,
  isWithinNWCBalanceTimeFrame,
  splitAndStoreNWCData,
} from '.';
import * as nostr from 'nostr-tools';
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
  receiveNWCSparkLightningPayment,
  sendNWCSparkLightningPayment,
} from './wallet';
import sha256Hash from '../hash';
import bolt11 from 'bolt11';
import {getSparkPaymentStatus, sparkPaymentType} from '../spark';
import {pushInstantNotification} from '../notifications';
import NWCInvoiceManager from './cachedNWCTxs';
import {NOSTR_RELAY_URL} from '../../constants';

// const handledEventIds = new Set();
let nwcAccounts, fullStorageObject;
let walletInitializationPromise = null;

const RELAY_URL = NOSTR_RELAY_URL;

const ERROR_CODES = {
  INTERNAL: 'INTERNAL',
  RESTRICTED: 'RESTRICTED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
};
// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  maxBatchSize: 20,
  batchDelay: 50,
  maxRetries: 3,
  retryDelay: 2000,
  backgroundTimeout: 120_000,
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

// Helper function to extract and validate zap event from invoice metadata
const extractZapEvent = invoice => {
  try {
    if (!invoice?.metadata?.nostr) {
      return null;
    }

    const zapEvent = invoice.metadata.nostr;

    // Validate that it's a zap event (kind 9734)
    if (zapEvent.kind !== 9734) {
      return null;
    }

    // Validate required fields
    if (
      !zapEvent.id ||
      !zapEvent.sig ||
      !zapEvent.pubkey ||
      !zapEvent.created_at
    ) {
      console.error('Invalid zap event: missing required fields');
      return null;
    }

    // Validate signature
    const isValidSignature = nostr.verifySignature(zapEvent);
    if (!isValidSignature) {
      console.error('Invalid zap event signature');
      return null;
    }

    return zapEvent;
  } catch (error) {
    console.error('Error extracting zap event:', error);
    return null;
  }
};

// Helper function to get relays from zap event
const getRelaysFromZapEvent = zapEvent => {
  const relayTags = zapEvent.tags.filter(tag => tag[0] === 'relays');
  if (relayTags.length > 0) {
    // Return all relay URLs from the relays tag (excluding the first element which is 'relays')
    return relayTags[0].slice(1);
  }
  // Fallback to default relay if no relays specified
  return [RELAY_URL];
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
) => {
  const connectResponse = await ensureWalletConnection();
  if (!connectResponse.isConnected) {
    return createErrorResponse(
      'make_invoice',
      ERROR_CODES.INTERNAL,
      'Unable to connect to wallet',
    );
  }

  const invoice = await receiveNWCSparkLightningPayment({
    amountSats: Math.round(requestParams.amount / 1000),
    memo: requestParams.description,
    expirySeconds: requestParams.expiry,
  });

  if (!invoice.didWork) {
    return createErrorResponse(
      'make_invoice',
      ERROR_CODES.INTERNAL,
      'Unable to generate invoice',
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

  const response = invoice.response;
  NWCInvoiceManager.storeCreatedInvoice({
    payment_hash: response.invoice.paymentHash,
    invoice: response.invoice.encodedInvoice,
    amount: response.invoice.amount.originalValue,
    description: requestParams.description || '',
    status: 'pending',
    expires_at: response.invoice.expiresAt,
    sparkID: response.id,
    type: 'INCOMING',
    fee: 0,
    preimage: '',
  });
  return {
    result_type: 'make_invoice',
    result: {
      type: 'incoming',
      invoice: response.invoice.encodedInvoice,
      description: requestParams.description || '',
      description_hash: requestParams.description
        ? sha256Hash(requestParams.description)
        : '',
      payment_hash: response.invoice.paymentHash,
      amount: response.invoice.amount.originalValue,
      created_at: response.invoice.createdAt,
      expires_at: response.invoice.expiresAt,
      metadata: {},
    },
  };
};

const handleLookupInvoice = async requestParams => {
  let foundInvoice;
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

  if (!foundInvoice) {
    return createErrorResponse(
      'lookup_invoice',
      ERROR_CODES.INTERNAL,
      'Unable to find invoice.',
    );
  }
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
};

const handlePayInvoice = async (
  requestParams,
  selectedNWCAccount,
  fullStorageObject,
) => {
  const hasAlreadyPaid = await NWCInvoiceManager.handleLookupInvoice({
    invoice: requestParams.invoice,
  });
  if (hasAlreadyPaid) {
    return createErrorResponse(
      'pay_invoice',
      ERROR_CODES.INTERNAL,
      'Already paid this invoice.',
    );
  }
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
  await new Promise(res => setTimeout(res, 5000));

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

  // Handle zap event if present
  const zapEvent = extractZapEvent(invoice);
  if (zapEvent) {
    try {
      // Create zap receipt (kind 9735)
      const zapReceipt = {
        kind: 9735,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['bolt11', requestParams.invoice],
          ['preimage', status.paymentResponse.paymentPreimage || ''],
          ['p', zapEvent.pubkey], // Original zap sender
          ['description', JSON.stringify(zapEvent)],
        ],
        content: '',
      };

      // Add event and pubkey tags from original zap event
      const eTags = zapEvent.tags.filter(tag => tag[0] === 'e');
      const pTags = zapEvent.tags.filter(tag => tag[0] === 'p');
      zapReceipt.tags.push(...eTags);
      zapReceipt.tags.push(...pTags);

      // Sign the zap receipt
      const signedZapReceipt = nostr.finalizeEvent(
        zapReceipt,
        Buffer.from(selectedNWCAccount.privateKey, 'hex'),
      );

      // Get relays from the original zap event
      const relays = getRelaysFromZapEvent(zapEvent);

      // Publish zap receipt to specified relays
      const publishPromises = relays.map(relay =>
        publishToSingleRelay([signedZapReceipt], relay).catch(error => {
          console.error(`Failed to publish zap receipt to ${relay}:`, error);
        }),
      );

      // Don't wait for all publishes to complete to avoid blocking the response
      Promise.allSettled(publishPromises).then(results => {
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        console.log(
          `Zap receipt published to ${successful}/${relays.length} relays (${failed} failed)`,
        );
      });

      console.log('Zap receipt created and published:', signedZapReceipt.id);
    } catch (error) {
      console.error('Error handling zap event:', error);
      // Don't fail the payment response if zap handling fails
    }
  }

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
    selectedNWCAccount.walletBalance
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
  const decryptedContent = decryptMessage(
    selectedNWCAccount.privateKey,
    event.clientPubKey,
    event.content,
  );

  const data = JSON.parse(decryptedContent);
  const {method: requestMethod, params: requestParams} = data;

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
      returnObject = await handleMakeInvoice(
        requestParams,
        selectedNWCAccount,
        fullStorageObject,
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
      returnObject = await handleLookupInvoice(requestParams);
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

  return returnObject;
};

export default async function handleNWCBackgroundEvent(notificationData) {
  const startTime = Date.now();
  try {
    // Initialize accounts if not already done

    fullStorageObject = await getNWCData();
    nwcAccounts = fullStorageObject.accounts;

    let {
      data: {body: nwcEvent},
    } = notificationData;
    console.log('background nwc event', nwcEvent);
    console.log(nwcAccounts);
    if (!nwcEvent) return;

    try {
      nwcEvent = JSON.parse(nwcEvent);
    } catch (err) {}

    // // Filter out already handled events upfront
    const newEvents = nwcEvent.events;
    console.log('new NWC events', newEvents);

    pushInstantNotification(
      `Received ${newEvents.length} event${newEvents.length === 1 ? '' : 's'}`,
      'Nostr Connect',
    );

    // nwcEvent.events.filter(event => {
    //   console.log(event, handledEventIds);
    //   if (handledEventIds.has(event.id)) return false;
    //   handledEventIds.add(event.id);
    //   return true;
    // });

    // console.log(newEvents);
    // if (newEvents.length === 0) {
    //   console.log('No new events to process');
    //   return;
    // }

    const eventPromises = newEvents.map(async (event, index) => {
      const selectedNWCAccount = nwcAccounts[event.pubkey];
      console.log(selectedNWCAccount, 'SELECTED NWC ACCOUNT');
      if (!selectedNWCAccount) return null;

      try {
        const eventTimeout = Math.max(
          3000,
          (RATE_LIMIT_CONFIG.backgroundTimeout - (Date.now() - startTime)) /
            newEvents.length,
        );

        const returnObject = await Promise.race([
          processEvent(event, selectedNWCAccount),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('Event processing timeout')),
              eventTimeout,
            ),
          ),
        ]);

        console.log(returnObject, 'NWC return object');

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

        const finalizedEvent = nostr.finalizeEvent(
          eventTemplate,
          Buffer.from(selectedNWCAccount.privateKey, 'hex'),
        );

        return finalizedEvent;
      } catch (error) {
        console.error('Error processing event:', event.id, error);
        return null;
      }
    });

    //  Wait for all events to be processed with overall timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error('Overall processing timeout')),
        RATE_LIMIT_CONFIG.backgroundTimeout - 5000,
      ),
    );

    const processedEvents = await Promise.race([
      Promise.allSettled(eventPromises),
      timeoutPromise,
    ]);

    await publishToSingleRelay(
      processedEvents
        .map(item => (item.status === 'fulfilled' ? item.value : false))
        .filter(Boolean),
      RELAY_URL,
    );
  } catch (err) {
    console.error('Error handling background nwc event', err);
  }
}
