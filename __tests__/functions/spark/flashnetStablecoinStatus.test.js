// checkFlashnetStablecoinStatusLogic resolves a pending Orchestra swap row. A
// row that exhausts its polls is stamped completed + runcount>20, which the UI
// reads as "swap failed" (isOrchestraSwapFailed). Ways this can go wrong:
//  1. A real backend completion on the last poll is stamped the same way and
//     shown as failed (the user may pay again).
//  2. A backend error/timeout is ever shown as a successful swap.
jest.mock('../../../app/functions/spark', () => ({}));
jest.mock('../../../app/functions/spark/walletRuntime', () => ({}));
jest.mock('../../../app/functions/spark/paymentIngest', () => ({}));
jest.mock('../../../app/functions/spark/transactions', () => ({
  bulkUpdateSparkTransactions: jest.fn(async () => {}),
}));
jest.mock('../../../db/handleBackend', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const fetchBackend = require('../../../db/handleBackend').default;
const {
  checkFlashnetStablecoinStatusLogic,
} = require('../../../app/functions/spark/restore');
const {
  isOrchestraSwapFailed,
} = require('../../../app/functions/spark/orchestraLightning');

const pendingRow = runcount => ({
  sparkID: 'deposit-1',
  paymentType: 'spark',
  accountId: 'acct',
  details: { isFlashnetStablecoin: true, quoteId: 'q1', runcount },
});

describe('checkFlashnetStablecoinStatusLogic', () => {
  test('a backend completion on poll 21 is shown as completed, not failed (1)', async () => {
    fetchBackend.mockResolvedValueOnce({ status: 'completed' });
    const update = await checkFlashnetStablecoinStatusLogic(pendingRow(21));
    expect(update.paymentStatus).toBe('completed');
    expect(isOrchestraSwapFailed(update)).toBe(false);
  });

  test('a backend error on poll 21 is never shown as a successful swap (2)', async () => {
    fetchBackend.mockResolvedValueOnce(false);
    const update = await checkFlashnetStablecoinStatusLogic(pendingRow(21));
    expect(isOrchestraSwapFailed(update)).toBe(true);
  });
});
