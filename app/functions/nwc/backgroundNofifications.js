import {
  getNWCData,
  getSupportedMethods,
  isWithinNWCBalanceTimeFrame,
  splitAndStoreNWCData,
} from '.';
import i18next from 'i18next';
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
import { getLocalStorageItem } from '../localStorage';

let walletInitializationPromise = null;
let viewerInitializationPromise = null;
let walletModule = null;

// Serializes concurrent background invocations so budget accounting and the
// storage read-modify-write cannot interleave across simultaneous pushes.
// ponytail: single global lock; fine for low-frequency NWC pushes. Move to a
// per-account lock only if throughput ever matters.
let processingLock = Promise.resolve();

const RELAY_URL = NOSTR_RELAY_URL;
const MAX_EVENT_AGE_SECONDS = 300;
const DEFAULT_INVOICE_EXPIRY_SECONDS = 60 * 60 * 12;
// Bounds per-push work from authorized clients: NIP-47 clients page with small
// limits, so these caps never reject legitimate traffic.
const MAX_EVENTS_PER_BATCH = 25;
const MAX_TRANSACTION_LIMIT = 100;
const MAX_TRANSACTION_OFFSET = 10000;

const ERROR_CODES = {
  INTERNAL: 'INTERNAL',
  RESTRICTED: 'RESTRICTED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  NOT_FOUND: 'NOT_FOUND',
};

// User-facing push fired only after an event was successfully handled and its
// response published, describing what was actually done. Values are i18next
// keys under pushNotifications.nwc.* so the push shows in the user's language.
const EVENT_SUCCESS_NOTIFICATIONS = {
  get_info: 'pushNotifications.nwc.get_info',
  get_balance: 'pushNotifications.nwc.get_balance',
  list_transactions: 'pushNotifications.nwc.list_transactions',
  make_invoice: 'pushNotifications.nwc.make_invoice',
  lookup_invoice: 'pushNotifications.nwc.lookup_invoice',
  pay_invoice: 'pushNotifications.nwc.pay_invoice',
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
// live wallet (make_invoice, pay_invoice, pending lookup). get_info and cached
// lookups never load it, and get_balance / list_transactions only need the
// watch-only (readonly) viewer.
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

// Same as ensureWalletConnection, but for the watch-only (readonly) viewer used
// by get_balance and list_transactions.
const ensureWalletViewerConnection = async () => {
  const wallet = getWalletModule();

  if (viewerInitializationPromise) {
    console.log('Wallet viewer initialization already in progress, waiting...');
    return await viewerInitializationPromise;
  }

  viewerInitializationPromise = wallet.initializeNWCWalletViewer();

  try {
    const result = await viewerInitializationPromise;
    // Clear the promise on successful completion
    viewerInitializationPromise = null;
    return result;
  } catch (error) {
    // Clear the promise on error so retry is possible
    viewerInitializationPromise = null;
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

  // Clamp pagination to bound work: an uncapped offset would make the loop
  // below page through the whole transfer history (holding the processing
  // lock), and an uncapped limit could overflow chunkSize to unsafe integers.
  // Numeric strings are accepted because clients send them; the old code
  // string-concatenated those into the offset and returned the wrong rows.
  const { from, until, type } = requestParams;
  let limit = Math.floor(Number(requestParams.limit));
  let offset = Math.floor(Number(requestParams.offset));
  if (!Number.isFinite(limit) || limit <= 0) limit = 20;
  if (!Number.isFinite(offset) || offset < 0) offset = 0;
  limit = Math.min(limit, MAX_TRANSACTION_LIMIT);
  // Past the ceiling the page is reported as exhausted rather than clamped:
  // clamping would hand a client paging to the end the same rows forever.
  if (offset > MAX_TRANSACTION_OFFSET) {
    return {
      result_type: 'list_transactions',
      result: {
        transactions: [],
      },
    };
  }
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

// The invoice cache stores an internal shape (uppercase `type`, sat amounts,
// millisecond timestamps, `status`). NIP-47 clients such as Alby Go do no
// normalization — they cast the response straight to their transaction type —
// so convert here: `state` ("settled" | "pending" | "failed"), lowercase
// `type`, msat amounts and second-based timestamps.
const toNip47Transaction = invoice => ({
  type: invoice.type?.toLowerCase(),
  state: invoice.status === 'completed' ? 'settled' : invoice.status,
  invoice: invoice.invoice,
  description: invoice.description || null,
  description_hash: null,
  preimage: invoice.preimage || '',
  payment_hash: invoice.payment_hash,
  amount: (invoice.amount || 0) * 1000,
  fees_paid: (invoice.fees_paid || 0) * 1000,
  created_at: invoice.created_at ? Math.floor(invoice.created_at / 1000) : null,
  expires_at: invoice.expires_at ? Math.floor(invoice.expires_at / 1000) : null,
  settled_at: invoice.settled_at ? Math.floor(invoice.settled_at / 1000) : null,
  metadata: {},
});

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
        result: toNip47Transaction(invoiceWithoutSparkID),
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
    const trueStatus = status === 'completed' ? 'settled' : status;

    if (trueStatus !== 'pending') {
      await NWCInvoiceManager.markInvoiceAsNotPending(
        invoiceWithoutSparkID.payment_hash,
        trueStatus,
        data.paymentPreimage,
      );
      return {
        result_type: 'lookup_invoice',
        result: toNip47Transaction({
          ...invoiceWithoutSparkID,
          status: trueStatus,
          preimage: data.paymentPreimage || '',
          settled_at: Date.now(),
        }),
      };
    }
    return {
      result_type: 'lookup_invoice',
      result: toNip47Transaction(invoiceWithoutSparkID),
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

  if (!Number.isInteger(amountMsat) || amountMsat <= 0) {
    return createErrorResponse(
      'pay_invoice',
      ERROR_CODES.INTERNAL,
      'Invalid invoice amount',
    );
  }

  // Idempotency: never pay the same invoice twice. A prior attempt — including
  // a stale-processing reclaim of the same event — leaves a durable OUTGOING
  // record keyed by payment_hash. If one exists, short-circuit instead of
  // re-sending (defense in depth on top of Lightning's payment_hash uniqueness).
  const paymentHash = (decoded.tags || []).find(
    tag => tag.tagName === 'payment_hash',
  )?.data;
  if (paymentHash) {
    let existing = null;
    try {
      existing = await NWCInvoiceManager.handleLookupInvoice({
        payment_hash: paymentHash,
      });
    } catch (err) {
      console.error('Idempotency lookup failed', err);
    }
    if (
      existing &&
      existing.type === 'OUTGOING' &&
      existing.status !== 'failed'
    ) {
      // 'completed' → return the known preimage; 'pending' → an earlier send is
      // still in flight, so refuse rather than risk a second send. A 'failed'
      // record falls through and is allowed to retry.
      if (existing.status === 'completed') {
        return {
          result_type: 'pay_invoice',
          result: { preimage: existing.preimage || '' },
        };
      }
      return createErrorResponse(
        'pay_invoice',
        ERROR_CODES.INTERNAL,
        'Payment already in progress',
      );
    }
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

  const amountSats = (amountMsat - (amountMsat % 1000)) / 1000;

  const connectResponse = await ensureWalletConnection();
  if (!connectResponse.isConnected) {
    return createErrorResponse(
      'pay_invoice',
      ERROR_CODES.INTERNAL,
      'Unable to connect to wallet',
    );
  }

  const wallet = getWalletModule();

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

  const persistBudget = async finalMsat => {
    try {
      await nwcEventLedger.setSpendState(
        selectedNWCAccount.publicKey,
        finalMsat,
        windowStart,
      );
      await splitAndStoreNWCData({
        ...fullStorageObject,
        accounts: {
          ...fullStorageObject.accounts,
          [selectedNWCAccount.publicKey]: {
            ...selectedNWCAccount,
            totalSent: (finalMsat - (finalMsat % 1000)) / 1000,
            lastRotated: windowStart,
          },
        },
      });
    } catch (err) {
      console.error('Failed to persist spend state', err);
    }
  };

  // Reserve the worst-case spend and drop a pending idempotency marker BEFORE
  // sending. A crash mid-payment then cannot be replayed into a second send and
  // cannot under-count the budget (the reservation is only reconciled down on a
  // confirmed result). Concurrent invocations are serialized by the module lock.
  await persistBudget(budgetSentMsat + amountMsat);
  if (paymentHash) {
    try {
      await NWCInvoiceManager.storeCreatedInvoice({
        payment_hash: paymentHash,
        invoice: requestParams.invoice,
        amount: amountSats,
        fee: 0,
        description: '',
        created_at: now,
        sparkID: '',
        type: 'OUTGOING',
        preimage: '',
      });
    } catch (err) {
      console.error('Failed to store pending outgoing marker', err);
    }
  }

  const invoice = await wallet.sendNWCSparkLightningPayment({
    invoice: requestParams.invoice,
  });

  console.log(invoice);
  if (!invoice.didWork) {
    // Payment never left — release the reservation and mark the attempt failed.
    await persistBudget(budgetSentMsat);
    if (paymentHash) {
      try {
        await NWCInvoiceManager.markInvoiceAsNotPending(
          paymentHash,
          'failed',
          '',
        );
      } catch (err) {
        console.error('Failed to mark outgoing marker failed', err);
      }
    }
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
  const paymentPreimage = status?.paymentResponse?.paymentPreimage || '';

  const feeMsat = response.fee?.originalValue || 0;

  // Reconcile the reservation: release it entirely if the send failed,
  // otherwise settle it to the actual amount + fee.
  await persistBudget(
    paymentStatus === 'failed'
      ? budgetSentMsat
      : budgetSentMsat + amountMsat + feeMsat,
  );

  if (paymentHash) {
    try {
      await NWCInvoiceManager.markInvoiceAsNotPending(
        paymentHash,
        paymentStatus,
        paymentPreimage,
        (feeMsat - (feeMsat % 1000)) / 1000,
      );
    } catch (err) {
      console.error('Failed to update outgoing marker', err);
    }
  }

  if (!status.didWork) {
    return createErrorResponse(
      'pay_invoice',
      ERROR_CODES.INTERNAL,
      'Unable to retrieve payment status',
    );
  }

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
    const timestampTag = decodedTags.find(tag => tag.tagName === 'timestamp');
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

const handleGetBalance = async selectedNWCAccount => {
  const connectResponse = await ensureWalletViewerConnection();
  if (!connectResponse.isConnected) {
    return createErrorResponse(
      'get_balance',
      ERROR_CODES.INTERNAL,
      'Unable to connect to wallet',
    );
  }

  const balance = await getWalletModule().getNWCSparkViewerBalance();
  if (!balance || balance.balance === undefined) {
    return createErrorResponse(
      'get_balance',
      ERROR_CODES.INTERNAL,
      'Unable to retrieve balance',
    );
  }

  return {
    result_type: 'get_balance',
    result: {
      balance: Number(balance.balance) * 1000,
    },
  };
};

const processEvent = async (event, selectedNWCAccount, fullStorageObject) => {
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
      returnObject = await handleGetBalance(selectedNWCAccount);
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

// Phase 1 of event verification: structural checks and freshness. These are
// cheap and depend only on the raw event, so they run before any expensive
// cryptography while the storage read is still in flight.
function validateEventStructureAndFreshness(rawEvent) {
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

  return rawEvent;
}

// Phase 3 of event verification: signature verification. This is the most
// expensive check (Schnorr verify), so it only runs once an event has passed
// the cheap structural and account checks — forged pushes then cost little
// per rejected event.
function verifyEventSignature(rawEvent) {
  try {
    let newEvent = JSON.parse(JSON.stringify(rawEvent));
    if (!verifyEvent({ ...newEvent, pubkey: newEvent.clientPubKey })) {
      console.error('Rejected NWC event: invalid signature', rawEvent.id);
      return false;
    }
  } catch (e) {
    console.error('Rejected NWC event: verification error', rawEvent.id, e);
    return false;
  }
  return true;
}

// Phase 2 of event verification: resolve the target account and confirm the
// signer is the authorized NWC client for it. Needs the account data from
// storage, so it runs once the storage read resolves.
function normalizeAccountForEvent(rawEvent, accounts) {
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

  if (
    !selectedNWCAccount.clientPubkey ||
    rawEvent.clientPubKey !== selectedNWCAccount.clientPubkey
  ) {
    console.error(
      'Rejected NWC event: signer is not the authorized NWC client',
      rawEvent.id,
      rawEvent.clientPubKey,
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

    const allEvents = nwcEvent?.events;
    if (!Array.isArray(allEvents) || allEvents.length === 0) return;
    // Bound the work without dropping the push: an oversized batch is trimmed
    // rather than rejected, because the push is the only delivery path (there
    // is no relay subscription and no retry) so a whole-batch drop would
    // silently lose a legitimate pay_invoice.
    if (allEvents.length > MAX_EVENTS_PER_BATCH) {
      console.error(
        'Trimming NWC push: batch exceeds max event count',
        allEvents.length,
      );
    }
    const newEvents = allEvents.slice(0, MAX_EVENTS_PER_BATCH);

    // Serialize with any concurrent background invocation. Everything that
    // reads-modifies-writes account state or the spend ledger runs inside this
    // lock, so simultaneous pushes cannot interleave (no lost storage writes,
    // no budget TOCTOU). Each invocation reads fresh storage after the prior
    // one has finished writing.
    const previous = processingLock;
    let releaseLock;
    processingLock = new Promise(resolve => (releaseLock = resolve));
    await previous;

    try {
      // Start the storage read immediately so its I/O overlaps with the cheap
      // structural checks below; the full object is needed once we reach
      // account resolution and pay_invoice budget persistence.
      const fullStoragePromise = getNWCData();

      const structurallyValidEvents = newEvents
        .map(rawEvent => validateEventStructureAndFreshness(rawEvent))
        .filter(Boolean);

      const fullStorageObject = await fullStoragePromise;
      const nwcAccounts = fullStorageObject.accounts || {};

      // Account resolution is a cheap map lookup; run it (phase 2) before the
      // costly Schnorr verification (phase 3) so forged events are dropped
      // before any signature work is spent on them.
      const resolvedEvents = structurallyValidEvents
        .map(rawEvent => normalizeAccountForEvent(rawEvent, nwcAccounts))
        .filter(Boolean);

      // Verify on the raw event only: verifyEventSignature deep-clones what it
      // is given, and the normalized event carries the account's private key.
      const verifiedEvents = resolvedEvents.filter(
        ({ selectedNWCAccount, ...event }) => verifyEventSignature(event),
      );

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

          const returnObject = await processEvent(
            event,
            selectedNWCAccount,
            fullStorageObject,
          );
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

          // Only notify once the event was actually handled and its response
          // published; error responses stay silent.
          if (returnObject.result) {
            const successMessage =
              EVENT_SUCCESS_NOTIFICATIONS[event.requestMethod];
            if (successMessage) {
              const selectedLanguage = await getLocalStorageItem(
                'userSelectedLanguage',
              ).then(data => JSON.parse(data) || 'en');
              if (selectedLanguage !== i18next.language) {
                await i18next.changeLanguage(selectedLanguage);
              }
              pushInstantNotification(
                i18next.t(successMessage),
                'Nostr Connect',
              );
            }
          }
        } catch (error) {
          console.error('Error processing event:', event.id, error);
          await nwcEventLedger.markFailed(event.id, Date.now());
        }
      }
    } finally {
      releaseLock();
    }
  } catch (err) {
    console.error('Error handling background nwc event', err);
  }
}
