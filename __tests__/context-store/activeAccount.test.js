/* eslint-env jest */
// ---------------------------------------------------------------------------
// ActiveCustodyAccountProvider wiring for the v3 custody-account encryption.
// The crypto itself is unit-tested in __tests__/functions/
// custodyAccountsCrypto.test.js; here the crypto module is mocked and we
// assert the provider calls it correctly at every boundary:
//   - init decrypts through loadCustodyAccounts(seed) and migrates legacy data
//   - all five write sites go through writeCustodyAccounts(accounts, seed)
//   - logout/wipe (authResetkey) clears the session crypto cache
// ---------------------------------------------------------------------------

import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

const SEED =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const ACCOUNT = {
  uuid: 'u-1',
  name: 'Imported A',
  mnemoinc:
    'letter advice cage absurd amount doctor acoustic avoid letter advice cage above',
  accountType: 'imported',
  dateCreated: 1,
  isActive: false,
  profileEmoji: '',
};

const mockKeys = { accountMnemoinc: SEED, setAccountMnemonic: jest.fn() };
jest.mock('../../context-store/keys', () => ({
  __esModule: true,
  useKeysContext: () => mockKeys,
}));

const mockGlobal = {
  masterInfoObject: {
    didViewNWCMessage: true,
    pinnedAccounts: [],
    nextAccountDerivationIndex: 3,
  },
  toggleMasterInfoObject: jest.fn(),
};
jest.mock('../../context-store/context', () => ({
  __esModule: true,
  useGlobalContextProvider: () => mockGlobal,
}));

const mockAuth = { authResetkey: 0 };
jest.mock('../../context-store/authContext', () => ({
  __esModule: true,
  useAuthContext: () => mockAuth,
}));

const mockAppStatus = { didGetToHomepage: false };
jest.mock('../../context-store/appStatus', () => ({
  __esModule: true,
  useAppStatus: () => mockAppStatus,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, opts) => (opts && opts.index ? `name-${opts.index}` : key),
  }),
}));

const mockGetLocalStorageItem = jest.fn();
const mockSetLocalStorageItem = jest.fn(async () => true);
const mockRetrieveData = jest.fn(async () => ({ value: null }));
jest.mock('../../app/functions', () => ({
  __esModule: true,
  getLocalStorageItem: (...a) => mockGetLocalStorageItem(...a),
  setLocalStorageItem: (...a) => mockSetLocalStorageItem(...a),
  retrieveData: (...a) => mockRetrieveData(...a),
}));

jest.mock('../../app/constants', () => ({
  __esModule: true,
  CUSTODY_ACCOUNTS_STORAGE_KEY: 'CUSTODY_ACCOUNTS',
  NWC_SECURE_STORE_MNEMOINC: 'NWC_SECURE_STORE_MNEMOINC',
  MAX_DERIVED_ACCOUNTS: 1000,
}));

const mockLoadCustodyAccounts = jest.fn();
const mockWriteCustodyAccounts = jest.fn(async () => true);
const mockResetCustodyCryptoState = jest.fn();
jest.mock('../../app/functions/custodyAccountsCrypto', () => ({
  __esModule: true,
  loadCustodyAccounts: (...a) => mockLoadCustodyAccounts(...a),
  writeCustodyAccounts: (...a) => mockWriteCustodyAccounts(...a),
  resetCustodyCryptoState: (...a) => mockResetCustodyCryptoState(...a),
}));

jest.mock('../../app/functions/accounts/derivedAccounts', () => ({
  __esModule: true,
  deriveAccountMnemonic: jest.fn(async () => 'derived-mnemonic'),
}));

jest.mock('../../app/functions/customUUID', () => ({
  __esModule: true,
  default: jest.fn(() => 'uuid-generated'),
}));

const {
  ActiveCustodyAccountProvider,
  useActiveCustodyAccount,
} = require('../../context-store/activeAccount');

let ctx;
function Capture() {
  ctx = useActiveCustodyAccount();
  return null;
}

// Build a fresh element per call: React 19's test renderer no-ops update()
// when handed the same element reference, so re-renders must use a new one.
function providerElement() {
  return React.createElement(
    ActiveCustodyAccountProvider,
    null,
    React.createElement(Capture),
  );
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function mount() {
  const renderer = await act(async () =>
    ReactTestRenderer.create(providerElement()),
  );
  await flush();
  return { renderer };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockKeys.accountMnemoinc = SEED;
  mockGlobal.masterInfoObject = {
    didViewNWCMessage: true,
    pinnedAccounts: [],
    nextAccountDerivationIndex: 3,
  };
  mockAuth.authResetkey = 0;
  mockAppStatus.didGetToHomepage = false;
  // Default: no stored data. Tests that stub a blob must be key-aware so the
  // provider's other reads (e.g. hasRunAutoRestore, which it JSON.parses)
  // never receive the account-list fixture.
  mockGetLocalStorageItem.mockResolvedValue(null);
  mockRetrieveData.mockResolvedValue({ value: null });
  mockLoadCustodyAccounts.mockResolvedValue([]);
  ctx = undefined;
});

describe('initializeAccouts (v3 wiring)', () => {
  it('loads and decrypts through loadCustodyAccounts with the master seed', async () => {
    mockGetLocalStorageItem.mockImplementation(key =>
      Promise.resolve(key === 'CUSTODY_ACCOUNTS' ? 'stored-raw' : null),
    );
    mockLoadCustodyAccounts.mockResolvedValue([ACCOUNT]);

    await mount();

    expect(mockGetLocalStorageItem).toHaveBeenCalledWith('CUSTODY_ACCOUNTS');
    expect(mockLoadCustodyAccounts).toHaveBeenCalledWith('stored-raw', SEED);
    expect(ctx.custodyAccounts).toEqual([ACCOUNT]);
  });

  it('does not call the crypto module before the seed is available', async () => {
    mockKeys.accountMnemoinc = '';

    await mount();

    expect(mockLoadCustodyAccounts).not.toHaveBeenCalled();
  });
});

describe('account writes route through writeCustodyAccounts', () => {
  beforeEach(async () => {
    mockLoadCustodyAccounts.mockResolvedValue([ACCOUNT]);
    await mount();
    mockWriteCustodyAccounts.mockClear();
  });

  it('createAccount persists the new list encrypted with the master seed', async () => {
    const created = { ...ACCOUNT, uuid: 'u-new', name: 'New' };
    await act(async () => {
      await ctx.createAccount(created);
    });

    expect(mockWriteCustodyAccounts).toHaveBeenCalledWith(
      [ACCOUNT, created],
      SEED,
    );
    expect(ctx.custodyAccounts).toEqual([ACCOUNT, created]);
  });

  it('updateAccount persists the modified list', async () => {
    const updated = { ...ACCOUNT, name: 'Renamed' };
    await act(async () => {
      await ctx.updateAccount(updated);
    });

    expect(mockWriteCustodyAccounts).toHaveBeenCalledWith([updated], SEED);
  });

  it('removeAccount persists the remaining list', async () => {
    await act(async () => {
      await ctx.removeAccount(ACCOUNT);
    });

    expect(mockWriteCustodyAccounts).toHaveBeenCalledWith([], SEED);
  });

  it('session reset clears active flags through writeCustodyAccounts', async () => {
    mockWriteCustodyAccounts.mockClear();
    // A fresh mount with an active account triggers the session-reset effect.
    mockLoadCustodyAccounts.mockResolvedValue([{ ...ACCOUNT, isActive: true }]);
    await mount();

    expect(mockWriteCustodyAccounts).toHaveBeenCalledWith(
      [{ ...ACCOUNT, isActive: false }],
      SEED,
    );
  });
});

describe('authResetkey teardown', () => {
  it('clears the session crypto cache and account state on logout/wipe', async () => {
    mockLoadCustodyAccounts.mockResolvedValue([ACCOUNT]);
    const { renderer } = await mount();
    expect(ctx.custodyAccounts).toEqual([ACCOUNT]);

    mockAuth.authResetkey = 1;
    act(() => {
      renderer.update(providerElement());
    });
    await flush();

    expect(mockResetCustodyCryptoState).toHaveBeenCalled();
    expect(ctx.custodyAccounts).toEqual([]);
  });
});
