/* eslint-env jest */
// The payment_hash marker in nwc_invoices.db is the only thing stopping JS and
// the native handlers (Android :nwc process, iOS extension — separate
// processes, no shared lock) from paying the same invoice twice. The "native"
// statements below are the exact SQL NwcInvoices.claimPayment issues in Swift
// and Kotlin. Ways this can fail, each covered below:
//  1. Two payers both see "no marker" and both send.
//  2. JS sends although another payer took the marker after JS looked it up
//     (the old path logged its failed INSERT and paid anyway).
//  3. A pending or completed marker is taken over.
//  4. A failed marker is never retryable, or is retried by two payers at once.
//  5. An invoice this wallet created (INCOMING) turns into a payment marker.
//  6. A payer that loses the claim keeps its budget reservation.
//  7. A retry of a failed invoice sends while its marker still says 'failed'.
//  8. A send that is still pending (or failed) is answered as a success with an
//     empty preimage, so the client believes it was paid.
//  9. A send that settles a few seconds later is answered as not paid, so the
//     user pays again elsewhere.
// 10. A retry of a pending invoice never learns its outcome: it refuses
//     forever, or pays a second time.
// 11. A handed-off pay_invoice older than the handoff cap is answered
//     "Request expired" although it was already paid, or is paid late.

jest.mock('expo-sqlite', () => {
  const { DatabaseSync: DB } = require('node:sqlite');
  const connections = new Map();
  return {
    __esModule: true,
    __connections: connections,
    openDatabaseAsync: jest.fn(async name => {
      if (!connections.has(name)) connections.set(name, new DB(':memory:'));
      const sqlite = connections.get(name);
      return {
        execAsync: async sql => sqlite.exec(sql),
        runAsync: async (sql, params = []) => {
          const r = sqlite.prepare(sql).run(...params);
          return { changes: r.changes, lastInsertRowId: r.lastInsertRowid };
        },
        getAllAsync: async (sql, params = []) =>
          sqlite.prepare(sql).all(...params),
        getFirstAsync: async (sql, params = []) =>
          sqlite.prepare(sql).get(...params) ?? null,
      };
    }),
  };
});
jest.mock('../../../app/functions/nwc', () => ({
  getNWCData: jest.fn(),
  getSupportedMethods: jest.fn(() => []),
  getSupportedNotifications: jest.fn(() => []),
  isWithinNWCBalanceTimeFrame: jest.fn(() => true),
  splitAndStoreNWCData: jest.fn(async () => {}),
}));
jest.mock('../../../app/functions/nwc/publishResponse', () => ({
  publishToSingleRelay: jest.fn(async () => {}),
}));
jest.mock('../../../app/functions/notifications', () => ({
  pushInstantNotification: jest.fn(),
}));
jest.mock('i18next', () => ({
  language: 'en',
  t: key => key,
  changeLanguage: jest.fn(async () => {}),
}));
jest.mock('../../../app/constants', () => ({
  NOSTR_RELAY_URL: 'wss://relay.example.com',
}));
jest.mock('../../../app/functions/localStorage', () => ({
  getLocalStorageItem: jest.fn(async () => '"en"'),
}));
const HASH = 'ab'.repeat(32);
jest.mock('../../../app/functions/decodeBolt11', () => ({
  __esModule: true,
  default: {
    decode: jest.fn(() => ({
      millisatoshis: '5000',
      tags: [{ tagName: 'payment_hash', data: 'ab'.repeat(32) }],
    })),
  },
}));
const mockWallet = {
  initializeNWCWallet: jest.fn(),
  sendNWCSparkLightningPayment: jest.fn(),
  NWCSparkLightningPaymentStatus: jest.fn(),
  getNWCSparkTransactions: jest.fn(),
};
jest.mock('../../../app/functions/nwc/wallet', () => ({
  __esModule: true,
  nwcWallet: null,
  initializeNWCWallet: (...a) => mockWallet.initializeNWCWallet(...a),
  sendNWCSparkLightningPayment: (...a) =>
    mockWallet.sendNWCSparkLightningPayment(...a),
  NWCSparkLightningPaymentStatus: (...a) =>
    mockWallet.NWCSparkLightningPaymentStatus(...a),
  getNWCSparkTransactions: (...a) => mockWallet.getNWCSparkTransactions(...a),
}));
jest.mock('../../../app/functions/spark', () => ({
  getSparkPaymentStatus: jest.fn(status =>
    status === 'SUCCEEDED'
      ? 'completed'
      : status === 'FAILED'
      ? 'failed'
      : 'pending',
  ),
}));

const { nwcEventLedger } = require('../../../app/functions/nwc/eventLedger');
const NWCInvoiceManager =
  require('../../../app/functions/nwc/cachedNWCTxs').default;
const handleNWCBackgroundEvent =
  require('../../../app/functions/nwc/backgroundNofifications').default;
const { getNWCData } = require('../../../app/functions/nwc');
const {
  publishToSingleRelay,
} = require('../../../app/functions/nwc/publishResponse');
const { finalizeEvent, getPublicKey, nip44 } = require('nostr-tools');

const connection = name => require('expo-sqlite').__connections.get(name);
const invoicesDb = () => connection('nwc_invoices.db');
const ledgerDb = () => connection('nwc_event_ledger.db');

// NwcInvoices.claimPayment (Swift/Kotlin): same two statements.
function nativeClaimPayment(paymentHash, invoice = 'lnbc-native') {
  const now = Date.now();
  const inserted = invoicesDb()
    .prepare(
      `INSERT OR IGNORE INTO invoices (payment_hash, invoice, amount, description, created_at, updated_at,
         expires_at, settled_at, metadata, sparkID, type, status, fee, preimage)
       VALUES (?, ?, ?, '', ?, ?, NULL, NULL, ?, '', 'OUTGOING', 'pending', 0, '')`,
    )
    .run(
      paymentHash,
      invoice,
      5,
      now,
      now,
      '{"created_via":"nwc_create_invoice"}',
    ).changes;
  if (inserted > 0) return true;
  return (
    invoicesDb()
      .prepare(
        `UPDATE invoices SET status = 'pending', updated_at = ?, settled_at = NULL, preimage = ''
         WHERE payment_hash = ? AND type = 'OUTGOING' AND status = 'failed'`,
      )
      .run(now, paymentHash).changes > 0
  );
}
const jsClaim = (paymentHash, invoice = 'lnbc-js') =>
  NWCInvoiceManager.claimOutgoingPayment({
    payment_hash: paymentHash,
    invoice,
    amount: 5,
  });
const marker = paymentHash =>
  invoicesDb()
    .prepare('SELECT type, status FROM invoices WHERE payment_hash = ?')
    .get(paymentHash);
const setMarker = (paymentHash, status, preimage = '') =>
  invoicesDb()
    .prepare(
      'UPDATE invoices SET status = ?, preimage = ? WHERE payment_hash = ?',
    )
    .run(status, preimage, paymentHash);
// What getNWCSparkTransactions returns for the native send of 'lnbc-native'.
const nativeTransfer = status => ({
  transfers: [
    {
      status,
      userRequest: {
        typename: 'LightningSendRequest',
        encodedInvoice: 'lnbc-native',
        paymentPreimage: status === 'SUCCEEDED' ? 'native-preimage' : '',
      },
    },
  ],
});

const accountPrivateKey = '02'.repeat(32);
const servicePubkey = getPublicKey(accountPrivateKey);
const clientSecret = '03'.repeat(32);
const clientPubkey = getPublicKey(clientSecret);
const conversationKey = () =>
  nip44.getConversationKey(Buffer.from(clientSecret, 'hex'), servicePubkey);

const payPush = (ageSeconds = 0) => {
  const signed = finalizeEvent(
    {
      kind: 23194,
      created_at: Math.floor(Date.now() / 1000) - ageSeconds,
      tags: [['p', servicePubkey]],
      content: nip44.encrypt(
        JSON.stringify({
          method: 'pay_invoice',
          params: { invoice: 'lnbc-js' },
        }),
        conversationKey(),
      ),
    },
    Buffer.from(clientSecret, 'hex'),
  );
  return {
    data: {
      body: JSON.stringify({
        events: [
          { ...signed, pubkey: servicePubkey, clientPubKey: signed.pubkey },
        ],
      }),
    },
  };
};
const lastResponse = () => {
  const [[event]] = publishToSingleRelay.mock.calls.at(-1);
  return JSON.parse(nip44.decrypt(event.content, conversationKey()));
};
const sentMsat = () =>
  ledgerDb()
    .prepare(
      'SELECT budget_sent_msat FROM nwc_ledger_state WHERE account_pubkey = ?',
    )
    .get(servicePubkey)?.budget_sent_msat;

beforeEach(async () => {
  await nwcEventLedger.resetDatabase();
  await NWCInvoiceManager.resetDatabase();
  jest.clearAllMocks();
  getNWCData.mockResolvedValue({
    accounts: {
      [servicePubkey]: {
        permissions: { sendPayments: true },
        privateKey: accountPrivateKey,
        publicKey: servicePubkey,
        clientPubkey,
        totalSent: 0,
        lastRotated: Date.now(),
        budgetRenewalSettings: { option: 'daily', amount: 100 },
      },
    },
  });
  mockWallet.initializeNWCWallet.mockResolvedValue({ isConnected: true });
  mockWallet.sendNWCSparkLightningPayment.mockResolvedValue({
    didWork: true,
    paymentResponse: { id: 'send-1', fee: { originalValue: 0 } },
  });
  mockWallet.NWCSparkLightningPaymentStatus.mockResolvedValue({
    didWork: true,
    paymentResponse: { status: 'SUCCEEDED', paymentPreimage: 'preimage' },
  });
});

describe('payment_hash claim, JS SQL vs native SQL', () => {
  test('a new hash is claimed by exactly one payer (1)', async () => {
    expect(await jsClaim(HASH)).toBe(true);
    expect(nativeClaimPayment(HASH)).toBe(false);
    expect(nativeClaimPayment('cd'.repeat(32))).toBe(true);
    expect(await jsClaim('cd'.repeat(32))).toBe(false);
  });

  test('pending and completed markers are never taken over (3)', async () => {
    expect(nativeClaimPayment(HASH)).toBe(true);
    expect(await jsClaim(HASH)).toBe(false);
    setMarker(HASH, 'completed');
    expect(await jsClaim(HASH)).toBe(false);
    expect(nativeClaimPayment(HASH)).toBe(false);
  });

  test('a failed marker is retried by exactly one payer (4)', async () => {
    expect(nativeClaimPayment(HASH)).toBe(true);
    setMarker(HASH, 'failed');
    expect(await jsClaim(HASH)).toBe(true);
    expect(nativeClaimPayment(HASH)).toBe(false);
    expect(marker(HASH).status).toBe('pending');
  });

  test('an INCOMING invoice with that hash is left alone (5)', async () => {
    await NWCInvoiceManager.storeCreatedInvoice({
      payment_hash: HASH,
      invoice: 'lnbc-made-here',
      amount: 5,
      type: 'INCOMING',
    });
    expect(await jsClaim(HASH)).toBe(false);
    expect(nativeClaimPayment(HASH)).toBe(false);
    expect(marker(HASH)).toEqual({ type: 'INCOMING', status: 'pending' });
  });
});

describe('JS pay_invoice against a racing native payer', () => {
  test('does not send when native claims the hash after the lookup, and releases its reservation (2, 6)', async () => {
    // Native takes the marker while JS is connecting its wallet — after JS's
    // idempotency lookup saw nothing.
    mockWallet.initializeNWCWallet.mockImplementationOnce(async () => {
      expect(nativeClaimPayment(HASH)).toBe(true);
      return { isConnected: true };
    });

    await handleNWCBackgroundEvent(payPush());

    expect(mockWallet.sendNWCSparkLightningPayment).not.toHaveBeenCalled();
    expect(lastResponse().error.message).toBe('Payment already in progress');
    expect(sentMsat()).toBe(0);
    expect(marker(HASH).status).toBe('pending'); // still native's
  });

  test('a retry of a failed invoice holds a pending marker while it sends (7)', async () => {
    expect(nativeClaimPayment(HASH)).toBe(true);
    setMarker(HASH, 'failed');
    let duringSend;
    mockWallet.sendNWCSparkLightningPayment.mockImplementationOnce(async () => {
      duringSend = {
        status: marker(HASH).status,
        nativeClaimed: nativeClaimPayment(HASH),
      };
      return {
        didWork: true,
        paymentResponse: { id: 'send-2', fee: { originalValue: 0 } },
      };
    });

    await handleNWCBackgroundEvent(payPush());

    expect(duringSend).toEqual({ status: 'pending', nativeClaimed: false });
    expect(lastResponse().result.preimage).toBe('preimage');
    expect(marker(HASH).status).toBe('completed');
    expect(sentMsat()).toBe(5000);
  });
});

describe('pay_invoice outcome reporting', () => {
  afterEach(() => jest.useRealTimers());

  // Drives the handler's status polling without waiting in real time.
  const runWithFakeTimers = async push => {
    jest.useFakeTimers({
      doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'],
    });
    let done = false;
    const run = handleNWCBackgroundEvent(push).then(() => (done = true));
    while (!done) await jest.advanceTimersByTimeAsync(1000);
    await run;
  };

  test('a send that settles after a few seconds returns its preimage (9)', async () => {
    mockWallet.NWCSparkLightningPaymentStatus.mockResolvedValueOnce({
      didWork: true,
      paymentResponse: { status: 'PENDING' },
    }).mockResolvedValueOnce({
      didWork: true,
      paymentResponse: { status: 'PENDING' },
    });

    await runWithFakeTimers(payPush());

    expect(lastResponse()).toEqual({
      result_type: 'pay_invoice',
      result: { preimage: 'preimage' },
    });
    expect(marker(HASH).status).toBe('completed');
  });

  test('a send still pending is an error, not a success, and keeps its reservation and marker (8)', async () => {
    mockWallet.NWCSparkLightningPaymentStatus.mockResolvedValue({
      didWork: true,
      paymentResponse: { status: 'PENDING' },
    });

    await runWithFakeTimers(payPush());

    expect(lastResponse().result).toBeUndefined();
    expect(lastResponse().error.message).toBe('Payment pending');
    expect(marker(HASH).status).toBe('pending');
    expect(sentMsat()).toBe(5000);
  });

  test('a send that failed is an error, not a success (8)', async () => {
    mockWallet.NWCSparkLightningPaymentStatus.mockResolvedValue({
      didWork: true,
      paymentResponse: { status: 'FAILED' },
    });

    await runWithFakeTimers(payPush());

    expect(lastResponse().result).toBeUndefined();
    expect(lastResponse().error.message).toBe('Unable to send payment');
    expect(marker(HASH).status).toBe('failed');
  });
});

describe('pay_invoice retry of a pending marker (10)', () => {
  beforeEach(() => {
    expect(nativeClaimPayment(HASH)).toBe(true);
  });

  test('returns the preimage once the wallet shows it completed, without sending', async () => {
    mockWallet.getNWCSparkTransactions.mockResolvedValue(
      nativeTransfer('SUCCEEDED'),
    );

    await handleNWCBackgroundEvent(payPush());

    expect(mockWallet.sendNWCSparkLightningPayment).not.toHaveBeenCalled();
    expect(lastResponse().result.preimage).toBe('native-preimage');
    expect(marker(HASH).status).toBe('completed');
  });

  test('refuses while the wallet still shows it pending, without sending', async () => {
    mockWallet.getNWCSparkTransactions.mockResolvedValue(
      nativeTransfer('PENDING'),
    );

    await handleNWCBackgroundEvent(payPush());

    expect(mockWallet.sendNWCSparkLightningPayment).not.toHaveBeenCalled();
    expect(lastResponse().error.message).toBe('Payment already in progress');
    expect(marker(HASH).status).toBe('pending');
  });

  test('sends again once the wallet shows it failed', async () => {
    mockWallet.getNWCSparkTransactions.mockResolvedValue(
      nativeTransfer('FAILED'),
    );

    await handleNWCBackgroundEvent(payPush());

    expect(mockWallet.sendNWCSparkLightningPayment).toHaveBeenCalledTimes(1);
    expect(lastResponse().result.preimage).toBe('preimage');
    expect(marker(HASH).status).toBe('completed');
  });
});

describe('stale handed-off pay_invoice (11)', () => {
  const STALE_AGE = 120;

  test('returns the preimage of a payment that already completed', async () => {
    expect(nativeClaimPayment(HASH)).toBe(true);
    setMarker(HASH, 'completed', 'native-preimage');

    await handleNWCBackgroundEvent(payPush(STALE_AGE), { fromHandoff: true });

    expect(mockWallet.sendNWCSparkLightningPayment).not.toHaveBeenCalled();
    expect(lastResponse()).toEqual({
      result_type: 'pay_invoice',
      result: { preimage: 'native-preimage' },
    });
  });

  test('reconciles a payment a killed native run left pending', async () => {
    expect(nativeClaimPayment(HASH)).toBe(true);
    mockWallet.getNWCSparkTransactions.mockResolvedValue(
      nativeTransfer('SUCCEEDED'),
    );

    await handleNWCBackgroundEvent(payPush(STALE_AGE), { fromHandoff: true });

    expect(mockWallet.sendNWCSparkLightningPayment).not.toHaveBeenCalled();
    expect(lastResponse().result.preimage).toBe('native-preimage');
  });

  test('never pays late when there is no marker, or only a failed one', async () => {
    await handleNWCBackgroundEvent(payPush(STALE_AGE), { fromHandoff: true });
    expect(lastResponse().error.message).toBe('Request expired');

    expect(nativeClaimPayment(HASH)).toBe(true);
    setMarker(HASH, 'failed');
    await handleNWCBackgroundEvent(payPush(STALE_AGE), { fromHandoff: true });
    expect(lastResponse().error.message).toBe('Request expired');

    expect(mockWallet.sendNWCSparkLightningPayment).not.toHaveBeenCalled();
    expect(sentMsat() ?? 0).toBe(0);
  });
});
