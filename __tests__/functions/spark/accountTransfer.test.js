import { executeAccountTransfer } from '../../../app/functions/spark/accountTransfer';

jest.mock('../../../app/functions/spark/payments', () => ({
  sparkPaymenWrapper: jest.fn(),
}));
jest.mock('../../../app/functions/spark/index', () => ({
  getSparkAddress: jest.fn(),
  getSparkBalance: jest.fn(),
  getSparkIdentityPubKey: jest.fn(),
  initializeSparkWallet: jest.fn(),
}));
jest.mock('../../../app/functions/spark/transactions', () => ({
  bulkUpdateSparkTransactions: jest.fn(),
}));

const { sparkPaymenWrapper } = require('../../../app/functions/spark/payments');
const {
  getSparkAddress,
  getSparkBalance,
  getSparkIdentityPubKey,
  initializeSparkWallet,
} = require('../../../app/functions/spark/index');
const {
  bulkUpdateSparkTransactions,
} = require('../../../app/functions/spark/transactions');

const t = key => key;

function baseArgs(overrides = {}) {
  return {
    fromAccount: { uuid: 'from-uuid', name: 'from-name' },
    toAccount: { uuid: 'to-uuid', name: 'to-name' },
    amountSats: 1000,
    fee: 10,
    memo: '',
    fromBalance: 5000,
    masterInfoObject: {},
    getAccountMnemonic: async acct => `${acct.uuid}-mnemonic`,
    sendWebViewRequest: jest.fn(),
    t,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  getSparkAddress.mockImplementation(async mn => ({
    didWork: true,
    response: `addr-${mn}`,
  }));
  getSparkIdentityPubKey.mockImplementation(async mn => `pk-${mn}`);
  getSparkBalance.mockResolvedValue({ didWork: true, balance: 100000n });
  initializeSparkWallet.mockResolvedValue(undefined);
  sparkPaymenWrapper.mockResolvedValue({
    didWork: true,
    response: { id: 'tx1', details: { direction: 'OUTGOING', fee: 10 } },
  });
  bulkUpdateSparkTransactions.mockResolvedValue(undefined);
});

test('rejects when amount + fee exceeds source balance and never sends', async () => {
  await expect(
    executeAccountTransfer(baseArgs({ amountSats: 5000, fee: 10 })),
  ).rejects.toThrow(
    'settings.accountComponents.accountPaymentPage.balanceError',
  );
  expect(sparkPaymenWrapper).not.toHaveBeenCalled();
});

test('rejects non-positive or non-integer amounts', async () => {
  for (const amountSats of [0, -5, 1.5, NaN, undefined]) {
    await expect(
      executeAccountTransfer(baseArgs({ amountSats })),
    ).rejects.toThrow(
      'settings.accountComponents.accountPaymentPage.invalidAmountError',
    );
    expect(sparkPaymenWrapper).not.toHaveBeenCalled();
  }
});

test('rejects invalid fee values', async () => {
  for (const fee of [-1, NaN, undefined]) {
    await expect(executeAccountTransfer(baseArgs({ fee }))).rejects.toThrow(
      'settings.accountComponents.accountPaymentPage.invalidFeeError',
    );
    expect(sparkPaymenWrapper).not.toHaveBeenCalled();
  }
});

test('rejects invalid source balances instead of silently passing', async () => {
  for (const fromBalance of [NaN, undefined, -1]) {
    await expect(
      executeAccountTransfer(baseArgs({ fromBalance })),
    ).rejects.toThrow(
      'settings.accountComponents.accountPaymentPage.invalidBalanceError',
    );
    expect(sparkPaymenWrapper).not.toHaveBeenCalled();
  }
});

test('rejects a transfer between the same account', async () => {
  await expect(
    executeAccountTransfer(
      baseArgs({
        fromAccount: { uuid: 'same-uuid' },
        toAccount: { uuid: 'same-uuid' },
      }),
    ),
  ).rejects.toThrow(
    'settings.accountComponents.accountPaymentPage.sameAccountError',
  );
  expect(sparkPaymenWrapper).not.toHaveBeenCalled();
});

test('rejects two accounts that share a wallet (same identity pubkey)', async () => {
  await expect(
    executeAccountTransfer(
      baseArgs({
        // distinct uuids, but both derive the same mnemonic → same pubkey
        fromAccount: { uuid: 'imported-uuid' },
        toAccount: { uuid: 'derived-uuid' },
        getAccountMnemonic: async () => 'shared-mnemonic',
      }),
    ),
  ).rejects.toThrow(
    'settings.accountComponents.accountPaymentPage.sameAccountError',
  );
  expect(sparkPaymenWrapper).not.toHaveBeenCalled();
  expect(bulkUpdateSparkTransactions).not.toHaveBeenCalled();
});

test('rejects accounts missing a uuid', async () => {
  await expect(
    executeAccountTransfer(baseArgs({ fromAccount: {} })),
  ).rejects.toThrow(
    'settings.accountComponents.accountPaymentPage.noAccountInformation',
  );
  expect(sparkPaymenWrapper).not.toHaveBeenCalled();
});

test('sends a spark payment to the resolved destination address', async () => {
  const res = await executeAccountTransfer(baseArgs());
  expect(res.didWork).toBe(true);
  expect(sparkPaymenWrapper).toHaveBeenCalledTimes(1);
  const call = sparkPaymenWrapper.mock.calls[0][0];
  expect(call.paymentType).toBe('spark');
  expect(call.amountSats).toBe(1000);
  // to-account mnemonic → address
  expect(call.address).toBe('addr-to-uuid-mnemonic');
  // spends from the source wallet's mnemonic
  expect(call.mnemonic).toBe('from-uuid-mnemonic');
});

test('writes an INCOMING mirror tx on the receiving account', async () => {
  await executeAccountTransfer(baseArgs());
  expect(bulkUpdateSparkTransactions).toHaveBeenCalledTimes(1);
  const [mirror] = bulkUpdateSparkTransactions.mock.calls[0][0];
  expect(mirror.accountId).toBe('pk-to-uuid-mnemonic');
  expect(mirror.details.direction).toBe('INCOMING');
  expect(mirror.details.fee).toBe(0);
});

test('defaults the from-side description to "Sent to" and the mirror to "Received from"', async () => {
  await executeAccountTransfer(baseArgs());
  const sendCall = sparkPaymenWrapper.mock.calls[0][0];
  expect(sendCall.memo).toBe(
    'settings.accountComponents.transferModal.transferComplete',
  );
  const [mirror] = bulkUpdateSparkTransactions.mock.calls[0][0];
  expect(mirror.details.description).toBe(
    'settings.accountComponents.transferModal.receivedFrom',
  );
});

test('names the counterparty account in both descriptions', async () => {
  const interpolatingT = (key, params) =>
    `${key}|${params?.name || ''}`;
  await executeAccountTransfer(baseArgs({ t: interpolatingT }));
  const sendCall = sparkPaymenWrapper.mock.calls[0][0];
  expect(sendCall.memo).toBe(
    'settings.accountComponents.transferModal.transferComplete|to-name',
  );
  const [mirror] = bulkUpdateSparkTransactions.mock.calls[0][0];
  expect(mirror.details.description).toBe(
    'settings.accountComponents.transferModal.receivedFrom|from-name',
  );
});

test('a custom memo overrides the styled defaults on both sides', async () => {
  await executeAccountTransfer(baseArgs({ memo: 'my memo' }));
  const sendCall = sparkPaymenWrapper.mock.calls[0][0];
  expect(sendCall.memo).toBe('my memo');
  const [mirror] = bulkUpdateSparkTransactions.mock.calls[0][0];
  expect(mirror.details.description).toBe('my memo');
});
