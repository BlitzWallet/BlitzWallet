jest.mock('../../../app/functions/nwc', () => ({
  getNWCData: jest.fn(),
  getSupportedMethods: jest.fn(() => ['get_info']),
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
jest.mock('../../../app/functions/nwc/eventLedger', () => ({
  nwcEventLedger: {
    claimEvent: jest.fn(async () => 'claimed'),
    markDone: jest.fn(),
    markFailed: jest.fn(),
    setMethod: jest.fn(),
    getSpendState: jest.fn(),
    setSpendState: jest.fn(),
  },
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
