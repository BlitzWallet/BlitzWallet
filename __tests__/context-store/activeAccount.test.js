/* eslint-env jest */
// ---------------------------------------------------------------------------
// ActiveCustodyAccountProvider wiring for the v3 custody-account encryption.
// The crypto itself is unit-tested in __tests__/functions/
// custodyAccountsCrypto.test.js; here the crypto module is mocked and we
// assert the provider calls it correctly at every boundary:
//   - init decrypts through loadCustodyAccounts(seed) and migrates legacy data
//     (including the one-time deterministic-uuid rewrite)
//   - all write sites go through writeCustodyAccounts(accounts, seed)
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

const mockKeys = {
  accountMnemoinc: SEED,
  publicKey: 'test-pubkey',
  setAccountMnemonic: jest.fn(),
};
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

const mockDeleteLnurlRegistryEntry = jest.fn(async () => true);
jest.mock('../../db', () => ({
  __esModule: true,
  deleteLnurlRegistryEntry: (...a) => mockDeleteLnurlRegistryEntry(...a),
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
  deriveAccountMnemonic: (...a) => mockDeriveAccountMnemonic(...a),
  generateAccountUuid: (...a) => mockGenerateAccountUuid(...a),
}));

const mockDeriveAccountMnemonic = jest.fn(async () => 'derived-mnemonic');
// Defaults to the fixture's own uuid so legacy-id tests see a no-op
// migration; deterministic-uuid tests override this.
const mockGenerateAccountUuid = jest.fn(async () => 'u-1');

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
  mockDeriveAccountMnemonic.mockReset();
  mockDeriveAccountMnemonic.mockResolvedValue('derived-mnemonic');
  mockGenerateAccountUuid.mockReset();
  // Default: the deterministic id equals the fixture's uuid so legacy-id
  // tests observe a no-op migration; uuid-migration tests override this.
  mockGenerateAccountUuid.mockResolvedValue('u-1');
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

  it('removeAccount prunes the LNURL registry entry of an imported account', async () => {
    mockGlobal.masterInfoObject = {
      didViewNWCMessage: true,
      pinnedAccounts: [],
      nextAccountDerivationIndex: 3,
      accountsLnurl: {
        abcde: { uuid: 'u-1', identityPubKey: '0x123' },
        fghij: { uuid: 'u-2', identityPubKey: '0x456' },
      },
    };
    await mount();
    await act(async () => {
      await ctx.removeAccount(ACCOUNT);
    });

    expect(mockDeleteLnurlRegistryEntry).toHaveBeenCalledWith(
      'test-pubkey',
      'abcde',
    );
    expect(mockWriteCustodyAccounts).toHaveBeenCalledWith([], SEED);
  });

  it('removeAccount leaves the registry alone for accounts without a stored seed', async () => {
    mockGlobal.masterInfoObject = {
      didViewNWCMessage: true,
      pinnedAccounts: [],
      nextAccountDerivationIndex: 3,
      accountsLnurl: {
        abcde: { uuid: 'u-1', identityPubKey: '0x123' },
      },
    };
    await mount();
    const derived = { ...ACCOUNT, mnemoinc: undefined };
    await act(async () => {
      await ctx.removeAccount(derived);
    });

    expect(mockDeleteLnurlRegistryEntry).not.toHaveBeenCalled();
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

describe('deterministic account UUIDs', () => {
  it('createDerivedAccount derives the uuid from the account identity key', async () => {
    await mount();
    mockGenerateAccountUuid.mockResolvedValue('deterministicuuid01');

    let res;
    await act(async () => {
      res = await ctx.createDerivedAccount('New acct');
    });

    expect(mockDeriveAccountMnemonic).toHaveBeenCalledWith(SEED, 4);
    expect(res.didWork).toBe(true);
    expect(res.uuid).toBe('deterministicuuid01');
    const written = mockWriteCustodyAccounts.mock.calls[0][0];
    expect(written[0].uuid).toBe('deterministicuuid01');
    expect(written[0].derivationIndex).toBe(4);
  });

  it('restoreDerivedAccount derives the uuid from the restored index', async () => {
    await mount();
    mockGenerateAccountUuid.mockResolvedValue('restoredetuuid0001');

    let res;
    await act(async () => {
      // Index 3 is the only valid restore target at the default
      // nextAccountDerivationIndex (validation #4).
      res = await ctx.restoreDerivedAccount('Restored', 3);
    });

    expect(mockDeriveAccountMnemonic).toHaveBeenCalledWith(SEED, 3);
    expect(res.didWork).toBe(true);
    const written = mockWriteCustodyAccounts.mock.calls[0][0];
    expect(written[0].uuid).toBe('restoredetuuid0001');
  });

  it('migration rewrites legacy random uuids to identity-key ids once', async () => {
    mockLoadCustodyAccounts.mockResolvedValue([ACCOUNT]);
    mockGenerateAccountUuid.mockResolvedValue('migrateddetuuid01');

    await mount();

    expect(mockDeriveAccountMnemonic).not.toHaveBeenCalled(); // imported seed used directly
    expect(mockWriteCustodyAccounts).toHaveBeenCalledWith(
      [{ ...ACCOUNT, uuid: 'migrateddetuuid01' }],
      SEED,
    );
    expect(mockSetLocalStorageItem).toHaveBeenCalledWith(
      'hasRunDeterministicUuidMigration',
      JSON.stringify(true),
    );
    expect(ctx.custodyAccounts[0].uuid).toBe('migrateddetuuid01');
  });

  it('migration derives derived-account mnemonics from the master seed', async () => {
    const derived = {
      uuid: 'u-2',
      name: 'Derived A',
      derivationIndex: 4,
      dateCreated: 1,
      isActive: false,
      accountType: 'derived',
      profileEmoji: '',
    };
    mockLoadCustodyAccounts.mockResolvedValue([derived]);
    mockGenerateAccountUuid.mockResolvedValue('deriveddetuuid001');

    await mount();

    expect(mockDeriveAccountMnemonic).toHaveBeenCalledWith(SEED, 4);
    expect(mockWriteCustodyAccounts).toHaveBeenCalledWith(
      [{ ...derived, uuid: 'deriveddetuuid001' }],
      SEED,
    );
  });

  it('migration is skipped once its flag is stored', async () => {
    mockGetLocalStorageItem.mockImplementation(key =>
      Promise.resolve(
        key === 'hasRunDeterministicUuidMigration' ? 'true' : null,
      ),
    );
    mockLoadCustodyAccounts.mockResolvedValue([ACCOUNT]);

    await mount();

    expect(mockGenerateAccountUuid).not.toHaveBeenCalled();
    expect(mockSetLocalStorageItem).not.toHaveBeenCalledWith(
      'hasRunDeterministicUuidMigration',
      JSON.stringify(true),
    );
    expect(ctx.custodyAccounts).toEqual([ACCOUNT]);
  });

  it('migration leaves accounts untouched when ids already match', async () => {
    mockLoadCustodyAccounts.mockResolvedValue([ACCOUNT]);

    await mount();

    expect(mockGenerateAccountUuid).toHaveBeenCalledWith(ACCOUNT.mnemoinc);
    expect(mockWriteCustodyAccounts).not.toHaveBeenCalledWith(
      [ACCOUNT],
      SEED,
    );
    // Flag is still set so future launches skip derivation entirely.
    expect(mockSetLocalStorageItem).toHaveBeenCalledWith(
      'hasRunDeterministicUuidMigration',
      JSON.stringify(true),
    );
    expect(ctx.custodyAccounts).toEqual([ACCOUNT]);
  });
});

describe('serialized custody writes', () => {
  it('concurrent createAccount and cloud restore merge instead of clobbering', async () => {
    mockGlobal.masterInfoObject = {
      didViewNWCMessage: true,
      pinnedAccounts: [],
      nextAccountDerivationIndex: 4,
    };
    mockGenerateAccountUuid.mockResolvedValue('restoreduuid0001');
    await mount();
    mockWriteCustodyAccounts.mockClear();

    const created = { ...ACCOUNT, uuid: 'u-new', name: 'New' };
    let createResult, restoreResult;
    await act(async () => {
      // Deliberately interleave: the restore derives keys async before
      // writing, which used to be the lost-update window.
      [createResult, restoreResult] = await Promise.all([
        ctx.createAccount(created),
        ctx.restoreDerivedAccountsFromCloud(),
      ]);
    });

    expect(createResult.didWork).toBe(true);
    expect(restoreResult.didWork).toBe(true);
    const writes = mockWriteCustodyAccounts.mock.calls.map(call => call[0]);
    const finalWrite = writes[writes.length - 1];
    expect(finalWrite.map(a => a.uuid).sort()).toEqual([
      'restoreduuid0001',
      'u-new',
    ]);
    expect(ctx.custodyAccounts.map(a => a.uuid).sort()).toEqual([
      'restoreduuid0001',
      'u-new',
    ]);
  });
});

describe('auto-restore completion flag', () => {
  beforeEach(() => {
    mockAppStatus.didGetToHomepage = true;
    mockGlobal.masterInfoObject = {
      didViewNWCMessage: true,
      pinnedAccounts: [],
      nextAccountDerivationIndex: 4,
    };
    mockLoadCustodyAccounts.mockResolvedValue([]);
  });

  it('sets hasRunAutoRestore only after the restore write lands', async () => {
    await mount();

    expect(mockWriteCustodyAccounts).toHaveBeenCalled();
    const flagCallIndex = mockSetLocalStorageItem.mock.calls.findIndex(
      call => call[0] === 'hasRunAutoRestore',
    );
    expect(flagCallIndex).toBeGreaterThanOrEqual(0);
    const writeOrder = mockWriteCustodyAccounts.mock.invocationCallOrder[0];
    const flagOrder =
      mockSetLocalStorageItem.mock.invocationCallOrder[flagCallIndex];
    expect(writeOrder).toBeLessThan(flagOrder);
  });

  it('does not set hasRunAutoRestore when the restore write fails', async () => {
    mockWriteCustodyAccounts.mockRejectedValueOnce(new Error('disk full'));

    await mount();

    expect(mockSetLocalStorageItem).not.toHaveBeenCalledWith(
      'hasRunAutoRestore',
      JSON.stringify(true),
    );
  });
});
