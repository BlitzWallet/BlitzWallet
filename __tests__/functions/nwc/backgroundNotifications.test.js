jest.mock('../../../app/functions/nwc', () => ({
  getNWCData: jest.fn(),
  getSupportedMethods: jest.fn(() => ['get_info']),
  getSupportedNotifications: jest.fn(() => []),
  isWithinNWCBalanceTimeFrame: jest.fn(() => true),
  splitAndStoreNWCData: jest.fn(),
}));
jest.mock('../../../app/functions/nwc/publishResponse', () => ({
  publishToSingleRelay: jest.fn(async () => ({
    successful: 1,
    total: 1,
    failed: 0,
  })),
}));
jest.mock('../../../app/functions/nwc/sharedStorage', () => ({
  writeNativeNWCConfig: jest.fn(() => true),
}));
jest.mock('../../../app/functions/nwc/eventLedger', () => ({
  NWC_READ_METHODS: [
    'get_info',
    'get_balance',
    'list_transactions',
    'lookup_invoice',
  ],
  NWC_BURST_WINDOW_MS: 300000,
  nwcEventLedger: {
    claimEvent: jest.fn(async () => 'claimed'),
    markDone: jest.fn(),
    markFailed: jest.fn(),
    setMethod: jest.fn(),
    getSpendState: jest.fn(),
    reserveSpend: jest.fn(),
    adjustSpend: jest.fn(),
    countRecentReads: jest.fn(async () => 1),
  },
}));
jest.mock('../../../app/functions/nwc/wallet', () => ({
  __esModule: true,
  nwcWallet: null,
  initializeNWCWallet: jest.fn(async () => ({ isConnected: true })),
  initializeNWCWalletViewer: jest.fn(async () => ({ isConnected: true })),
  getNWCSparkViewerBalance: jest.fn(async () => ({ balance: 1000 })),
  receiveNWCSparkLightningPayment: jest.fn(async () => ({
    didWork: true,
    response: {
      id: 'receive-1',
      invoice: {
        encodedInvoice: 'lnbc-made',
        paymentHash: 'ab'.repeat(32),
        createdAt: 1700000000,
        expiresAt: 1700003600,
      },
    },
  })),
}));
jest.mock('i18next', () => ({
  language: 'en',
  t: jest.fn((key, options) =>
    options && options.count !== undefined ? `${key}:${options.count}` : key,
  ),
  changeLanguage: jest.fn(async () => {}),
}));
jest.mock('../../../app/functions/nwc/cachedNWCTxs', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../../app/functions/notifications', () => ({
  pushInstantNotification: jest.fn(),
}));
jest.mock('../../../app/constants', () => ({
  NOSTR_RELAY_URL: 'wss://relay.example.com',
}));
jest.mock('../../../app/functions/decodeBolt11', () => ({
  __esModule: true,
  default: { decode: jest.fn() },
}));
jest.mock(
  '../../../app/functions/messaging/encodingAndDecodingMessages',
  () => ({
    decryptMessage: jest.fn(),
    encriptMessage: jest.fn(),
  }),
);

const handleNWCBackgroundEvent =
  require('../../../app/functions/nwc/backgroundNofifications').default;
const { getNWCData } = require('../../../app/functions/nwc');
const { nwcEventLedger } = require('../../../app/functions/nwc/eventLedger');
const { publishToSingleRelay } =
  require('../../../app/functions/nwc/publishResponse');
const { pushInstantNotification } =
  require('../../../app/functions/notifications');
const { finalizeEvent, getPublicKey, nip44 } = require('nostr-tools');

const accountPrivateKey = '02'.repeat(32);
const servicePubkey = getPublicKey(accountPrivateKey);
const clientSecret = '03'.repeat(32);
const clientPubkey = getPublicKey(clientSecret);

const buildAccount = () => ({
  accountName: 'Test',
  permissions: {
    receivePayments: false,
    sendPayments: false,
    getBalance: false,
    transactionHistory: false,
    lookupInvoice: false,
  },
  budgetRenewalSettings: { option: 'Daily', amount: 'Unlimited' },
  privateKey: accountPrivateKey,
  publicKey: servicePubkey,
  secret: clientSecret,
  clientPubkey,
});

const buildSignedEvent = ({ secret, tags, content }) =>
  finalizeEvent(
    {
      kind: 23194,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content,
    },
    Buffer.from(secret, 'hex'),
  );

describe('handleNWCBackgroundEvent authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getNWCData.mockResolvedValue({ accounts: { [servicePubkey]: buildAccount() } });
  });

  test('processes requests signed by the authorized client', async () => {
    const event = {
      ...buildSignedEvent({
        secret: clientSecret,
        tags: [['p', servicePubkey]],
        content: nip44.encrypt(
          JSON.stringify({ method: 'get_info', params: {} }),
          nip44.getConversationKey(
            Buffer.from(accountPrivateKey, 'hex'),
            clientPubkey,
          ),
        ),
      }),
      // The backend forwards the signer's pubkey as clientPubKey.
      clientPubKey: clientPubkey,
    };

    await handleNWCBackgroundEvent({ data: { body: { events: [event] } } });

    expect(publishToSingleRelay).toHaveBeenCalledTimes(1);
  });

  test('rejects requests signed by anyone other than the stored client', async () => {
    const attackerSecret = '04'.repeat(32);
    const attackerPubkey = getPublicKey(attackerSecret);
    // The backend forwards the signer's pubkey as clientPubKey; the p tag
    // points at the victim's wallet service pubkey.
    const event = {
      ...buildSignedEvent({
        secret: attackerSecret,
        tags: [['p', servicePubkey]],
        content: nip44.encrypt(
          JSON.stringify({ method: 'get_info', params: {} }),
          nip44.getConversationKey(
            Buffer.from(accountPrivateKey, 'hex'),
            attackerPubkey,
          ),
        ),
      }),
      clientPubKey: attackerPubkey,
    };

    await handleNWCBackgroundEvent({ data: { body: { events: [event] } } });

    expect(publishToSingleRelay).not.toHaveBeenCalled();
    expect(nwcEventLedger.claimEvent).not.toHaveBeenCalled();
  });

  test('ignores an attacker-supplied clientPubKey field', async () => {
    const attackerSecret = '05'.repeat(32);
    const event = {
      ...buildSignedEvent({
        secret: attackerSecret,
        tags: [['p', servicePubkey]],
        content: '{}',
      }),
      clientPubKey: clientPubkey,
    };

    await handleNWCBackgroundEvent({ data: { body: { events: [event] } } });

    expect(publishToSingleRelay).not.toHaveBeenCalled();
    expect(nwcEventLedger.claimEvent).not.toHaveBeenCalled();
  });
});

describe('NWC notification coalescing', () => {
  const pushFor = (method, params = {}) => {
    const event = {
      ...buildSignedEvent({
        secret: clientSecret,
        tags: [['p', servicePubkey]],
        content: nip44.encrypt(
          JSON.stringify({ method, params }),
          nip44.getConversationKey(
            Buffer.from(accountPrivateKey, 'hex'),
            clientPubkey,
          ),
        ),
      }),
      clientPubKey: clientPubkey,
    };
    return { data: { body: JSON.stringify({ events: [event] }) } };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    nwcEventLedger.countRecentReads.mockResolvedValue(1);
    getNWCData.mockResolvedValue({
      accounts: {
        [servicePubkey]: {
          ...buildAccount(),
          permissions: {
            receivePayments: true,
            sendPayments: true,
            getBalance: true,
            transactionHistory: true,
            lookupInvoice: true,
          },
        },
      },
    });
  });

  test('a read posts silently under a stable per-connection identifier', async () => {
    await handleNWCBackgroundEvent(pushFor('get_balance'));

    expect(pushInstantNotification).toHaveBeenCalledWith(
      'pushNotifications.nwc.get_balance',
      'pushNotifications.nwc.title',
      { identifier: `nwc-read-${servicePubkey}`, silent: true },
    );
  });

  test('a second read within the window posts the burst count', async () => {
    nwcEventLedger.countRecentReads.mockResolvedValue(2);

    await handleNWCBackgroundEvent(pushFor('get_balance'));

    expect(pushInstantNotification).toHaveBeenCalledWith(
      'pushNotifications.nwc.readBurst:2',
      'pushNotifications.nwc.title',
      { identifier: `nwc-read-${servicePubkey}`, silent: true },
    );
  });

  test('make_invoice posts non-silent with no identifier', async () => {
    await handleNWCBackgroundEvent(pushFor('make_invoice', { amount: 5000 }));

    expect(pushInstantNotification).toHaveBeenCalledWith(
      'pushNotifications.nwc.make_invoice',
      'pushNotifications.nwc.title',
    );
  });

  test('a count failure falls back to the plain notification', async () => {
    nwcEventLedger.countRecentReads.mockRejectedValue(
      new Error('database is locked'),
    );

    await handleNWCBackgroundEvent(pushFor('get_balance'));

    expect(pushInstantNotification).toHaveBeenCalledWith(
      'pushNotifications.nwc.get_balance',
      'pushNotifications.nwc.title',
    );
  });
});
