// processSpendAndReplaceIntents is tested with storage mocked and the swap
// dependencies mocked so the real runSpendAndReplace (same module) produces the
// outcomes we steer — same-module function mocking is unreliable under Babel's
// CJS transform, so we drive behavior through its dependencies instead.
jest.mock('../../../app/functions/spark/spendAndReplaceStorage', () => ({
  getEligiblePayments: jest.fn(),
  claimIntents: jest.fn(),
  resolveIntents: jest.fn(),
  releaseIntents: jest.fn(),
}));

jest.mock('../../../app/functions/spark/flashnet', () => ({
  findBestPool: jest.fn(),
  satsToDollars: jest.fn(),
  USD_ASSET_ADDRESS: 'usd-addr',
  BTC_ASSET_ADDRESS: 'btc-addr',
}));

jest.mock('../../../app/functions/spark/transactions', () => ({
  bulkUpdateSparkTransactions: jest.fn(),
  runSerializedSparkDbWrite: jest.fn(operation => operation()),
}));

jest.mock('../../../app/functions/spark/balanceStore', () => ({
  getDollarBalanceToken: jest.fn(),
}));

jest.mock('../../../app/functions/spark/index', () => ({
  sendSparkTokens: jest.fn(),
}));

jest.mock('../../../app/constants', () => ({
  USDB_TOKEN_ID: 'usdb-token-id',
}));

jest.mock('../../../db/handleBackend', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('nostr-tools', () => ({
  getPublicKey: jest.fn().mockReturnValue('pub-key'),
}));

jest.mock('../../../app/functions/nostrCompatability', () => ({
  privateKeyFromSeedWords: jest.fn().mockResolvedValue('priv-key'),
}));

const {
  getEligiblePayments,
  claimIntents,
  resolveIntents,
  releaseIntents,
} = require('../../../app/functions/spark/spendAndReplaceStorage');
const {
  findBestPool,
  satsToDollars,
} = require('../../../app/functions/spark/flashnet');
const {
  getDollarBalanceToken,
} = require('../../../app/functions/spark/balanceStore');
const { sendSparkTokens } = require('../../../app/functions/spark/index');
const fetchBackend = require('../../../db/handleBackend').default;

const {
  processSpendAndReplaceIntents,
} = require('../../../app/functions/spark/spendAndReplace');

const db = {}; // opaque handle; storage is fully mocked
const ACCOUNT = 'acct-1';

const quoteCalls = () =>
  fetchBackend.mock.calls.filter(c => c[0] === 'createSpendAndReplaceQuote');

// poolInfoRef defaults to empty so the pool price comes from the findBestPool
// mock (the in-context value path is exercised separately by overriding it).
const runPass = (overrides = {}) =>
  processSpendAndReplaceIntents({
    db,
    accountId: ACCOUNT,
    mnemonic: 'test mnemonic',
    sparkAddress: 'spark-addr-1',
    t: k => k,
    poolInfoRef: {},
    ...overrides,
  });

describe('processSpendAndReplaceIntents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findBestPool.mockResolvedValue({
      didWork: true,
      pool: { currentPriceAInB: 100_000_000 },
    });
    getDollarBalanceToken.mockReturnValue(10_000_000); // $10
    satsToDollars.mockReturnValue(5.0); // $5 needed → 5_000_000 micro
    sendSparkTokens.mockResolvedValue({ didWork: true, response: 'spark-tx-1' });
    fetchBackend.mockImplementation(async method => {
      if (method === 'createSpendAndReplaceQuote') {
        return {
          quoteId: 'quote-1',
          depositAddress: 'deposit-addr-1',
          amountIn: 5_000_000,
        };
      }
      if (method === 'submitFlashnetStablecoinOrder') {
        return { status: 'pending', orderId: 'order-1' };
      }
      return {};
    });
    resolveIntents.mockResolvedValue(undefined);
    releaseIntents.mockResolvedValue(undefined);
  });

  it('does nothing and runs no swap when there are no eligible payments', async () => {
    getEligiblePayments.mockResolvedValue([]);

    const result = await runPass();

    expect(result).toEqual({ processed: 0 });
    expect(claimIntents).not.toHaveBeenCalled();
    expect(fetchBackend).not.toHaveBeenCalled();
  });

  it('does not swap when discovery finds rows but nothing is freshly claimed', async () => {
    getEligiblePayments.mockResolvedValue([
      { payment_id: 'p1', amount_sats: 5000 },
    ]);
    claimIntents.mockResolvedValue([]); // lost the claim race / already claimed

    const result = await runPass();

    expect(result).toEqual({ processed: 0 });
    expect(fetchBackend).not.toHaveBeenCalled();
    expect(resolveIntents).not.toHaveBeenCalled();
  });

  it('releases claimed rows without swapping when the active account changes after claim', async () => {
    let isActiveAccount = true;
    getEligiblePayments.mockResolvedValue([
      { payment_id: 'p1', amount_sats: 1000 },
    ]);
    claimIntents.mockImplementation(async () => {
      isActiveAccount = false;
      return [{ payment_id: 'p1', amount_sats: 1000 }];
    });

    const result = await runPass({
      isSameActiveAccount: () => isActiveAccount,
    });

    expect(result).toEqual({ processed: 0 });
    expect(fetchBackend).not.toHaveBeenCalled();
    expect(sendSparkTokens).not.toHaveBeenCalled();
    expect(resolveIntents).not.toHaveBeenCalled();
    expect(releaseIntents).toHaveBeenCalledWith(db, ACCOUNT, ['p1']);
  });

  it('batches multiple claimed payments into one swap and marks them completed', async () => {
    getEligiblePayments.mockResolvedValue([
      { payment_id: 'p1', amount_sats: 1000 },
      { payment_id: 'p2', amount_sats: 2000 },
    ]);
    claimIntents.mockResolvedValue([
      { payment_id: 'p1', amount_sats: 1000 },
      { payment_id: 'p2', amount_sats: 2000 },
    ]);

    const result = await runPass();

    expect(result).toEqual({ processed: 2 });
    expect(quoteCalls()).toHaveLength(1); // single batched swap
    expect(releaseIntents).not.toHaveBeenCalled();
    expect(resolveIntents).toHaveBeenCalledWith(db, ACCOUNT, ['p1', 'p2'], {
      status: 'completed',
      swapRequestId: 'quote-1',
      amountSwappedMicro: 5_000_000,
    });
  });

  it('marks intents skipped when the swap is skipped (no pool)', async () => {
    findBestPool.mockResolvedValue({ didWork: false });
    getEligiblePayments.mockResolvedValue([
      { payment_id: 'p1', amount_sats: 1000 },
    ]);
    claimIntents.mockResolvedValue([{ payment_id: 'p1', amount_sats: 1000 }]);

    const result = await runPass();

    expect(result).toEqual({ processed: 1 });
    expect(releaseIntents).not.toHaveBeenCalled();
    expect(resolveIntents).toHaveBeenCalledWith(db, ACCOUNT, ['p1'], {
      status: 'skipped',
    });
  });

  it('marks intents failed (terminal) when the backend rejects the quote', async () => {
    fetchBackend.mockImplementation(async method => {
      if (method === 'createSpendAndReplaceQuote') {
        return { error: { message: 'no liquidity' } };
      }
      return {};
    });
    getEligiblePayments.mockResolvedValue([
      { payment_id: 'p1', amount_sats: 1000 },
    ]);
    claimIntents.mockResolvedValue([{ payment_id: 'p1', amount_sats: 1000 }]);

    const result = await runPass();

    expect(result).toEqual({ processed: 1 });
    expect(sendSparkTokens).not.toHaveBeenCalled();
    expect(releaseIntents).not.toHaveBeenCalled();
    expect(resolveIntents).toHaveBeenCalledWith(db, ACCOUNT, ['p1'], {
      status: 'failed',
    });
  });

  it('releases the claim (no terminal resolve) when the quote request fails at the transport layer', async () => {
    // fetchBackend returns false on network/timeout failure — no funds have moved.
    fetchBackend.mockImplementation(async method => {
      if (method === 'createSpendAndReplaceQuote') return false;
      return {};
    });
    getEligiblePayments.mockResolvedValue([
      { payment_id: 'p1', amount_sats: 1000 },
    ]);
    claimIntents.mockResolvedValue([{ payment_id: 'p1', amount_sats: 1000 }]);

    const result = await runPass();

    expect(result).toEqual({ processed: 1 });
    expect(sendSparkTokens).not.toHaveBeenCalled();
    expect(resolveIntents).not.toHaveBeenCalled();
    expect(releaseIntents).toHaveBeenCalledWith(db, ACCOUNT, ['p1']);
  });

  it('releases the claim when the USDB deposit fails with a network error', async () => {
    sendSparkTokens.mockResolvedValue({
      didWork: false,
      error: 'Network request failed',
    });
    getEligiblePayments.mockResolvedValue([
      { payment_id: 'p1', amount_sats: 1000 },
    ]);
    claimIntents.mockResolvedValue([{ payment_id: 'p1', amount_sats: 1000 }]);

    const result = await runPass();

    expect(result).toEqual({ processed: 1 });
    expect(resolveIntents).not.toHaveBeenCalled();
    expect(releaseIntents).toHaveBeenCalledWith(db, ACCOUNT, ['p1']);
  });

  it('marks failed (terminal) when the USDB deposit fails with a non-network error', async () => {
    sendSparkTokens.mockResolvedValue({
      didWork: false,
      error: 'insufficient token balance',
    });
    getEligiblePayments.mockResolvedValue([
      { payment_id: 'p1', amount_sats: 1000 },
    ]);
    claimIntents.mockResolvedValue([{ payment_id: 'p1', amount_sats: 1000 }]);

    const result = await runPass();

    expect(result).toEqual({ processed: 1 });
    expect(releaseIntents).not.toHaveBeenCalled();
    expect(resolveIntents).toHaveBeenCalledWith(db, ACCOUNT, ['p1'], {
      status: 'failed',
    });
  });

  it('reprocesses newly eligible rows on a subsequent pass (drain-loop safe)', async () => {
    getEligiblePayments.mockResolvedValueOnce([
      { payment_id: 'p1', amount_sats: 1000 },
    ]);
    claimIntents.mockResolvedValueOnce([{ payment_id: 'p1', amount_sats: 1000 }]);
    const first = await runPass();
    expect(first).toEqual({ processed: 1 });

    // a payment confirmed mid-pass shows up on the rerun
    getEligiblePayments.mockResolvedValueOnce([
      { payment_id: 'p2', amount_sats: 2000 },
    ]);
    claimIntents.mockResolvedValueOnce([{ payment_id: 'p2', amount_sats: 2000 }]);
    const second = await runPass();
    expect(second).toEqual({ processed: 1 });

    expect(quoteCalls()).toHaveLength(2);
    expect(resolveIntents).toHaveBeenNthCalledWith(
      2,
      db,
      ACCOUNT,
      ['p2'],
      expect.objectContaining({ status: 'completed' }),
    );
  });
});
