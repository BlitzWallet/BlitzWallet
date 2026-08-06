/* eslint-env jest */
// factoryResetWallet now routes its table teardown through the shared
// deleteAllLocalWalletTables() batch (which covers balance snapshots, gift
// cards, rootstock swaps and both NWC databases — see
// wipeLocalWalletData.test.js for the full leak-set coverage). This suite pins
// the orchestration: keychain/AsyncStorage teardown first, then the shared
// table batch, then sign-out; any failure aborts without sign-out.

const mockTerminateAccount = jest.fn();
const mockDeleteAllLocalWalletTables = jest.fn();
const mockSignOut = jest.fn();

jest.mock('../../app/functions/secureStore', () => ({
  terminateAccount: (...args) => mockTerminateAccount(...args),
}));

jest.mock('../../app/functions/wipeLocalWalletData', () => ({
  deleteAllLocalWalletTables: (...args) => mockDeleteAllLocalWalletTables(...args),
}));

jest.mock('../../db/initializeFirebase', () => ({
  firebaseAuth: { currentUser: null },
}));

jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: jest.fn(() => ({ currentUser: null })),
  getAuth: jest.fn(() => ({ currentUser: null })),
  signOut: (...args) => mockSignOut(...args),
}));

const factoryResetWallet =
  require('../../app/functions/factoryResetWallet').default;

describe('factoryResetWallet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTerminateAccount.mockResolvedValue(true);
    mockDeleteAllLocalWalletTables.mockResolvedValue(true);
    mockSignOut.mockResolvedValue(true);
  });

  test('terminates the account, deletes every local table and signs out', async () => {
    const result = await factoryResetWallet();

    expect(result).toBe(true);
    expect(mockTerminateAccount).toHaveBeenCalledTimes(1);
    expect(mockDeleteAllLocalWalletTables).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  test('aborts without deleting tables when keychain teardown fails', async () => {
    mockTerminateAccount.mockResolvedValue(false);

    const result = await factoryResetWallet();

    expect(result).toBe(false);
    expect(mockDeleteAllLocalWalletTables).not.toHaveBeenCalled();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  test('aborts without signing out when a table delete rejects', async () => {
    mockDeleteAllLocalWalletTables.mockResolvedValue(false);

    const result = await factoryResetWallet();

    expect(result).toBe(false);
    expect(mockTerminateAccount).toHaveBeenCalledTimes(1);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  test('still succeeds when sign-out throws (matches legacy behavior)', async () => {
    mockSignOut.mockRejectedValue(new Error('sign out failed'));

    const result = await factoryResetWallet();

    expect(result).toBe(true);
  });
});
