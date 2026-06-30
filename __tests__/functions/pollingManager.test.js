// getBalanceWithTimeout wraps getSparkBalance in a hard timeout so a read that
// never settles (e.g. a WebView request whose timeout is neutered while the app
// is backgrounded) can't park the balance supervisor's await forever — which
// would wedge the entire balance lane (its running guard is only cleared in the
// supervisor's finally).
jest.mock('../../app/functions/spark', () => ({
  getSparkBalance: jest.fn(),
}));

jest.mock('../../app/functions/spark/restore', () => ({
  fullRestoreSparkState: jest.fn(),
}));

const { getSparkBalance } = require('../../app/functions/spark');
const { getBalanceWithTimeout } = require('../../app/functions/pollingManager');

describe('getBalanceWithTimeout', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('returns the real balance when the read resolves before the timeout', async () => {
    getSparkBalance.mockResolvedValue({ didWork: true, balance: 42 });
    await expect(getBalanceWithTimeout('mnemonic', 1000)).resolves.toEqual({
      didWork: true,
      balance: 42,
    });
  });

  it('resolves to didWork:false when the read hangs past the timeout', async () => {
    jest.useFakeTimers();
    // Never resolves — simulates a hung/neutered WebView read.
    getSparkBalance.mockReturnValue(new Promise(() => {}));

    const promise = getBalanceWithTimeout('mnemonic', 1000);
    jest.advanceTimersByTime(1000);

    await expect(promise).resolves.toEqual({ didWork: false });
  });
});
