// When a settled lightning payment matches a Liquid-swap request, the payment
// object must carry useTempId/tempId so bulkUpdateSparkTransactions remaps the
// pre-inserted pending placeholder (keyed by the invoice id) onto the final
// spark id instead of creating a duplicate row.
jest.mock('bolt11', () => ({ decode: jest.fn() }));

jest.mock('../../../app/functions/spark/index', () => ({
  getSparkPaymentStatus: jest.fn(() => 'completed'),
  sparkPaymentType: jest.fn(() => 'lightning'),
}));

jest.mock('../../../app/functions/spark/calculateSupportFee', () => ({
  __esModule: true,
  default: jest.fn(async () => 0),
}));

jest.mock('../../../app/functions/spark/transactions', () => ({
  deleteUnpaidSparkLightningTransaction: jest.fn(),
  getActiveAutoSwapByAmount: jest.fn(),
  updateSparkTransactionDetails: jest.fn(),
}));

jest.mock('../../../app/functions/spark/flashnet', () => ({
  FLASHNET_POOL_IDENTITY_KEY: 'pool-key',
  getActiveSwapTransferIds: jest.fn(async () => []),
  getUserSwapHistory: jest.fn(async () => []),
}));

jest.mock('../../../app/functions/spark/handleFlashnetTransferIds', () => ({
  setFlashnetTransfer: jest.fn(),
}));

jest.mock('i18next', () => ({
  __esModule: true,
  default: { t: key => key },
}));

const {
  deleteUnpaidSparkLightningTransaction,
} = require('../../../app/functions/spark/transactions');
const {
  transformTxToPaymentObject,
} = require('../../../app/functions/spark/transformTxToPayment');

test('liquid-swap match remaps the placeholder via useTempId/tempId', async () => {
  const tx = {
    totalValue: 49500,
    status: 'TRANSFER_STATUS_COMPLETED',
    transferDirection: 'INCOMING',
    receiverIdentityPublicKey: 'acct-1',
    senderIdentityPublicKey: 'someone',
    createdTime: '2026-06-03T00:00:00.000Z',
    transfer: { sparkId: 'final-spark-id' },
    userRequest: {
      id: 'invoice-id-1',
      typename: 'LightningReceiveRequest',
      invoice: { encodedInvoice: '' },
    },
  };

  const unpaidLNInvoices = [
    {
      sparkID: 'invoice-id-1',
      description: 'Liquid swap',
      shouldNavigate: 0,
      details: JSON.stringify({
        isLiquidSwap: true,
        createdTime: 111,
        fee: 250,
        swapFeeSat: 250,
      }),
    },
  ];

  const result = await transformTxToPaymentObject(
    tx,
    'spark-addr',
    'lightning',
    false,
    unpaidLNInvoices,
    'acct-1',
    1,
    false,
    [],
    'seed words',
  );

  expect(result.id).toBe('final-spark-id');
  expect(result.useTempId).toBe(true);
  expect(result.tempId).toBe('invoice-id-1');
  expect(result.paymentStatus).toBe('completed');
  expect(result.paymentType).toBe('lightning');
  expect(result.details.isLiquidSwap).toBe(true);
  expect(result.details.fee).toBe(250);
  expect(result.details.totalFee).toBe(250);
  expect(result.details.amount).toBe(49500);

  // It is not a USD swap, so the request row is cleaned up once claimed.
  expect(deleteUnpaidSparkLightningTransaction).toHaveBeenCalledWith(
    'invoice-id-1',
  );
});

test('a normal (non-liquid) lightning match does not set tempId', async () => {
  const tx = {
    totalValue: 1000,
    status: 'TRANSFER_STATUS_COMPLETED',
    transferDirection: 'INCOMING',
    receiverIdentityPublicKey: 'acct-1',
    senderIdentityPublicKey: 'someone',
    createdTime: '2026-06-03T00:00:00.000Z',
    transfer: { sparkId: 'final-spark-id-2' },
    userRequest: {
      id: 'invoice-id-2',
      typename: 'LightningReceiveRequest',
      invoice: { encodedInvoice: '' },
    },
  };

  const unpaidLNInvoices = [
    {
      sparkID: 'invoice-id-2',
      description: 'normal',
      shouldNavigate: 0,
      details: JSON.stringify({ createdTime: 222 }),
    },
  ];

  const result = await transformTxToPaymentObject(
    tx,
    'spark-addr',
    'lightning',
    false,
    unpaidLNInvoices,
    'acct-1',
    1,
    false,
    [],
    'seed words',
  );

  expect(result.id).toBe('final-spark-id-2');
  expect(result.useTempId).toBeUndefined();
  expect(result.tempId).toBeUndefined();
});
