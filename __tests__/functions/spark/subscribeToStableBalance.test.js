// Unit tests for subscribeToSparkBalance: an immediate read, a fresh read on
// each Breez balance event, and a re-read when the app returns to the
// foreground. (The old stabilize/optimization-dip mode no longer exists:
// Breez keeps swap-reserved leaves in the balance.)
//
// spark/index.js pulls in the Breez runtime; mock the modules so this is a
// plain unit test of the subscription logic.
const mockGetSparkBalance = jest.fn();
let mockListener = null;
const mockHandle = {
  on: jest.fn(cb => {
    mockListener = cb;
    return jest.fn();
  }),
  sync: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../../../app/functions/spark', () => ({
  getSparkBalance: (...a) => mockGetSparkBalance(...a),
}));
jest.mock('../../../app/functions/spark/walletRuntime', () => ({
  acquire: jest.fn(async () => mockHandle),
}));

const {
  subscribeToSparkBalance,
} = require('../../../app/functions/spark/awaitBalanceChange');

const bal = balance => ({ didWork: true, balance, tokensObj: null });
const flush = () => jest.advanceTimersByTimeAsync(0);

describe('subscribeToSparkBalance', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetSparkBalance.mockReset();
    mockListener = null;
  });
  afterEach(() => jest.useRealTimers());

  it('reads immediately and again on every balance event', async () => {
    mockGetSparkBalance.mockResolvedValue(bal(150));

    const onUpdate = jest.fn();
    const sub = subscribeToSparkBalance({ mnemonic: 'seed', onUpdate });
    await sub.ready;
    await flush();
    const afterSetup = onUpdate.mock.calls.length;

    mockListener({ type: 'paymentSucceeded' });
    await flush();

    expect(onUpdate.mock.calls.length).toBe(afterSetup + 1);
    expect(onUpdate.mock.calls.every(c => c[0].balance === 150)).toBe(true);
    sub.unsubscribe();
  });

  it('re-reads when the app returns to the foreground', async () => {
    const { AppState } = require('react-native');
    let onAppState;
    const spy = jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_e, cb) => {
        onAppState = cb;
        return { remove: jest.fn() };
      });
    mockGetSparkBalance
      .mockResolvedValueOnce(bal(100)) // setup
      .mockResolvedValueOnce(bal(100)) // post-attach re-read
      .mockResolvedValueOnce(bal(300)); // foreground read (claim while away)

    const onUpdate = jest.fn();
    const sub = subscribeToSparkBalance({ mnemonic: 'seed', onUpdate });
    await sub.ready;
    await flush();

    onAppState('background'); // no read
    onAppState('active');
    await flush();

    expect(onUpdate.mock.calls.map(c => c[0].balance)).toEqual([100, 100, 300]);
    sub.unsubscribe();
    spy.mockRestore();
  });
});
