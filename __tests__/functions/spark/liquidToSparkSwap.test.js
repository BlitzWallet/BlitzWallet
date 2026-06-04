// liquidToSparkSwap orchestrates the Liquid -> Spark auto-swap: reuse-or-mint a
// fixed-amount spark lightning invoice, insert a pending placeholder keyed by
// the invoice id, then pay it from Liquid. Dependencies are mocked so we can
// steer each branch.
jest.mock('../../../app/functions/breezLiquid', () => ({
  breezLiquidPaymentWrapper: jest.fn(),
}));

jest.mock('../../../app/functions/spark/payments', () => ({
  sparkReceivePaymentWrapper: jest.fn(),
}));

jest.mock('../../../app/functions/spark/transactions', () => ({
  deleteUnpaidSparkLightningTransaction: jest.fn(),
  getActiveLiquidSwapInvoice: jest.fn(),
  getSparkTransactionBySparkId: jest.fn(),
  insertSparkTransactionPlaceholders: jest.fn(),
  updateSparkTransactionDetails: jest.fn(),
  bulkUpdateSparkTransactions: jest.fn(),
}));

jest.mock('i18next', () => ({
  __esModule: true,
  default: { t: key => key },
}));

const {
  breezLiquidPaymentWrapper,
} = require('../../../app/functions/breezLiquid');
const {
  sparkReceivePaymentWrapper,
} = require('../../../app/functions/spark/payments');
const {
  deleteUnpaidSparkLightningTransaction,
  getActiveLiquidSwapInvoice,
  getSparkTransactionBySparkId,
  insertSparkTransactionPlaceholders,
  updateSparkTransactionDetails,
  bulkUpdateSparkTransactions,
} = require('../../../app/functions/spark/transactions');

const liquidToSparkSwap =
  require('../../../app/functions/spark/liquidToSparkSwap').default;

const sparkInformation = { identityPubKey: 'acct-1' };
const baseArgs = {
  mnemonic: 'seed words',
  sparkInformation,
  spendableSat: 50000,
  sendWebViewRequest: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  getActiveLiquidSwapInvoice.mockResolvedValue(null);
  sparkReceivePaymentWrapper.mockImplementation(({ amountSats }) => ({
    didWork: true,
    data: { id: `invoice-id-${amountSats}` },
    invoice: `lnbc-encoded-${amountSats}`,
  }));
  deleteUnpaidSparkLightningTransaction.mockResolvedValue(true);
  breezLiquidPaymentWrapper.mockImplementation(({ getFee }) => {
    if (getFee) return Promise.resolve({ didWork: true, fee: 103 });
    return Promise.resolve({ didWork: true });
  });
  insertSparkTransactionPlaceholders.mockResolvedValue(true);
  updateSparkTransactionDetails.mockResolvedValue(true);
  getSparkTransactionBySparkId.mockResolvedValue({ paymentStatus: 'pending' });
  bulkUpdateSparkTransactions.mockResolvedValue(true);
});

test('mints a non-zero invoice below spendable minus fees, inserts a pending placeholder keyed by the invoice id, then pays it', async () => {
  const result = await liquidToSparkSwap(baseArgs);

  expect(result).toEqual({ didWork: true });

  // First invoice is exploratory, second is the final amount after fee quote.
  expect(sparkReceivePaymentWrapper).toHaveBeenCalledTimes(2);
  const receiveArgs = sparkReceivePaymentWrapper.mock.calls[1][0];
  expect(receiveArgs.paymentType).toBe('lightning');
  expect(receiveArgs.amountSats).toBe(49894);
  expect(
    sparkReceivePaymentWrapper.mock.calls[0][0].amountSats +
      34 +
      19 +
      Math.ceil(
        sparkReceivePaymentWrapper.mock.calls[0][0].amountSats * 0.001,
      ) +
      Math.ceil(sparkReceivePaymentWrapper.mock.calls[0][0].amountSats * 0.01) +
      2,
  ).toBeLessThan(baseArgs.spendableSat);
  expect(receiveArgs.extraDetails.isLiquidSwapCandidate).toBe(true);
  expect(typeof receiveArgs.extraDetails.swapExpiresAt).toBe('number');
  expect(deleteUnpaidSparkLightningTransaction).toHaveBeenCalledWith(
    'invoice-id-49400',
  );
  expect(updateSparkTransactionDetails).toHaveBeenCalledWith(
    'invoice-id-49894',
    expect.objectContaining({
      isLiquidSwap: true,
      isLiquidSwapCandidate: false,
      swapInvoice: 'lnbc-encoded-49894',
      swapAmountSat: 49894,
      swapFeeSat: 103,
      fee: 103,
    }),
  );

  // Placeholder inserted, pending, keyed by the invoice id.
  expect(insertSparkTransactionPlaceholders).toHaveBeenCalledTimes(1);
  const [[placeholder]] = insertSparkTransactionPlaceholders.mock.calls[0];
  expect(placeholder.id).toBe('invoice-id-49894');
  expect(placeholder.accountId).toBe('acct-1');
  expect(placeholder.paymentStatus).toBe('pending');
  expect(placeholder.paymentType).toBe('lightning');
  expect(placeholder.details.isLiquidSwap).toBe(true);
  expect(placeholder.details.amount).toBe(49894);
  expect(placeholder.details.fee).toBe(103);

  // Quoted the invoice, then paid the final fixed-amount invoice without drain.
  expect(breezLiquidPaymentWrapper).toHaveBeenLastCalledWith({
    paymentType: 'lightning',
    invoice: 'lnbc-encoded-49894',
  });
});

test('reuses an active swap invoice instead of minting a new one', async () => {
  getActiveLiquidSwapInvoice.mockResolvedValue({
    sparkID: 'reused-invoice-id',
    amount: 49400,
    details: {
      isLiquidSwap: true,
      swapInvoice: 'lnbc-reused',
      swapAmountSat: 49400,
    },
  });

  const result = await liquidToSparkSwap(baseArgs);

  expect(result).toEqual({ didWork: true });
  expect(sparkReceivePaymentWrapper).not.toHaveBeenCalled();
  expect(breezLiquidPaymentWrapper).toHaveBeenLastCalledWith({
    paymentType: 'lightning',
    invoice: 'lnbc-reused',
  });
  const [[placeholder]] = insertSparkTransactionPlaceholders.mock.calls[0];
  expect(placeholder.id).toBe('reused-invoice-id');
  expect(placeholder.details.amount).toBe(49400);
  expect(placeholder.details.fee).toBe(103);
});

test('a concurrent call is rejected while a swap is in progress', async () => {
  // Park the first call on its very first await (after the lock is taken).
  let releaseLookup;
  getActiveLiquidSwapInvoice.mockImplementation(
    () =>
      new Promise(resolve => {
        releaseLookup = () => resolve(null);
      }),
  );

  const first = liquidToSparkSwap(baseArgs);
  await Promise.resolve();

  const second = await liquidToSparkSwap(baseArgs);
  expect(second.didWork).toBe(false);
  expect(second.error).toMatch(/in progress/i);

  releaseLookup();
  await first;

  // Only the first call did real work; it still performs the quote-adjust cycle.
  expect(sparkReceivePaymentWrapper).toHaveBeenCalledTimes(2);
});

test('marks the placeholder failed when the Liquid payment fails', async () => {
  breezLiquidPaymentWrapper.mockImplementation(({ getFee }) => {
    if (getFee) return Promise.resolve({ didWork: true, fee: 103 });
    return Promise.resolve({
      didWork: false,
      error: { message: 'boltz rejected' },
    });
  });

  const result = await liquidToSparkSwap(baseArgs);

  expect(result.didWork).toBe(false);
  expect(bulkUpdateSparkTransactions).toHaveBeenCalledTimes(1);
  const [[failedTx]] = bulkUpdateSparkTransactions.mock.calls[0];
  expect(failedTx.id).toBe('invoice-id-49894');
  expect(failedTx.accountId).toBe('acct-1');
  expect(failedTx.paymentStatus).toBe('failed');
});

test('uses a fee-aware retry amount after a quote failure instead of dropping by 10%', async () => {
  let quoteCalls = 0;
  breezLiquidPaymentWrapper.mockImplementation(({ getFee }) => {
    if (getFee) {
      quoteCalls += 1;
      if (quoteCalls === 1) {
        return Promise.resolve({
          didWork: false,
          error: { message: 'amount too high' },
        });
      }
      return Promise.resolve({ didWork: true, fee: 103 });
    }
    return Promise.resolve({ didWork: true });
  });

  const result = await liquidToSparkSwap({
    ...baseArgs,
    spendableSat: 1_000_000,
  });

  expect(result).toEqual({ didWork: true });
  expect(sparkReceivePaymentWrapper).toHaveBeenCalledTimes(3);
  expect(sparkReceivePaymentWrapper.mock.calls[0][0].amountSats).toBe(989063);
  expect(sparkReceivePaymentWrapper.mock.calls[1][0].amountSats).toBe(967195);
  expect(sparkReceivePaymentWrapper.mock.calls[2][0].amountSats).toBe(989062);
  expect(
    sparkReceivePaymentWrapper.mock.calls[1][0].amountSats,
  ).toBeGreaterThan(900000);
  expect(deleteUnpaidSparkLightningTransaction).toHaveBeenCalledWith(
    'invoice-id-989063',
  );
});

test('does nothing destructive when the spark wallet is not connected', async () => {
  const result = await liquidToSparkSwap({
    ...baseArgs,
    sparkInformation: {},
  });

  expect(result.didWork).toBe(false);
  expect(sparkReceivePaymentWrapper).not.toHaveBeenCalled();
  expect(insertSparkTransactionPlaceholders).not.toHaveBeenCalled();
  expect(breezLiquidPaymentWrapper).not.toHaveBeenCalled();
  // No placeholder id yet, so no failed-cleanup write either.
  expect(bulkUpdateSparkTransactions).not.toHaveBeenCalled();
});
