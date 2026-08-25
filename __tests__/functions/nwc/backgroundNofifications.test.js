/**
 * Regression tests for unbounded attacker-driven work in the NWC background
 * handler:
 *   1. list_transactions must clamp limit/offset so a request cannot force the
 *      wallet to page its entire transfer history while holding the global
 *      processing lock.
 *   2. Push batches are capped, and cheap checks (structure, account
 *      resolution) run BEFORE the expensive Schnorr verifyEvent call.
 */
jest.mock('../../../app/functions/nwc/index', () => ({
  getNWCData: jest.fn(),
  getSupportedMethods: jest.fn(() => []),
  isWithinNWCBalanceTimeFrame: jest.fn(() => true),
  splitAndStoreNWCData: jest.fn(),
}));

jest.mock('../../../app/functions/nwc/publishResponse', () => ({
  publishToSingleRelay: jest.fn(async () => {}),
}));

jest.mock('../../../app/functions/nwc/eventLedger', () => ({
  nwcEventLedger: {
    getSpendState: jest.fn(async () => null),
    setSpendState: jest.fn(async () => {}),
    claimEvent: jest.fn(async () => 'claimed'),
    markFailed: jest.fn(async () => {}),
    markDone: jest.fn(async () => {}),
    setMethod: jest.fn(async () => {}),
  },
}));

jest.mock('../../../app/functions/decodeBolt11', () => ({
  __esModule: true,
  default: { decode: jest.fn(() => ({ tags: [] })) },
}));

jest.mock('../../../app/functions/notifications', () => ({
  pushInstantNotification: jest.fn(),
}));

jest.mock('../../../app/functions/nwc/cachedNWCTxs', () => ({
  __esModule: true,
  default: {
    storeCreatedInvoice: jest.fn(async () => {}),
    handleLookupInvoice: jest.fn(async () => null),
    markInvoiceAsNotPending: jest.fn(async () => {}),
  },
}));

jest.mock('nostr-tools', () => ({
  finalizeEvent: jest.fn(event => ({ ...event })),
  verifyEvent: jest.fn(() => true),
  nip44: {
    encrypt: jest.fn(() => 'encrypted-content'),
    getConversationKey: jest.fn(() => Buffer.alloc(32)),
    decrypt: jest.fn(() => null),
  },
}));

jest.mock('../../../app/functions/hash', () => ({
  __esModule: true,
  default: jest.fn(() => 'payment-hash'),
}));

jest.mock(
  '../../../app/functions/messaging/encodingAndDecodingMessages',
  () => ({
    decryptMessage: jest.fn(() => null),
    encriptMessage: jest.fn(() => 'legacy-encrypted'),
  }),
);

jest.mock('../../../app/functions/localStorage', () => ({
  getLocalStorageItem: jest.fn(async () => '"en"'),
  setLocalStorageItem: jest.fn(async () => {}),
}));

const mockWallet = {
  nwcWallet: null,
  initializeNWCWallet: jest.fn(async () => ({ isConnected: true })),
  initializeNWCWalletViewer: jest.fn(async () => ({ isConnected: true })),
  getNWCSparkTransactions: jest.fn(async () => ({ transfers: [] })),
  receiveNWCSparkLightningPayment: jest.fn(),
  sendNWCSparkLightningPayment: jest.fn(),
  getNWCLightningReceiveRequest: jest.fn(),
  NWCSparkLightningPaymentStatus: jest.fn(),
  getNWCSparkViewerBalance: jest.fn(),
};

jest.mock('../../../app/functions/nwc/wallet', () => ({
  __esModule: true,
  get nwcWallet() {
    return mockWallet.nwcWallet;
  },
  initializeNWCWallet: mockWallet.initializeNWCWallet,
  initializeNWCWalletViewer: mockWallet.initializeNWCWalletViewer,
  getNWCSparkTransactions: mockWallet.getNWCSparkTransactions,
  receiveNWCSparkLightningPayment: mockWallet.receiveNWCSparkLightningPayment,
  sendNWCSparkLightningPayment: mockWallet.sendNWCSparkLightningPayment,
  getNWCLightningReceiveRequest: mockWallet.getNWCLightningReceiveRequest,
  NWCSparkLightningPaymentStatus: mockWallet.NWCSparkLightningPaymentStatus,
  getNWCSparkViewerBalance: mockWallet.getNWCSparkViewerBalance,
}));

jest.mock('../../../app/functions/spark', () => ({
  sparkPaymentType: jest.fn(() => 'lightning'),
  getSparkPaymentStatus: jest.fn(() => 'completed'),
}));

jest.mock('../../../app/functions/spark/transformTxToPayment', () => ({
  transformTxToPaymentObject: jest.fn(async () => ({ details: {} })),
}));

import handleNWCBackgroundEvent from '../../../app/functions/nwc/backgroundNofifications';
import { getNWCData } from '../../../app/functions/nwc/index';
import { publishToSingleRelay } from '../../../app/functions/nwc/publishResponse';
import { nwcEventLedger } from '../../../app/functions/nwc/eventLedger';
import { verifyEvent, nip44 } from 'nostr-tools';

const ACCOUNT_PUBKEY = 'a'.repeat(64);
const CLIENT_PUBKEY = 'b'.repeat(64);
const PRIVKEY = 'c'.repeat(64);

const makeAccountStorage = () => ({
  accounts: {
    [ACCOUNT_PUBKEY]: {
      publicKey: ACCOUNT_PUBKEY,
      clientPubkey: CLIENT_PUBKEY,
      privateKey: PRIVKEY,
      totalSent: 0,
      lastRotated: Date.now(),
      budgetRenewalSettings: { option: 'daily', amount: 'Unlimited' },
      permissions: {
        transactionHistory: true,
        receivePayments: true,
        lookupInvoice: true,
        sendPayments: true,
        getBalance: true,
      },
    },
  },
});

const makeEvent = overrides => ({
  id: 'evt-' + Math.random().toString(36).slice(2),
  pubkey: ACCOUNT_PUBKEY,
  clientPubKey: CLIENT_PUBKEY,
  kind: 23194,
  created_at: Math.floor(Date.now() / 1000),
  content: 'encrypted',
  tags: [['p', ACCOUNT_PUBKEY]],
  sig: 'sig-' + Math.random().toString(36).slice(2),
  ...overrides,
});

const pushBody = events => JSON.stringify({ events }, null, 0);

let transferCounter;

// Maps an encrypted event `content` marker to the decrypted NWC request the
// mock nip44.decrypt should produce for it.
const contentPayloads = {};

const registerRequest = (contentMarker, method, params) => {
  contentPayloads[contentMarker] = { method, params };
};

beforeAll(async () => {
  const i18next = require('i18next').default || require('i18next');
  if (!i18next.isInitialized) {
    await i18next.init({ lng: 'en', resources: {} });
  }
});

beforeEach(() => {
  jest.clearAllMocks();
  transferCounter = 0;
  for (const key of Object.keys(contentPayloads)) {
    delete contentPayloads[key];
  }
  getNWCData.mockResolvedValue(makeAccountStorage());
  // Reset implementations that individual tests may have overridden.
  nip44.encrypt.mockImplementation(() => 'encrypted-content');
  nip44.decrypt.mockImplementation(
    content =>
      contentPayloads[content] && JSON.stringify(contentPayloads[content]),
  );
});

describe('handleGetTransactions pagination caps (list_transactions)', () => {
  const collectResponse = async content => {
    return await new Promise((resolve, reject) => {
      // Capture the published response through nip44.encrypt.
      nip44.encrypt.mockImplementation(serializedContent => {
        try {
          resolve(JSON.parse(serializedContent));
        } catch (err) {
          reject(err);
        }
        return 'encrypted-content';
      });
      handleNWCBackgroundEvent({
        data: { body: pushBody([makeEvent({ content })]) },
      }).catch(reject);
    });
  };

  it('reports the page as exhausted past the offset ceiling instead of clamping', async () => {
    // Clamping an out-of-range offset back to 10000 would hand a client paging
    // to the end the same non-empty page forever, each round re-running the
    // bounded-but-expensive loop under the processing lock.
    registerRequest('encrypted-far-page', 'list_transactions', {
      limit: 1000000000,
      offset: 1000000000,
    });

    const response = await collectResponse('encrypted-far-page');

    expect(response.result_type).toBe('list_transactions');
    expect(response.result.transactions).toEqual([]);
    expect(mockWallet.getNWCSparkTransactions).not.toHaveBeenCalled();
  });

  it('caps limit so a huge request cannot page the full history while holding the lock', async () => {
    const chunkSize = 200;
    mockWallet.getNWCSparkTransactions.mockImplementation(
      async transferCount => ({
        transfers: Array.from({ length: transferCount }, () => ({
          id: 't' + transferCounter++,
          transferDirection: 'INCOMING',
          totalValue: 1000,
          createdTime: null,
        })),
      }),
    );

    // Attacker request from the evidence: limit of 1e9, at the highest offset
    // the handler still serves.
    registerRequest('encrypted-list-tx', 'list_transactions', {
      limit: 1000000000,
      offset: 10000,
    });

    const response = await collectResponse('encrypted-list-tx');

    expect(response.result_type).toBe('list_transactions');

    const calls = mockWallet.getNWCSparkTransactions.mock.calls;
    // chunkSize must be capped at min(limit * 2, 200), never ~2e9.
    expect(calls[0][0]).toBe(chunkSize);
    expect(calls[0][1]).toBe(0);
    for (const [count, off] of calls) {
      expect(Number.isSafeInteger(count)).toBe(true);
      expect(Number.isSafeInteger(off)).toBe(true);
      expect(count).toBeLessThanOrEqual(chunkSize);
    }
    // Loop stops once it has fetched offset + cappedLimit (10000 + 100).
    expect(calls[calls.length - 1][1]).toBeLessThanOrEqual(10000);
    expect(calls.length).toBe(Math.ceil(10100 / chunkSize)); // 51 bounded calls, not unbounded
    // Only the requested page (100 items after capping) is formatted.
    expect(response.result.transactions.length).toBe(100);
  });

  it.each([
    ['50', 100],
    [50.7, 100],
  ])(
    'honors a non-integer limit of %p instead of silently defaulting',
    async (limit, expectedChunkSize) => {
      // The old code passed these straight through: '50' string-concatenated
      // into the offset and returned the wrong rows entirely.
      mockWallet.getNWCSparkTransactions.mockResolvedValueOnce({
        transfers: [],
      });
      registerRequest('encrypted-coerce-' + limit, 'list_transactions', {
        limit,
      });

      await handleNWCBackgroundEvent({
        data: {
          body: pushBody([makeEvent({ content: 'encrypted-coerce-' + limit })]),
        },
      });

      expect(mockWallet.getNWCSparkTransactions).toHaveBeenCalledWith(
        expectedChunkSize,
        0,
      );
    },
  );

  it('still serves honest small requests unchanged', async () => {
    mockWallet.getNWCSparkTransactions.mockResolvedValueOnce({
      transfers: [
        {
          id: 't0',
          transferDirection: 'INCOMING',
          totalValue: 500,
          createdTime: null,
        },
      ],
    });
    registerRequest('encrypted-small', 'list_transactions', {
      limit: 20,
    });

    await handleNWCBackgroundEvent({
      data: {
        body: pushBody([makeEvent({ content: 'encrypted-small' })]),
      },
    });

    expect(mockWallet.getNWCSparkTransactions).toHaveBeenCalledWith(40, 0);
  });
});

describe('handleNWCBackgroundEvent batch bounds and check ordering', () => {
  it('trims an oversized push to the batch max instead of dropping it', async () => {
    // The push is the only delivery path (no relay subscription, no retry), so
    // dropping the whole batch would silently lose a legitimate pay_invoice.
    const flood = Array.from({ length: 30 }, () =>
      makeEvent({ content: 'encrypted-flood' }),
    );

    await handleNWCBackgroundEvent({ data: { body: pushBody(flood) } });

    expect(verifyEvent).toHaveBeenCalledTimes(25);
    expect(nwcEventLedger.claimEvent).toHaveBeenCalledTimes(25);
  });

  it('processes a batch sitting exactly on the max in full', async () => {
    const batch = Array.from({ length: 25 }, () =>
      makeEvent({ content: 'encrypted-exact' }),
    );

    await handleNWCBackgroundEvent({ data: { body: pushBody(batch) } });

    expect(nwcEventLedger.claimEvent).toHaveBeenCalledTimes(25);
  });

  it('resolves the account (cheap check) before spending a Schnorr verify on an event', async () => {
    // Structurally valid event signed by a key that is NOT the authorized
    // client for the account: previously verifyEvent ran first; now the
    // account/clientPubkey match rejects it before any crypto.
    await handleNWCBackgroundEvent({
      data: {
        body: pushBody([
          makeEvent({
            clientPubKey: 'f'.repeat(64),
            content: 'encrypted-forge',
          }),
        ]),
      },
    });

    expect(verifyEvent).not.toHaveBeenCalled();
    expect(nwcEventLedger.claimEvent).not.toHaveBeenCalled();
    expect(publishToSingleRelay).not.toHaveBeenCalled();
  });

  it('still rejects an authorized-client event whose signature is invalid', async () => {
    // The reorder moved verifyEvent to phase 3. This is the event shape that
    // reaches it: right account, right clientPubkey, forged signature.
    verifyEvent.mockReturnValueOnce(false);

    await handleNWCBackgroundEvent({
      data: {
        body: pushBody([makeEvent({ content: 'encrypted-badsig' })]),
      },
    });

    expect(verifyEvent).toHaveBeenCalledTimes(1);
    expect(nwcEventLedger.claimEvent).not.toHaveBeenCalled();
    expect(publishToSingleRelay).not.toHaveBeenCalled();
  });

  it('verifies the signature before the first side effect on a good event', async () => {
    registerRequest('encrypted-ordered', 'get_balance', {});

    await handleNWCBackgroundEvent({
      data: {
        body: pushBody([makeEvent({ content: 'encrypted-ordered' })]),
      },
    });

    expect(verifyEvent).toHaveBeenCalledTimes(1);
    expect(nwcEventLedger.claimEvent).toHaveBeenCalledTimes(1);
    expect(verifyEvent.mock.invocationCallOrder[0]).toBeLessThan(
      nwcEventLedger.claimEvent.mock.invocationCallOrder[0],
    );
  });

  it('never hands the account private key to the signature verifier', async () => {
    await handleNWCBackgroundEvent({
      data: {
        body: pushBody([makeEvent({ content: 'encrypted-nokey' })]),
      },
    });

    const [verified] = verifyEvent.mock.calls[0];
    expect(verified.selectedNWCAccount).toBeUndefined();
    expect(JSON.stringify(verified)).not.toContain(PRIVKEY);
  });
});
