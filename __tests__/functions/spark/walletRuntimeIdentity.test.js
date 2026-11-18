// Identity guard on the connect path. Failure modes covered:
// 1. expectedIdentity from another mnemonic opens the wallet anyway
//    (cross-identity storage + handle poisoning) — must throw, never connect.
// 2. A matching expectedIdentity is wrongly refused.
// 3. The SDK reports a different identity than the mnemonic's — must throw and
//    disconnect the SDK it opened.
// 4. sha256Hash fails (returns false) and two mnemonics share one cached
//    identity — each must still get its own.
import { connect } from '@breeztech/breez-sdk-spark-react-native';
import {
  acquire,
  identityFor,
} from '../../../app/functions/spark/walletRuntime';
import {
  clearSparkIdentityPublicKeyCache,
  deriveSparkIdentityKey,
} from '../../../app/functions/gift/deriveGiftWallet';
import sha256Hash from '../../../app/functions/hash';

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///docs/',
  deleteAsync: jest.fn(async () => {}),
}));
jest.mock('../../../app/functions/unilateralExit/exitStore', () => ({
  hasActiveExit: jest.fn(async () => false),
}));
jest.mock('../../../app/functions/hash', () => {
  const actual = jest.requireActual('../../../app/functions/hash');
  return { __esModule: true, default: jest.fn(actual.default) };
});

const MNEMONIC_A =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const MNEMONIC_B =
  'legal winner thank year wave sausage worth useful legal winner thank yellow';

const fakeSdk = identityPubkey => ({
  getInfo: jest.fn(async () => ({ identityPubkey })),
  addEventListener: jest.fn(async () => 'listener'),
  removeEventListener: jest.fn(async () => {}),
  disconnect: jest.fn(async () => {}),
});

let idA;
let idB;

beforeAll(async () => {
  idA = (await deriveSparkIdentityKey(MNEMONIC_A, 1)).publicKeyHex;
  idB = (await deriveSparkIdentityKey(MNEMONIC_B, 1)).publicKeyHex;
  expect(idA).toBeTruthy();
  expect(idB).toBeTruthy();
  expect(idA).not.toBe(idB);
});

beforeEach(() => {
  clearSparkIdentityPublicKeyCache();
  connect.mockReset();
});

test('expectedIdentity from another mnemonic throws IdentityMismatch and never connects', async () => {
  await expect(
    acquire(MNEMONIC_A, { mode: 'client', expectedIdentity: idB }),
  ).rejects.toMatchObject({ code: 'IdentityMismatch' });
  expect(connect).not.toHaveBeenCalled();
});

test('matching expectedIdentity connects under that identity storage dir', async () => {
  connect.mockResolvedValue(fakeSdk(idA));
  const handle = await acquire(MNEMONIC_A, {
    mode: 'server',
    expectedIdentity: idA,
  });
  expect(handle).toBeTruthy();
  expect(connect).toHaveBeenCalledTimes(1);
  expect(connect.mock.calls[0][0].storageDir.endsWith(idA)).toBe(true);
});

test('SDK reporting another identity throws IdentityMismatch and disconnects', async () => {
  // MNEMONIC_B is idB, but the SDK it connects reports idA.
  const liar = fakeSdk(idA);
  connect.mockResolvedValue(liar);
  await expect(acquire(MNEMONIC_B, { mode: 'client' })).rejects.toMatchObject({
    code: 'IdentityMismatch',
  });
  expect(liar.disconnect).toHaveBeenCalled();
});

test('failed sha256Hash does not make mnemonics share a cached identity', async () => {
  sha256Hash.mockImplementation(() => false);
  try {
    expect(await identityFor(MNEMONIC_A)).toBe(idA);
    expect(await identityFor(MNEMONIC_B)).toBe(idB);
  } finally {
    sha256Hash.mockImplementation(
      jest.requireActual('../../../app/functions/hash').default,
    );
  }
});
