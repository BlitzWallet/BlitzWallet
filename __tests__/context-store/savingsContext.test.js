/* eslint-env jest */
// ---------------------------------------------------------------------------
// Locks the savings bitcoin-withdrawal sender check (restorePaymentsFromSpark)
// against a "helpful" revert. getBitcoinWithdrawls returns the wire-level
// Transfer shape whose senderIdentityPublicKey is a Uint8Array; over the
// webview bridge that serializes to a plain {0:..,1:..} object. Both shapes
// must decode back to the sender hex and only own-sender transfers may be kept.
// ---------------------------------------------------------------------------

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

const SEED =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const IDENTITY_HEX = '11'.repeat(33);
const OTHER_HEX = '22'.repeat(33);

const mockKeys = { accountMnemoinc: SEED };
jest.mock('../../context-store/keys', () => ({
  __esModule: true,
  useKeysContext: () => mockKeys,
}));

const mockAppStatus = { didGetToHomepage: false };
jest.mock('../../context-store/appStatus', () => ({
  __esModule: true,
  useAppStatus: () => mockAppStatus,
}));

const mockAuth = { authResetkey: 0 };
jest.mock('../../context-store/authContext', () => ({
  __esModule: true,
  useAuthContext: () => mockAuth,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: key => key }),
}));

const mockGetLocalStorageItem = jest.fn(async () => null);
const mockSetLocalStorageItem = jest.fn(async () => true);
jest.mock('../../app/functions/localStorage', () => ({
  __esModule: true,
  getLocalStorageItem: (...a) => mockGetLocalStorageItem(...a),
  setLocalStorageItem: (...a) => mockSetLocalStorageItem(...a),
}));

const mockCreateSavingsTransactions = jest.fn(async rows => rows);
const mockGetAllSavingsTransactions = jest.fn(async () => []);
jest.mock('../../app/functions/savings/savingsStorage', () => ({
  __esModule: true,
  createSavingsGoal: jest.fn(async goal => goal),
  createSavingsTransaction: jest.fn(async tx => tx),
  createSavingsTransactions: (...a) => mockCreateSavingsTransactions(...a),
  deleteSavingsGoal: jest.fn(async () => true),
  getAllPayoutsTransactions: jest.fn(async () => []),
  getAllSavingsTransactions: (...a) => mockGetAllSavingsTransactions(...a),
  getSavingsGoals: jest.fn(async () => []),
  setPayoutsTransactions: jest.fn(async () => true),
  updateSavingsGoal: jest.fn(async () => null),
}));

jest.mock('../../app/functions/gift/deriveGiftWallet', () => ({
  __esModule: true,
  deriveSparkGiftMnemonic: jest.fn(async () => ({
    success: true,
    derivedMnemonic: 'derived-savings-mnemonic',
  })),
  deriveSparkIdentityKey: jest.fn(async () => ({
    success: true,
    publicKeyHex: '11'.repeat(33),
  })),
  deriveSparkAddress: jest.fn(() => ({
    success: true,
    address: 'spark-savings-address',
  })),
}));

const mockGetBitcoinWithdrawls = jest.fn(async () => ({ transfers: [] }));
const mockGetTokenTransactions = jest.fn(async () => ({ transactions: [] }));
jest.mock('../../app/functions/spark/walletViewer', () => ({
  __esModule: true,
  getBitcoinWithdrawls: (...a) => mockGetBitcoinWithdrawls(...a),
  getBitcoinBalance: jest.fn(async () => ({ balance: 0 })),
  initializeSparkWalletViewer: jest.fn(async () => true),
  getTokensBalance: jest.fn(async () => ({ balance: 0 })),
  getTokenTransactions: (...a) => mockGetTokenTransactions(...a),
}));

jest.mock('../../app/functions/customUUID', () => ({
  __esModule: true,
  default: jest.fn(() => 'uuid-generated'),
}));

jest.mock('../../app/constants', () => ({
  __esModule: true,
  DEFAULT_GOAL_EMOJI: '💰',
  STARTING_INDEX_FOR_SAVINGS_DERIVE: 1,
}));

// fetchSavingsInterestPayouts hits a live endpoint during initializeSavings;
// fail it fast so no network call escapes the test.
global.fetch = jest.fn(async () => ({ ok: false }));

const { SavingsProvider, useSavings } = require('../../context-store/savingsContext');

let ctx;
function Capture() {
  ctx = useSavings();
  return null;
}

function providerElement() {
  return React.createElement(
    SavingsProvider,
    null,
    React.createElement(Capture),
  );
}

async function mount() {
  await act(async () => {
    ReactTestRenderer.create(providerElement());
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  mockGetLocalStorageItem.mockResolvedValue(null);
  mockGetAllSavingsTransactions.mockResolvedValue([]);
  mockGetBitcoinWithdrawls.mockResolvedValue({ transfers: [] });
  mockGetTokenTransactions.mockResolvedValue({ transactions: [] });
  global.fetch.mockResolvedValue({ ok: false });
  ctx = undefined;
  await mount();
});

function transferFixture(id, senderKey) {
  return {
    id,
    senderIdentityPublicKey: senderKey,
    totalValue: 5000,
    createdTime: 1700000000000,
  };
}

describe('restorePaymentsFromSpark bitcoin-withdrawal sender check', () => {
  it('keeps own-sender withdrawals in serialized and raw shapes, drops foreign senders', async () => {
    // Webview bridge serialization of a Uint8Array: plain {0:..,1:..} object.
    const serializedOwnSender = Object.assign({}, Buffer.from(IDENTITY_HEX, 'hex'));
    const rawOwnSender = Buffer.from(IDENTITY_HEX, 'hex');
    const foreignSender = Buffer.from(OTHER_HEX, 'hex');

    mockGetBitcoinWithdrawls.mockResolvedValue({
      transfers: [
        transferFixture('serialized-sender', serializedOwnSender),
        transferFixture('raw-sender', rawOwnSender),
        transferFixture('foreign-sender', foreignSender),
      ],
    });

    await act(async () => {
      await ctx.initializeSavings();
    });

    expect(mockCreateSavingsTransactions).toHaveBeenCalledTimes(1);
    const kept = mockCreateSavingsTransactions.mock.calls[0][0];
    expect(kept.map(tx => tx.id)).toEqual(['serialized-sender', 'raw-sender']);
    expect(kept.every(tx => tx.type === 'bitcoinWithdrawal')).toBe(true);
    expect(kept.every(tx => tx.amountMicros === 5000 * 1e6)).toBe(true);
  });

  it('keeps nothing when every transfer is sent by another wallet', async () => {
    mockGetBitcoinWithdrawls.mockResolvedValue({
      transfers: [
        transferFixture('foreign-1', Buffer.from(OTHER_HEX, 'hex')),
        transferFixture(
          'foreign-2',
          Object.assign({}, Buffer.from(OTHER_HEX, 'hex')),
        ),
      ],
    });

    await act(async () => {
      await ctx.initializeSavings();
    });

    expect(mockCreateSavingsTransactions).not.toHaveBeenCalled();
  });
});