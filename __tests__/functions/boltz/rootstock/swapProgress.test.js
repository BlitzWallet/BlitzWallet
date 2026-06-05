jest.mock('../../../../app/functions/spark/transactions', () => ({
  bulkUpdateSparkTransactions: jest.fn(() => Promise.resolve(true)),
  insertSparkTransactionPlaceholders: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('i18next', () => ({
  __esModule: true,
  default: { t: key => key },
}));

const {
  bulkUpdateSparkTransactions,
  insertSparkTransactionPlaceholders,
} = require('../../../../app/functions/spark/transactions');
const {
  getRootstockSwapStatusLabel,
  insertRootstockSwapPlaceholder,
  updateRootstockSwapPlaceholder,
} = require('../../../../app/functions/boltz/rootstock/swapProgress');

describe('Rootstock swap progress helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps known statuses and formats unknown statuses safely', () => {
    expect(getRootstockSwapStatusLabel('transaction.confirmed')).toBe(
      'Confirmed on Rootstock',
    );
    expect(getRootstockSwapStatusLabel('custom.status_value')).toBe(
      'Custom Status Value',
    );
  });

  it('inserts a visible pending Rootstock placeholder', async () => {
    await insertRootstockSwapPlaceholder({
      swapId: 'swap-1',
      accountId: 'acct-1',
      invoiceId: 'invoice-id-1',
      invoice: 'lnbc1invoice',
      amountSat: 5000,
      feeSat: 32,
      createdTime: 123,
    });

    expect(insertSparkTransactionPlaceholders).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'swap-1',
        accountId: 'acct-1',
        paymentStatus: 'pending',
        paymentType: 'lightning',
        details: expect.objectContaining({
          direction: 'INCOMING',
          isRootstockSwap: true,
          rootstockSwapStatus: 'swap.created',
          rootstockSwapStatusLabel: 'Preparing swap',
          amount: 5000,
          fee: 32,
        }),
      }),
    ]);
  });

  it.each([
    ['invoice.pending', 'pending'],
    ['transaction.claim.pending', 'completed'],
    ['invoice.failedToPay', 'failed'],
  ])('updates %s with payment status %s', async (status, paymentStatus) => {
    await updateRootstockSwapPlaceholder({
      swapId: 'swap-1',
      accountId: 'acct-1',
      invoiceId: 'invoice-id-1',
      invoice: 'lnbc1invoice',
      amountSat: 5000,
      feeSat: 32,
      status,
      createdTime: 123,
    });

    expect(bulkUpdateSparkTransactions).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'swap-1',
        accountId: 'acct-1',
        paymentStatus,
        paymentType: 'lightning',
        details: expect.objectContaining({
          rootstockSwapStatus: status,
          rootstockSwapStatusLabel: getRootstockSwapStatusLabel(status),
        }),
      }),
    ]);
  });

  it('marks placeholder updates as update-only so a settled payment is not duplicated', async () => {
    await updateRootstockSwapPlaceholder({
      swapId: 'swap-1',
      accountId: 'acct-1',
      invoiceId: 'invoice-id-1',
      invoice: 'lnbc1invoice',
      amountSat: 5000,
      feeSat: 32,
      status: 'transaction.claimed',
      createdTime: 123,
    });

    expect(bulkUpdateSparkTransactions).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'swap-1', updateOnly: true }),
    ]);
  });
});
