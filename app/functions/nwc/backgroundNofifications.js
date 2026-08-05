import {
  getNWCData,
  getSupportedMethods,
  isWithinNWCBalanceTimeFrame,
  splitAndStoreNWCData,
} from '.';
import { publishToSingleRelay } from './publishResponse';
import { nwcEventLedger } from './eventLedger';
import bolt11 from '../decodeBolt11';
import { pushInstantNotification } from '../notifications';
import NWCInvoiceManager from './cachedNWCTxs';
import { NOSTR_RELAY_URL } from '../../constants';
import { finalizeEvent, verifyEvent, nip44 } from 'nostr-tools';
import sha256Hash from '../hash';
import {
  decryptMessage,
  encriptMessage,
} from '../messaging/encodingAndDecodingMessages';

let nwcAccounts, fullStorageObject;
let walletInitializationPromise = null;
let walletModule = null;

const RELAY_URL = NOSTR_RELAY_URL;
const MAX_EVENT_AGE_SECONDS = 300;
const BALANCE_CACHE_MS = 5 * 60 * 1000;
const DEFAULT_INVOICE_EXPIRY_SECONDS = 60 * 60 * 12;

const ERROR_CODES = {
  INTERNAL: 'INTERNAL',
  RESTRICTED: 'RESTRICTED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  NOT_FOUND: 'NOT_FOUND',
};

const createErrorResponse = (method, code, message) => ({
  result_type: method,
  error: { code, message },
});

// Publishes an NWC notification (NWC-02) to the client. The tester and other
// legacy clients listen for kind 23196 with legacy encryption, while NIP-44
// capable clients listen for kind 23197.
const publishNWCNotification = async ({
  clientPubKey,
  accountPrivateKey,
  notificationPayload,
}) => {
  const now = Math.floor(Date.now() / 1000);
  const serializedContent = JSON.stringify(notificationPayload);
  const events = [];

  const legacyContent = encriptMessage(
    accountPrivateKey,
    clientPubKey,
    serializedContent,
  );
  if (legacyContent) {
    events.push(
      finalizeEvent(
        {
          kind: 23196,
          created_at: now,
          tags: [['p', clientPubKey]],
          content: legacyContent,
        },
        Buffer.from(accountPrivateKey, 'hex'),
      ),
    );
  }

  try {
    const nip44Content = nip44.encrypt(
      serializedContent,
      nip44.getConversationKey(
        Buffer.from(accountPrivateKey, 'hex'),
        clientPubKey,
      ),
    );
    events.push(
      finalizeEvent(
        {
          kind: 23197,
          created_at: now,
          tags: [['p', clientPubKey]],
          content: nip44Content,
        },
        Buffer.from(accountPrivateKey, 'hex'),
      ),
    );
  } catch (err) {
    console.error('Error encrypting NIP-44 notification', err);
  }

  if (events.length > 0) {
    await publishToSingleRelay(events, RELAY_URL);
  }
};

// The Spark SDK is heavy; it is only required on demand by methods that need a
// live wallet (make_invoice, pay_invoice, pending lookup, uncached balance,
// list_transactions). get_info, cached lookups and cached balance never load it.
const getWalletModule = () => {
  if (!walletModule) {
    walletModule = require('./wallet');
  }
  return walletModule;
};

const getSparkModule = () => require('../spark');

const ensureWalletConnection = async () => {
  const wallet = getWalletModule();

  if (wallet.nwcWallet) {
    return { isConnected: true };
  }

  if (walletInitializationPromise) {
    console.log('Wallet initialization already in progress, waiting...');
    return await walletInitializationPromise;
  }

  walletInitializationPromise = wallet.initializeNWCWallet();

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

  const { from, until, limit = 20, offset = 0, type } = requestParams;
  const chunkSize = limit * 2;

  let allTransactions = [];
  let currentOffset = 0;
  let hasMore = true;

  const wallet = getWalletModule();
  const spark = getSparkModule();

  while (hasMore) {
    const chunk = await wallet.getNWCSparkTransactions(
      chunkSize,
      currentOffset,
    );

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

  const filteredTransactions = allTransactions.filter(tx => {
    // Drop internal spark transfers (not lightning invoices)
    const txType = spark.sparkPaymentType(tx);
    if (txType === 'spark') return false;

    // Filter by timestamp range if provided
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

  const {
    transformTxToPaymentObject,
  } = require('../spark/transformTxToPayment');

  const formatted = await Promise.all(
    paginatedTransactions.map(async tx => {
      const transformedObjct = await transformTxToPaymentObject(
        tx,
        undefined,
        undefined,
        false,
        [],
        undefined,
        1,
      );

      return {
        type: tx.transferDirection?.toLowerCase(),
        invoice: transformedObjct.details.address,
        description: transformedObjct.details.description,
        description_hash: null,
        preimage: transformedObjct.details.preimage,
        payment_hash: sha256Hash(transformedObjct.details.preimage),
        amount: tx.totalValue * 1000,
        fees_paid: transformedObjct.details.fee,
        created_at: tx.createdTime
          ? Math.floor(new Date(tx.createdTime).getTime() / 1000)
          : null,
        settled_at: tx.expiryTime
          ? Math.floor(new Date(tx.updatedTime).getTime() / 1000)
          : null,
        metadata: {},
      };
    }),
  );

  return {
    result_type: 'list_transactions',
    result: {
      transactions: formatted,
    },
  };
};

const handleMakeInvoice = async (requestParams, selectedNWCAccount) => {
  const connectResponse = await ensureWalletConnection();
  if (!connectResponse.isConnected) {
    return createErrorResponse(
      'make_invoice',
      ERROR_CODES.INTERNAL,
      'Unable to connect to wallet',
    );
  }

  const amountMsat = requestParams.amount;
  if (!Number.isInteger(amountMsat) || amountMsat <= 0) {
    return createErrorResponse(
      'make_invoice',
      ERROR_CODES.INTERNAL,
      'Invalid amount',
    );
  }

  const amountSats = (amountMsat - (amountMsat % 1000)) / 1000;
  const expirySeconds =
    Number.isInteger(requestParams.expiry) && requestParams.expiry > 0
      ? requestParams.expiry
      : DEFAULT_INVOICE_EXPIRY_SECONDS;

  const wallet = getWalletModule();
  const receive = await wallet.receiveNWCSparkLightningPayment({
    amountSats,
    memo: requestParams.description,
    expirySeconds,
  });

  if (!receive.didWork || !receive.response) {
    return createErrorResponse(
      'make_invoice',
      ERROR_CODES.INTERNAL,
      receive.error || 'Unable to create invoice',
    );
  }

  const response = receive.response;
  const encodedInvoice = response.invoice?.encodedInvoice;
  if (!encodedInvoice) {
    return createErrorResponse(
      'make_invoice',
      ERROR_CODES.INTERNAL,
      'Unable to create invoice',
    );
  }

  try {
    await NWCInvoiceManager.storeCreatedInvoice({
      payment_hash: response.invoice.paymentHash,
      invoice: encodedInvoice,
      amount: amountSats,
      description: requestParams.description || null,
      created_at: response.invoice.createdAt,
      expires_at: response.invoice.expiresAt,
      sparkID: response.id,
      type: 'INCOMING',
      fee: 0,
      preimage: '',
    });
  } catch (err) {
    console.error('Failed to store created invoice', err);
  }

  return {
    result_type: 'make_invoice',
    result: {
      invoice: encodedInvoice,
    },
  };
};

const handleLookupInvoice = async (requestParams, selectedNWCAccount) => {
  let foundInvoice = null;
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
    const { sparkID, ...invoiceWithoutSparkID } = foundInvoice;
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

    const wallet = getWalletModule();
    const spark = getSparkModule();

    let sparkPaymentResponse;
    if (invoiceWithoutSparkID.type === 'INCOMING') {
      sparkPaymentResponse = await wallet.getNWCLightningReceiveRequest(
        sparkID,
      );
    } else {
      sparkPaymentResponse = await wallet.NWCSparkLightningPaymentStatus(
        sparkID,
      );
    }

    if (!sparkPaymentResponse.didWork)
      return createErrorResponse(
        'lookup_invoice',
        ERROR_CODES.INTERNAL,
        'Unable to lookup invoice.',
      );
    const data = sparkPaymentResponse.paymentResponse;
    const status = spark.getSparkPaymentStatus(data.status);

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

  return createErrorResponse(
    'lookup_invoice',
    ERROR_CODES.NOT_FOUND,
    'Invoice not found',
  );
};

const handlePayInvoice = async (
  requestParams,
  selectedNWCAccount,
  fullStorageObject,
  clientPubKey,
) => {
  const decoded = bolt11.decode(requestParams.invoice);
  const amountMsat = Number(decoded.millisatoshis);
  console.log(decoded);
  if (!Number.isInteger(amountMsat) || amountMsat <= 0) {
    return createErrorResponse(
      'pay_invoice',
      ERROR_CODES.INTERNAL,
      'Invalid invoice amount',
    );
  }

  const renewalSettings = selectedNWCAccount.budgetRenewalSettings || {};
  const now = Date.now();

  let spendState = null;
  try {
    spendState = await nwcEventLedger.getSpendState(
      selectedNWCAccount.publicKey,
    );
  } catch (err) {
    console.error('Error reading spend state', err);
  }

  let windowStart =
    spendState?.windowStart ?? selectedNWCAccount.lastRotated ?? now;
  let budgetSentMsat =
    spendState?.budgetSentMsat ?? (selectedNWCAccount.totalSent || 0) * 1000;

  if (!isWithinNWCBalanceTimeFrame(renewalSettings.option, windowStart)) {
    windowStart = now;
    budgetSentMsat = 0;
  }

  const budgetLimitMsat =
    renewalSettings.amount === 'Unlimited'
      ? null
      : (renewalSettings.amount || 0) * 1000;
  if (
    budgetLimitMsat !== null &&
    budgetLimitMsat < budgetSentMsat + amountMsat
  ) {
    return createErrorResponse(
      'pay_invoice',
      ERROR_CODES.QUOTA_EXCEEDED,
      'The wallet has exceeded its spending quota.',
    );
  }

  const connectResponse = await ensureWalletConnection();
  if (!connectResponse.isConnected) {
    return createErrorResponse(
      'pay_invoice',
      ERROR_CODES.INTERNAL,
      'Unable to connect to wallet',
    );
  }

  const wallet = getWalletModule();
  const invoice = await wallet.sendNWCSparkLightningPayment({
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

  const status = await wallet.NWCSparkLightningPaymentStatus(response.id);

  const spark = getSparkModule();
  const paymentStatus = spark.getSparkPaymentStatus(
    status?.paymentResponse?.status,
  );

  const feeMsat = response.fee?.originalValue || 0;
  const fee = (feeMsat - (feeMsat % 1000)) / 1000;
  const amountSats = (amountMsat - (amountMsat % 1000)) / 1000;

  await NWCInvoiceManager.storeCreatedInvoice({
    payment_hash: sha256Hash(status?.paymentResponse?.paymentPreimage || ''),
    invoice: response.encodedInvoice,
    amount: amountSats,
    fee,
    description: '',
    status: paymentStatus,
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

  const newTotalMsat = budgetSentMsat + amountMsat;
  await nwcEventLedger.setSpendState(
    selectedNWCAccount.publicKey,
    newTotalMsat,
    windowStart,
  );
  await splitAndStoreNWCData({
    ...fullStorageObject,
    accounts: {
      ...fullStorageObject.accounts,
      [selectedNWCAccount.publicKey]: {
        ...selectedNWCAccount,
        totalSent: (newTotalMsat - (newTotalMsat % 1000)) / 1000,
        lastRotated: windowStart,
      },
    },
  });

  try {
    const paymentPreimage = status?.paymentResponse?.paymentPreimage || '';
    const decodedTags = decoded.tags || [];
    const descriptionTag = decodedTags.find(
      tag => tag.tagName === 'description',
    );
    const descriptionHashTag = decodedTags.find(
      tag => tag.tagName === 'description_hash',
    );
    const paymentHashTag = decodedTags.find(
      tag => tag.tagName === 'payment_hash',
    );
    const timestampTag = decodedTags.find(
      tag => tag.tagName === 'timestamp',
    );
    const expiryTag = decodedTags.find(tag => tag.tagName === 'expiry');

    const invoiceCreatedAt =
      Number(timestampTag?.data) || Math.floor(Date.now() / 1000);
    const invoiceExpiry = Number(expiryTag?.data) || 0;

    await publishNWCNotification({
      clientPubKey,
      accountPrivateKey: selectedNWCAccount.privateKey,
      notificationPayload: {
        notification_type: 'payment_sent',
        notification: {
          type: 'outgoing',
          state: paymentStatus === 'completed' ? 'settled' : paymentStatus,
          invoice: requestParams.invoice,
          description: descriptionTag?.data || null,
          description_hash: descriptionHashTag?.data || null,
          preimage: paymentPreimage,
          payment_hash: paymentHashTag?.data || sha256Hash(paymentPreimage),
          amount: amountMsat,
          fees_paid: feeMsat,
          created_at: invoiceCreatedAt,
          expires_at: expiryTag ? invoiceCreatedAt + invoiceExpiry : null,
          settled_at: Math.floor(Date.now() / 1000),
          metadata: {},
        },
      },
    });
  } catch (err) {
    console.error('Error publishing payment_sent notification', err);
  }

  return {
    result_type: 'pay_invoice',
    result: {
      preimage: status.paymentResponse.paymentPreimage || '',
    },
  };
};

const handleGetBalance = async (selectedNWCAccount, fullStorageObject) => {
  const now = Date.now();
  const lastChecked = selectedNWCAccount.lastChecked || 0;
  const cachedBalance = Number(selectedNWCAccount.walletBalance);

  if (
    !selectedNWCAccount.shouldGetNewBalance &&
    Number.isFinite(cachedBalance) &&
    now - lastChecked < BALANCE_CACHE_MS
  ) {
    return {
      result_type: 'get_balance',
      result: {
        balance: cachedBalance * 1000,
      },
    };
  }

  const connectResponse = await ensureWalletConnection();
  if (!connectResponse.isConnected) {
    return createErrorResponse(
      'get_balance',
      ERROR_CODES.INTERNAL,
      'Unable to connect to wallet',
    );
  }

  const balance = await getWalletModule().getNWCSparkBalance();
  if (!balance || balance.balance === undefined) {
    return createErrorResponse(
      'get_balance',
      ERROR_CODES.INTERNAL,
      'Unable to retrieve balance',
    );
  }

  await splitAndStoreNWCData({
    ...fullStorageObject,
    accounts: {
      ...fullStorageObject.accounts,
      [selectedNWCAccount.publicKey]: {
        ...selectedNWCAccount,
        shouldGetNewBalance: false,
        walletBalance: Number(balance.balance),
        lastChecked: now,
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
  const { requestMethod, requestParams } = event;

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
      returnObject = await handleMakeInvoice(requestParams, selectedNWCAccount);
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
      returnObject = await handleLookupInvoice(
        requestParams,
        selectedNWCAccount,
      );
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
        event.clientPubKey,
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
  let decryptedContent = null;
  let encryptionScheme = 'legacy';

  try {
    decryptedContent = nip44.decrypt(
      event.content,
      nip44.getConversationKey(
        Buffer.from(selectedNWCAccount.privateKey, 'hex'),
        event.clientPubKey,
      ),
    );
    encryptionScheme = 'nip44';
  } catch (e) {
    decryptedContent = decryptMessage(
      selectedNWCAccount.privateKey,
      event.clientPubKey,
      event.content,
    );
  }

  if (!decryptedContent) {
    throw new Error('Unable to decrypt NWC event content');
  }

  const data = JSON.parse(decryptedContent);
  return { data, encryptionScheme };
}

function verifyAndNormalizeEvent(rawEvent, accounts) {
  if (
    !rawEvent ||
    typeof rawEvent !== 'object' ||
    typeof rawEvent.id !== 'string' ||
    typeof rawEvent.pubkey !== 'string' ||
    typeof rawEvent.created_at !== 'number' ||
    typeof rawEvent.content !== 'string' ||
    !Array.isArray(rawEvent.tags) ||
    typeof rawEvent.sig !== 'string'
  ) {
    console.error(
      'Rejected NWC event: missing raw event fields (backend must forward the signed kind 23194 event verbatim)',
      rawEvent?.id,
    );
    return null;
  }

  if (rawEvent.kind !== 23194) {
    console.error(
      'Rejected NWC event: unexpected kind',
      rawEvent.id,
      rawEvent.kind,
    );
    return null;
  }

  try {
    let newEvent = JSON.parse(JSON.stringify(rawEvent));
    if (!verifyEvent({ ...newEvent, pubkey: newEvent.clientPubKey })) {
      console.error('Rejected NWC event: invalid signature', rawEvent.id);
      return null;
    }
  } catch (e) {
    console.error('Rejected NWC event: verification error', rawEvent.id, e);
    return null;
  }

  const now = Math.floor(Date.now() / 1000);

  if (Math.abs(rawEvent.created_at - now) > MAX_EVENT_AGE_SECONDS) {
    console.error('Rejected NWC event: outside freshness window', rawEvent.id);
    return null;
  }

  const expirationTag = rawEvent.tags.find(tag => tag[0] === 'expiration');
  if (expirationTag) {
    const expiration = Number(expirationTag[1]);
    if (Number.isFinite(expiration) && expiration <= now) {
      console.error('Rejected NWC event: expired', rawEvent.id);
      return null;
    }
  }

  const accountPubkey =
    rawEvent.tags.find(tag => tag[0] === 'p')?.[1] || rawEvent.pubkey;
  const selectedNWCAccount = accounts[accountPubkey];

  if (!selectedNWCAccount) {
    console.error(
      'Rejected NWC event: no matching account',
      rawEvent.id,
      accountPubkey,
    );
    return null;
  }

  return {
    ...rawEvent,
    accountPubkey,
    selectedNWCAccount,
  };
}

export default async function handleNWCBackgroundEvent(notificationData) {
  try {
    let {
      data: { body: nwcEvent },
    } = notificationData;
    console.log('background nwc event', nwcEvent);
    if (!nwcEvent) return;

    try {
      nwcEvent = JSON.parse(nwcEvent);
    } catch (err) {}

    const newEvents = nwcEvent?.events;
    if (!newEvents) return;

    fullStorageObject = await getNWCData();
    nwcAccounts = fullStorageObject.accounts || {};

    pushInstantNotification(
      `Received ${newEvents.length} event${newEvents.length === 1 ? '' : 's'}`,
      'Nostr Connect',
    );

    const verifiedEvents = newEvents
      .map(rawEvent => verifyAndNormalizeEvent(rawEvent, nwcAccounts))
      .filter(Boolean);

    const nowMs = Date.now();

    for (const event of verifiedEvents) {
      const selectedNWCAccount = event.selectedNWCAccount;

      try {
        const claim = await nwcEventLedger.claimEvent(
          event.id,
          event.accountPubkey,
          event.created_at,
          nowMs,
        );

        if (claim !== 'claimed') {
          console.log('Skipping already-handled event:', event.id, claim);
          continue;
        }

        let parsedData;
        try {
          const parsed = decryptEventMessage(selectedNWCAccount, event);
          parsedData = parsed.data;
          event.encryptionScheme = parsed.encryptionScheme;
        } catch (e) {
          console.error('Error decrypting event:', event.id, e);
          await nwcEventLedger.markFailed(event.id, Date.now());
          continue;
        }

        if (!parsedData || typeof parsedData !== 'object') {
          console.error('Error parsing event content:', event.id);
          await nwcEventLedger.markFailed(event.id, Date.now());
          continue;
        }

        event.requestMethod = parsedData.method;
        event.requestParams = parsedData.params;
        await nwcEventLedger.setMethod(event.id, parsedData.method);

        const returnObject = await processEvent(event, selectedNWCAccount);
        if (!returnObject) {
          await nwcEventLedger.markDone(event.id, Date.now());
          continue;
        }
        console.log(returnObject);

        const serializedResponse = JSON.stringify(returnObject);
        const content =
          event.encryptionScheme === 'nip44'
            ? nip44.encrypt(
                serializedResponse,
                nip44.getConversationKey(
                  Buffer.from(selectedNWCAccount.privateKey, 'hex'),
                  event.clientPubKey,
                ),
              )
            : encriptMessage(
                selectedNWCAccount.privateKey,
                event.clientPubKey,
                serializedResponse,
              );

        const eventTemplate = {
          kind: 23195,
          created_at: Math.floor(Date.now() / 1000),
          tags: [
            ['p', event.clientPubKey],
            ['e', event.id],
          ],
          content,
        };

        const finalizedEvent = finalizeEvent(
          eventTemplate,
          Buffer.from(selectedNWCAccount.privateKey, 'hex'),
        );

        await publishToSingleRelay([finalizedEvent], RELAY_URL);
        await nwcEventLedger.markDone(event.id, Date.now());
      } catch (error) {
        console.error('Error processing event:', event.id, error);
        await nwcEventLedger.markFailed(event.id, Date.now());
      }
    }
  } catch (err) {
    console.error('Error handling background nwc event', err);
  }
}
