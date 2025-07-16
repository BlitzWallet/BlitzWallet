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
  getNWCSparkBalance,
  initializeNWCWallet,
  NWCSparkLightningPaymentStatus,
  receiveNWCSparkLightningPayment,
  sendNWCSparkLightningPayment,
} from './wallet';
import sha256Hash from '../hash';
import bolt11 from 'bolt11';

// const handledEventIds = new Set();
let nwcAccounts, fullStorageObject;

const RELAY_URL = 'wss://relay.damus.io';

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
  return await initializeNWCWallet();
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
  await new Promise(res => setTimeout(res, 5000));

  const status = await NWCSparkLightningPaymentStatus(response.id);
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

    const {
      data: {body: nwcEvent},
    } = notificationData;
    console.log('background nwc event', nwcEvent);
    console.log(nwcAccounts);
    if (!nwcEvent) return;

    // // Filter out already handled events upfront
    const newEvents = nwcEvent.events;
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
