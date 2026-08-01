/* eslint-env jest */
// ---------------------------------------------------------------------------
// giftContext — restore-on-Domesday must never persist the derived gift seed.
//
// M1: the expired-gift path used to write `restoreKey: derivedMnemonic` (a raw
// BIP39 seed) into the plaintext SQLite gift DB. We mount GiftProvider, drive
// the homepage restore flow, and assert:
//   - Expired gifts are saved WITHOUT any restoreKey / plaintext mnemonic.
//   - Active gifts are still saved encrypted (encryptedText present, no
//     plaintext seed), so the existing claim flow keeps working.
// ---------------------------------------------------------------------------

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

const mockAppStatus = { didGetToHomepage: false };
const mockGlobalCtx = { masterInfoObject: { uuid: 'me-uuid' } };
const mockKeys = {
  accountMnemoinc:
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
};
const mockLocal = {
  get: jest.fn(async () => 'false'),
  set: jest.fn(async () => {}),
};
const mockStorage = {
  bulkDeleteGiftsLocal: jest.fn(async () => true),
  bulkSaveGiftsLocal: jest.fn(async () => true),
  deleteGiftLocal: jest.fn(async () => true),
  getAllLocalGifts: jest.fn(async () => []),
  saveGiftLocal: jest.fn(async () => true),
  updateGiftLocal: jest.fn(async () => ({})),
};
const mockDb = {
  addGiftToDatabase: jest.fn(async () => true),
  bulkAddGiftsToDatabase: jest.fn(async () => true),
  bulkDeleteGiftsFromDatabase: jest.fn(async () => true),
  deleteGift: jest.fn(async () => true),
  handleGiftCheck: jest.fn(async () => ({ didWork: true, wasClaimed: false })),
  reloadGiftsOnDomesday: jest.fn(async () => []),
  updateGiftInDatabase: jest.fn(async () => true),
};
const mockMnemonic =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const CUTOFF = 1763650239108;

jest.mock('../../context-store/appStatus', () => ({
  __esModule: true,
  useAppStatus: () => ({
    didGetToHomepage: mockAppStatus.didGetToHomepage,
  }),
}));

jest.mock('../../context-store/context', () => ({
  __esModule: true,
  useGlobalContextProvider: () => ({
    masterInfoObject: mockGlobalCtx.masterInfoObject,
  }),
}));

jest.mock('../../context-store/keys', () => ({
  __esModule: true,
  useKeysContext: () => ({
    accountMnemoinc: mockKeys.accountMnemoinc,
  }),
}));

jest.mock('../../app/functions', () => ({
  __esModule: true,
  getLocalStorageItem: (...a) => mockLocal.get(...a),
  setLocalStorageItem: (...a) => mockLocal.set(...a),
}));

jest.mock('../../app/functions/gift/giftsStorage', () => ({
  __esModule: true,
  bulkDeleteGiftsLocal: (...a) => mockStorage.bulkDeleteGiftsLocal(...a),
  bulkSaveGiftsLocal: (...a) => mockStorage.bulkSaveGiftsLocal(...a),
  deleteGiftLocal: (...a) => mockStorage.deleteGiftLocal(...a),
  getAllLocalGifts: (...a) => mockStorage.getAllLocalGifts(...a),
  saveGiftLocal: (...a) => mockStorage.saveGiftLocal(...a),
  updateGiftLocal: (...a) => mockStorage.updateGiftLocal(...a),
}));

jest.mock('../../db', () => ({
  __esModule: true,
  addGiftToDatabase: (...a) => mockDb.addGiftToDatabase(...a),
  bulkAddGiftsToDatabase: (...a) => mockDb.bulkAddGiftsToDatabase(...a),
  bulkDeleteGiftsFromDatabase: (...a) => mockDb.bulkDeleteGiftsFromDatabase(...a),
  deleteGift: (...a) => mockDb.deleteGift(...a),
  handleGiftCheck: (...a) => mockDb.handleGiftCheck(...a),
  reloadGiftsOnDomesday: (...a) => mockDb.reloadGiftsOnDomesday(...a),
  updateGiftInDatabase: (...a) => mockDb.updateGiftInDatabase(...a),
}));

jest.mock('../../app/functions/gift/deriveGiftWallet', () => ({
  __esModule: true,
  deriveSparkGiftMnemonic: jest.fn(async () => ({
    success: true,
    derivedMnemonic: mockMnemonic,
  })),
}));

jest.mock('../../app/functions/seed', () => ({
  __esModule: true,
  deriveKeyFromMnemonic: jest.fn(async () => ({
    success: true,
    derivedMnemonic: mockMnemonic,
  })),
}));

jest.mock('../../app/constants', () => ({
  __esModule: true,
  GIFT_DERIVE_PATH_CUTOFF: CUTOFF,
}));

jest.mock('../../app/functions/messaging/encodingAndDecodingMessages', () => ({
  __esModule: true,
  encriptMessage: jest.fn(() => 'ENCRYPTED_CIPHERTEXT'),
}));

const { GiftProvider } = require('../../context-store/giftContext');

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function mount() {
  await act(async () => {
    ReactTestRenderer.create(React.createElement(GiftProvider, null, null));
  });
  await flush();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAppStatus.didGetToHomepage = false;
  mockLocal.get.mockResolvedValue('false');
  mockLocal.set.mockResolvedValue(undefined);
  mockStorage.getAllLocalGifts.mockResolvedValue([]);
  mockStorage.saveGiftLocal.mockResolvedValue(true);
  mockStorage.updateGiftLocal.mockResolvedValue({});
  mockDb.reloadGiftsOnDomesday.mockResolvedValue([]);
  mockDb.handleGiftCheck.mockResolvedValue({ didWork: true, wasClaimed: false });
  mockDb.updateGiftInDatabase.mockResolvedValue(true);
});

describe('giftContext — expired gift restore', () => {
  test('persists the gift WITHOUT a restoreKey or plaintext seed', async () => {
    mockDb.reloadGiftsOnDomesday.mockResolvedValue([
      {
        uuid: 'gift-expired-1',
        createdBy: 'me-uuid',
        createdTime: CUTOFF + 1,
        expireTime: Date.now() - 1000,
        giftNum: 1001,
        state: 'Unclaimed',
      },
    ]);
    mockAppStatus.didGetToHomepage = true;

    await mount();

    expect(mockDb.reloadGiftsOnDomesday).toHaveBeenCalledWith('me-uuid');
    expect(mockStorage.saveGiftLocal).toHaveBeenCalledTimes(1);

    const persisted = mockStorage.saveGiftLocal.mock.calls[0][0];
    expect('restoreKey' in persisted).toBe(false);
    expect(JSON.stringify(persisted)).not.toContain(mockMnemonic);
    // The expired path is local-only; nothing is written back to Firestore.
    expect(mockDb.updateGiftInDatabase).not.toHaveBeenCalled();
  });
});

describe('giftContext — active gift restore', () => {
  test('persists the seed only as encryptedText, never in plaintext', async () => {
    mockDb.reloadGiftsOnDomesday.mockResolvedValue([
      {
        uuid: 'gift-active-1',
        createdBy: 'me-uuid',
        createdTime: CUTOFF + 1,
        expireTime: Date.now() + 100000,
        giftNum: 1002,
        state: 'Unclaimed',
      },
    ]);
    mockAppStatus.didGetToHomepage = true;

    await mount();

    expect(mockDb.updateGiftInDatabase).toHaveBeenCalledTimes(1);
    expect(mockStorage.saveGiftLocal).toHaveBeenCalledTimes(1);

    const persisted = mockStorage.saveGiftLocal.mock.calls[0][0];
    expect(persisted.encryptedText).toBe('ENCRYPTED_CIPHERTEXT');
    expect('restoreKey' in persisted).toBe(false);
    expect(JSON.stringify(persisted)).not.toContain(mockMnemonic);
  });
});
