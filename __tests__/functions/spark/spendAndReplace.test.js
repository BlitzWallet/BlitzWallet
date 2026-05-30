// jest.mock() must be top-level so Jest hoists it before any require().
jest.mock('../../../app/functions/spark/flashnet', () => ({
  findBestPool: jest.fn(),
  satsToDollars: jest.fn(),
  USD_ASSET_ADDRESS: 'usd-addr',
  BTC_ASSET_ADDRESS: 'btc-addr',
}));

jest.mock('../../../app/functions/spark/balanceStore', () => ({
  getDollarBalanceToken: jest.fn(),
}));

jest.mock('../../../app/functions/spark/index', () => ({
  sendSparkTokens: jest.fn(),
}));

jest.mock('../../../app/functions/spark/transactions', () => ({
  bulkUpdateSparkTransactions: jest.fn(),
}));

// Storage is only used by the orchestrator, not runSpendAndReplace — stub it out.
jest.mock('../../../app/functions/spark/spendAndReplaceStorage', () => ({
  getEligiblePayments: jest.fn(),
  claimIntents: jest.fn(),
  resolveIntents: jest.fn(),
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
  findBestPool,
  satsToDollars,
} = require('../../../app/functions/spark/flashnet');
const {
  getDollarBalanceToken,
} = require('../../../app/functions/spark/balanceStore');
const { sendSparkTokens } = require('../../../app/functions/spark/index');
const {
  bulkUpdateSparkTransactions,
} = require('../../../app/functions/spark/transactions');
const fetchBackend = require('../../../db/handleBackend').default;

describe('runSpendAndReplace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findBestPool.mockResolvedValue({
      didWork: true,
      pool: { currentPriceAInB: 100_000_000 },
    });
    getDollarBalanceToken.mockReturnValue(10_000_000); // $10.00 in microdollars
    satsToDollars.mockReturnValue(5.0); // default: $5.00 needed
    sendSparkTokens.mockResolvedValue({ didWork: true, response: 'spark-tx-1' });
    // Quote echoes the requested USDB amount; submit accepts the order.
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
  });

  it('returns skipped/amount_too_small when swap < $1 (no backend call)', async () => {
    satsToDollars.mockReturnValue(0.5); // $0.50 → 500_000 microdollars < 1_000_000

    const {
      runSpendAndReplace,
    } = require('../../../app/functions/spark/spendAndReplace');
    const result = await runSpendAndReplace({
      paymentAmountsSats: [5000],
      mnemonic: 'test mnemonic',
    });

    expect(result).toEqual({ status: 'skipped', reason: 'amount_too_small' });
    expect(fetchBackend).not.toHaveBeenCalled();
    expect(sendSparkTokens).not.toHaveBeenCalled();
  });

  it('returns skipped/no_pool when findBestPool fails (no backend call)', async () => {
    findBestPool.mockResolvedValue({ didWork: false });

    const {
      runSpendAndReplace,
    } = require('../../../app/functions/spark/spendAndReplace');
    const result = await runSpendAndReplace({
      paymentAmountsSats: [50_000],
      mnemonic: 'test mnemonic',
    });

    expect(result).toEqual({ status: 'skipped', reason: 'no_pool' });
    expect(fetchBackend).not.toHaveBeenCalled();
  });

  it('requests the quote with the USDB amount and the user Spark address as recipient + refund', async () => {
    const {
      runSpendAndReplace,
    } = require('../../../app/functions/spark/spendAndReplace');
    await runSpendAndReplace({
      paymentAmountsSats: [50_000],
      mnemonic: 'test mnemonic',
      sparkAddress: 'spark-addr-1',
    });

    expect(fetchBackend).toHaveBeenCalledWith(
      'createSpendAndReplaceQuote',
      {
        amountTokenMicro: 5_000_000,
        recipientAddress: 'spark-addr-1',
        refundAddress: 'spark-addr-1',
      },
      'priv-key',
      'pub-key',
    );
  });

  it('caps the USDB amount at the dollar balance when balance < needed', async () => {
    satsToDollars.mockReturnValue(10.0); // $10 needed but only $5 available
    getDollarBalanceToken.mockReturnValue(5_000_000);

    const {
      runSpendAndReplace,
    } = require('../../../app/functions/spark/spendAndReplace');
    const result = await runSpendAndReplace({
      paymentAmountsSats: [100_000],
      mnemonic: 'test mnemonic',
      sparkAddress: 'spark-addr-1',
    });

    expect(fetchBackend).toHaveBeenCalledWith(
      'createSpendAndReplaceQuote',
      expect.objectContaining({ amountTokenMicro: 5_000_000 }),
      'priv-key',
      'pub-key',
    );
    expect(result).toEqual({
      status: 'completed',
      swapRequestId: 'quote-1',
      amountSwappedMicro: 5_000_000,
    });
  });

  it('sends USDB to the quote deposit address then submits the order', async () => {
    const {
      runSpendAndReplace,
    } = require('../../../app/functions/spark/spendAndReplace');
    const result = await runSpendAndReplace({
      paymentAmountsSats: [50_000],
      mnemonic: 'test mnemonic',
      sparkAddress: 'spark-addr-1',
    });

    expect(sendSparkTokens).toHaveBeenCalledWith({
      tokenIdentifier: 'usdb-token-id',
      tokenAmount: 5_000_000,
      receiverSparkAddress: 'deposit-addr-1',
      mnemonic: 'test mnemonic',
    });
    expect(fetchBackend).toHaveBeenCalledWith(
      'submitFlashnetStablecoinOrder',
      {
        quoteId: 'quote-1',
        sparkTxHash: 'spark-tx-1',
        sourceSparkAddress: 'spark-addr-1',
      },
      'priv-key',
      'pub-key',
    );
    expect(result).toEqual({
      status: 'completed',
      swapRequestId: 'quote-1',
      amountSwappedMicro: 5_000_000,
    });
  });

  it('labels the deposit leg as a flashnet stablecoin swap keyed by the spark tx hash', async () => {
    const {
      runSpendAndReplace,
    } = require('../../../app/functions/spark/spendAndReplace');
    await runSpendAndReplace({
      paymentAmountsSats: [50_000],
      mnemonic: 'test mnemonic',
      accountId: 'account-1',
      sparkAddress: 'spark-addr-1',
      t: key => key,
    });

    expect(bulkUpdateSparkTransactions).toHaveBeenCalledTimes(1);
    const [legs, updateType] = bulkUpdateSparkTransactions.mock.calls[0];
    expect(updateType).toBe('fullUpdate');
    expect(legs).toHaveLength(1);
    expect(legs[0]).toMatchObject({
      id: 'spark-tx-1',
      paymentStatus: 'pending',
      accountId: 'account-1',
      details: expect.objectContaining({
        direction: 'OUTGOING',
        showSwapLabel: true,
        isLRC20Payment: true,
        LRC20Token: 'usdb-token-id',
        isFlashnetStablecoin: true,
        quoteId: 'quote-1',
        sourceSparkAddress: 'spark-addr-1',
        destinationChain: 'spark',
        destinationAsset: 'BTC',
        description: 'screens.inAccount.sendAndReplace.fundingDescription',
      }),
    });
  });

  it('returns failed (terminal) when the quote returns a backend error, without sending USDB', async () => {
    fetchBackend.mockImplementation(async method => {
      if (method === 'createSpendAndReplaceQuote') {
        return { error: { message: 'no liquidity' } };
      }
      return {};
    });

    const {
      runSpendAndReplace,
    } = require('../../../app/functions/spark/spendAndReplace');

    const result = await runSpendAndReplace({
      paymentAmountsSats: [50_000],
      mnemonic: 'test mnemonic',
      sparkAddress: 'spark-addr-1',
    });

    expect(result).toEqual({ status: 'failed', reason: 'no liquidity' });
    expect(sendSparkTokens).not.toHaveBeenCalled();
  });

  it('returns retry when the quote request fails at the transport layer (fetchBackend false)', async () => {
    fetchBackend.mockImplementation(async method => {
      if (method === 'createSpendAndReplaceQuote') return false;
      return {};
    });

    const {
      runSpendAndReplace,
    } = require('../../../app/functions/spark/spendAndReplace');

    const result = await runSpendAndReplace({
      paymentAmountsSats: [50_000],
      mnemonic: 'test mnemonic',
      sparkAddress: 'spark-addr-1',
    });

    expect(result).toEqual({ status: 'retry', reason: 'quote_network_error' });
    expect(sendSparkTokens).not.toHaveBeenCalled();
  });

  it('returns failed (terminal) when the USDB deposit fails with a non-network error, without submitting', async () => {
    sendSparkTokens.mockResolvedValue({
      didWork: false,
      error: 'insufficient balance',
    });

    const {
      runSpendAndReplace,
    } = require('../../../app/functions/spark/spendAndReplace');

    const result = await runSpendAndReplace({
      paymentAmountsSats: [50_000],
      mnemonic: 'test mnemonic',
      sparkAddress: 'spark-addr-1',
    });

    expect(result).toEqual({ status: 'failed', reason: 'insufficient balance' });
    expect(fetchBackend).not.toHaveBeenCalledWith(
      'submitFlashnetStablecoinOrder',
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it('returns retry when the USDB deposit fails with a network error, without submitting', async () => {
    sendSparkTokens.mockResolvedValue({
      didWork: false,
      error: 'Network request failed',
    });

    const {
      runSpendAndReplace,
    } = require('../../../app/functions/spark/spendAndReplace');

    const result = await runSpendAndReplace({
      paymentAmountsSats: [50_000],
      mnemonic: 'test mnemonic',
      sparkAddress: 'spark-addr-1',
    });

    expect(result).toEqual({
      status: 'retry',
      reason: 'token_send_network_error',
    });
    expect(fetchBackend).not.toHaveBeenCalledWith(
      'submitFlashnetStablecoinOrder',
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it('completes even when the fire-and-forget order submission errors', async () => {
    fetchBackend.mockImplementation(async method => {
      if (method === 'createSpendAndReplaceQuote') {
        return {
          quoteId: 'quote-1',
          depositAddress: 'deposit-addr-1',
          amountIn: 5_000_000,
        };
      }
      if (method === 'submitFlashnetStablecoinOrder') {
        return { error: { message: 'submit failed' } };
      }
      return {};
    });

    const {
      runSpendAndReplace,
    } = require('../../../app/functions/spark/spendAndReplace');

    const result = await runSpendAndReplace({
      paymentAmountsSats: [50_000],
      mnemonic: 'test mnemonic',
      sparkAddress: 'spark-addr-1',
    });

    // The deposit was sent; submit is best-effort, so the swap is terminal-completed
    // regardless of the submit response.
    expect(result).toEqual({
      status: 'completed',
      swapRequestId: 'quote-1',
      amountSwappedMicro: 5_000_000,
    });
  });
});
