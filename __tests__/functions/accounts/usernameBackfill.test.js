/* eslint-env jest */
// A6 lazy backfill (backfillUsernameReservation): reconcile the reservation for
// an existing user's current display name, keyed on a local {lower,...} record.
// db reservation helpers are mocked to observe call behavior; the record uses
// the real AsyncStorage mock.

const mockDb = {
  claimUniqueName: jest.fn(),
  ownsUniqueNameReservation: jest.fn(),
};

jest.mock('../../../db', () => ({
  __esModule: true,
  claimUniqueName: (...a) => mockDb.claimUniqueName(...a),
  ownsUniqueNameReservation: (...a) => mockDb.ownsUniqueNameReservation(...a),
}));

// The global crashlytics mock omits log/recordError, so crashlyticsLogReport
// (called by localStorage.js) throws — swallowing the AsyncStorage write. Stub it.
jest.mock('../../../app/functions/crashlyticsLogs', () => ({
  __esModule: true,
  crashlyticsLogReport: jest.fn(),
  crashlyticsRecordErrorReport: jest.fn(),
}));

const {
  backfillUsernameReservation,
  getUsernameReservationRecord,
  setUsernameReservationRecord,
  clearUsernameReservationRecord,
} = require('../../../app/functions/accounts/usernameReservationRecord');

beforeEach(async () => {
  jest.clearAllMocks();
  await clearUsernameReservationRecord();
});

test('record.lower === myLower → no-op (no Firestore reads)', async () => {
  await setUsernameReservationRecord({ lower: 'alice', at: 1 });

  await backfillUsernameReservation('uid', 'Alice');

  expect(mockDb.ownsUniqueNameReservation).not.toHaveBeenCalled();
  expect(mockDb.claimUniqueName).not.toHaveBeenCalled();
});

test('unset record + already owned → records ownership without claiming', async () => {
  mockDb.ownsUniqueNameReservation.mockResolvedValue(true);

  await backfillUsernameReservation('uid', 'Alice');

  expect(mockDb.claimUniqueName).not.toHaveBeenCalled();
  expect((await getUsernameReservationRecord()).lower).toBe('alice');
});

test('name changed since last claim → reconciles (claims the new name)', async () => {
  await setUsernameReservationRecord({ lower: 'bob', at: 1 });
  mockDb.ownsUniqueNameReservation.mockResolvedValue(false);
  mockDb.claimUniqueName.mockResolvedValue({ status: 'ok' });

  await backfillUsernameReservation('uid', 'Alice');

  expect(mockDb.ownsUniqueNameReservation).toHaveBeenCalledWith('uid', 'alice');
  expect(mockDb.claimUniqueName).toHaveBeenCalledWith('uid', null, 'alice');
  expect((await getUsernameReservationRecord()).lower).toBe('alice');
});

test('confirmed NAME_TAKEN is throttled for 24h', async () => {
  mockDb.ownsUniqueNameReservation.mockResolvedValue(false);
  mockDb.claimUniqueName.mockResolvedValue({ status: 'NAME_TAKEN' });

  await backfillUsernameReservation('uid', 'Alice');
  expect(mockDb.claimUniqueName).toHaveBeenCalledTimes(1);
  const rec = await getUsernameReservationRecord();
  expect(rec.takenName).toBe('alice');
  expect(typeof rec.takenAt).toBe('number');

  // Second run within 24h: skipped, no new claim attempt.
  await backfillUsernameReservation('uid', 'Alice');
  expect(mockDb.claimUniqueName).toHaveBeenCalledTimes(1);
});

test('invalid / empty display name → no-op', async () => {
  await backfillUsernameReservation('uid', '123'); // no letter → invalid
  await backfillUsernameReservation('uid', '');
  expect(mockDb.ownsUniqueNameReservation).not.toHaveBeenCalled();
  expect(mockDb.claimUniqueName).not.toHaveBeenCalled();
});
