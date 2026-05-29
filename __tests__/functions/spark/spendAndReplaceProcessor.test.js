// processSpendAndReplaceIntents is tested with storage mocked and the swap
// dependencies mocked so the real runSpendAndReplace (same module) produces the
// outcomes we steer — same-module function mocking is unreliable under Babel's
// CJS transform, so we drive behavior through its dependencies instead.
jest.mock('../../../app/functions/spark/spendAndReplaceStorage', () => ({
  getEligiblePayments: jest.fn(),
  claimIntents: jest.fn(),
  resolveIntents: jest.fn(),
}));

jest.mock('../../../app/functions/spark/flashnet', () => ({
  findBestPool: jest.fn(),
  satsToDollars: jest.fn(),
  USD_ASSET_ADDRESS: 'usd-addr',
  BTC_ASSET_ADDRESS: 'btc-addr',
}));

jest.mock('../../../app/functions/spark/transactions', () => ({
  bulkUpdateSparkTransactions: jest.fn(),
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

const runPass = showToast =>
  processSpendAndReplaceIntents({
    db,
    accountId: ACCOUNT,
    mnemonic: 'test mnemonic',
    sparkAddress: 'spark-addr-1',
    showToast,
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
  });

  it('does nothing and runs no swap when there are no eligible payments', async () => {
    getEligiblePayments.mockResolvedValue([]);

    const result = await runPass(jest.fn());

    expect(result).toEqual({ processed: 0 });
    expect(claimIntents).not.toHaveBeenCalled();
    expect(fetchBackend).not.toHaveBeenCalled();
  });

  it('does not swap when discovery finds rows but nothing is freshly claimed', async () => {
    getEligiblePayments.mockResolvedValue([
      { payment_id: 'p1', amount_sats: 5000 },
    ]);
    claimIntents.mockResolvedValue([]); // lost the claim race / already claimed

    const result = await runPass(jest.fn());

    expect(result).toEqual({ processed: 0 });
    expect(fetchBackend).not.toHaveBeenCalled();
    expect(resolveIntents).not.toHaveBeenCalled();
  });

  it('batches multiple claimed payments into one swap, one toast, and marks them completed', async () => {
    getEligiblePayments.mockResolvedValue([
      { payment_id: 'p1', amount_sats: 1000 },
      { payment_id: 'p2', amount_sats: 2000 },
    ]);
    claimIntents.mockResolvedValue([
      { payment_id: 'p1', amount_sats: 1000 },
      { payment_id: 'p2', amount_sats: 2000 },
    ]);
    const showToast = jest.fn();

    const result = await runPass(showToast);

    expect(result).toEqual({ processed: 2 });
    expect(quoteCalls()).toHaveLength(1); // single batched swap
    expect(showToast).toHaveBeenCalledTimes(1);
    expect(resolveIntents).toHaveBeenCalledWith(db, ACCOUNT, ['p1', 'p2'], {
      status: 'completed',
      swapRequestId: 'quote-1',
      amountSwappedMicro: 5_000_000,
    });
  });

  it('marks intents skipped (no toast) when the swap is skipped', async () => {
    findBestPool.mockResolvedValue({ didWork: false });
    getEligiblePayments.mockResolvedValue([
      { payment_id: 'p1', amount_sats: 1000 },
    ]);
    claimIntents.mockResolvedValue([{ payment_id: 'p1', amount_sats: 1000 }]);
    const showToast = jest.fn();

    const result = await runPass(showToast);

    expect(result).toEqual({ processed: 1 });
    expect(showToast).not.toHaveBeenCalled();
    expect(resolveIntents).toHaveBeenCalledWith(db, ACCOUNT, ['p1'], {
      status: 'skipped',
    });
  });

  it('marks intents failed (no toast, no retry) when the swap throws pre-submission', async () => {
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
    const showToast = jest.fn();

    const result = await runPass(showToast);

    expect(result).toEqual({ processed: 1 });
    expect(showToast).not.toHaveBeenCalled();
    expect(sendSparkTokens).not.toHaveBeenCalled();
    expect(resolveIntents).toHaveBeenCalledWith(db, ACCOUNT, ['p1'], {
      status: 'failed',
    });
  });

  it('reprocesses newly eligible rows on a subsequent pass (drain-loop safe)', async () => {
    const showToast = jest.fn();

    getEligiblePayments.mockResolvedValueOnce([
      { payment_id: 'p1', amount_sats: 1000 },
    ]);
    claimIntents.mockResolvedValueOnce([{ payment_id: 'p1', amount_sats: 1000 }]);
    const first = await runPass(showToast);
    expect(first).toEqual({ processed: 1 });

    // a payment confirmed mid-pass shows up on the rerun
    getEligiblePayments.mockResolvedValueOnce([
      { payment_id: 'p2', amount_sats: 2000 },
    ]);
    claimIntents.mockResolvedValueOnce([{ payment_id: 'p2', amount_sats: 2000 }]);
    const second = await runPass(showToast);
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
