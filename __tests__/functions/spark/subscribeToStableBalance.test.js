// Unit tests for the opt-in `stabilize` mode of subscribeToSparkBalance:
// debounce the read + downward-gate the result so a Spark auto-optimization
// burst (available dips then settles) can't flicker the displayed balance.
//
// spark/index.js pulls in the native SDK; mock the whole module so this is a
// plain unit test of the staging/gate logic.
const mockGetSparkBalance = jest.fn();
const mockIsOptimizationInProgress = jest.fn();

jest.mock('../../../app/functions/spark', () => ({
  getSparkBalance: (...a) => mockGetSparkBalance(...a),
  isOptimizationInProgress: (...a) => mockIsOptimizationInProgress(...a),
  selectSparkRuntime: jest.fn().mockResolvedValue('webview'),
  attachWalletListeners: jest.fn().mockResolvedValue(true),
  getWallet: jest.fn(),
}));

jest.mock('../../../app/functions/hash', () => ({
  __esModule: true,
  default: () => 'WALLET_HASH',
}));

const EventEmitter = require('events');
jest.mock('../../../context-store/webViewContext', () => {
  const EE = require('events');
  return {
    BALANCE_UPDATE_EVENT_NAME: 'SPARK_BALANCE_UPDATE',
    TOKEN_BALANCE_UPDATE_EVENT_NAME: 'SPARK_TOKEN_BALANCE_UPDATE',
    sparkBalanceUpdateEmitter: new EE(),
    sparkTokenBalanceUpdateEmitter: new EE(),
  };
});

const {
  sparkBalanceUpdateEmitter,
  BALANCE_UPDATE_EVENT_NAME,
} = require('../../../context-store/webViewContext');
const {
  subscribeToSparkBalance,
} = require('../../../app/functions/spark/awaitBalanceChange');

const bal = (balance, didWork = true) => ({ didWork, balance, tokensObj: null });
const emitBalance = () =>
  sparkBalanceUpdateEmitter.emit(BALANCE_UPDATE_EVENT_NAME, {}, 'WALLET_HASH');

// Resolve setup()'s immediate read + listener attach.
const flushSetup = () => jest.advanceTimersByTimeAsync(0);

describe('subscribeToSparkBalance stabilize mode', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetSparkBalance.mockReset();
    mockIsOptimizationInProgress.mockReset();
  });
  afterEach(() => jest.useRealTimers());

  it('holds an optimization dip and never paints the intermediate values', async () => {
    // setup read = 200 (settled), flush read during optimization = 120 (dip),
    // second flush read = 200 (settled again).
    mockGetSparkBalance
      .mockResolvedValueOnce(bal(200))
      .mockResolvedValueOnce(bal(120))
      .mockResolvedValueOnce(bal(200));
    mockIsOptimizationInProgress.mockResolvedValue({
      didWork: true,
      isOptimizing: true,
    });

    const onUpdate = jest.fn();
    const sub = subscribeToSparkBalance({
      mnemonic: 'seed',
      onUpdate,
      stabilize: true,
    });
    await sub.ready;
    await flushSetup();

    emitBalance(); // optimization burst begins
    await jest.advanceTimersByTimeAsync(3000); // debounce flush -> reads 120

    const painted = onUpdate.mock.calls.map(c => c[0].balance);
    expect(painted).toEqual([200]); // 120 held, never painted
    expect(mockIsOptimizationInProgress).toHaveBeenCalledTimes(1);

    sub.unsubscribe();
  });

  it('commits a real decrease when optimization is not in progress', async () => {
    mockGetSparkBalance
      .mockResolvedValueOnce(bal(200))
      .mockResolvedValueOnce(bal(100));
    mockIsOptimizationInProgress.mockResolvedValue({
      didWork: true,
      isOptimizing: false,
    });

    const onUpdate = jest.fn();
    const sub = subscribeToSparkBalance({
      mnemonic: 'seed',
      onUpdate,
      stabilize: true,
    });
    await sub.ready;
    await flushSetup();

    emitBalance();
    await jest.advanceTimersByTimeAsync(3000);

    const painted = onUpdate.mock.calls.map(c => c[0].balance);
    expect(painted).toEqual([200, 100]);
    sub.unsubscribe();
  });

  it('retries (does not fail-open paint) when the optimization check throws, then paints once it recovers', async () => {
    // The check is "unknown" on a bridge timeout — the dip can't be trusted, so
    // the value is held and a bounded retry re-reads. On the retry the check
    // succeeds (not optimizing) so the real decrease finally paints.
    mockGetSparkBalance
      .mockResolvedValueOnce(bal(200)) // setup
      .mockResolvedValueOnce(bal(100)) // flush #1 (dip)
      .mockResolvedValueOnce(bal(100)); // retry flush (still dip)
    mockIsOptimizationInProgress
      .mockRejectedValueOnce(new Error('bridge timeout'))
      .mockResolvedValueOnce({ didWork: true, isOptimizing: false });

    const onUpdate = jest.fn();
    const sub = subscribeToSparkBalance({
      mnemonic: 'seed',
      onUpdate,
      stabilize: true,
    });
    await sub.ready;
    await flushSetup();

    emitBalance();
    await jest.advanceTimersByTimeAsync(3000);
    expect(onUpdate.mock.calls.map(c => c[0].balance)).toEqual([200]); // held

    await jest.advanceTimersByTimeAsync(10000); // retry fires
    expect(onUpdate.mock.calls.map(c => c[0].balance)).toEqual([200, 100]);
    sub.unsubscribe();
  });

  it('resolves a held optimization dip via retry when no further settle event fires', async () => {
    // Dip held while optimizing; NO new balance event ever arrives. The retry
    // re-reads after the optimization settles (back to 200) and the transient
    // dip is dropped without ever painting.
    mockGetSparkBalance
      .mockResolvedValueOnce(bal(200)) // setup
      .mockResolvedValueOnce(bal(120)) // flush #1 (dip)
      .mockResolvedValueOnce(bal(200)); // retry flush (settled)
    mockIsOptimizationInProgress.mockResolvedValue({
      didWork: true,
      isOptimizing: true,
    });

    const onUpdate = jest.fn();
    const sub = subscribeToSparkBalance({
      mnemonic: 'seed',
      onUpdate,
      stabilize: true,
    });
    await sub.ready;
    await flushSetup();

    emitBalance();
    await jest.advanceTimersByTimeAsync(3000); // flush -> 120 -> optimizing -> hold
    await jest.advanceTimersByTimeAsync(10000); // retry -> 200 (equal, dropped)

    expect(onUpdate.mock.calls.map(c => c[0].balance)).toEqual([200]);
    expect(mockIsOptimizationInProgress).toHaveBeenCalledTimes(1); // retry read equal, no re-check
    sub.unsubscribe();
  });

  it('paints a real spend that lands while an optimization is in progress, via retry', async () => {
    // The failure scenario: balance genuinely dropped (real spend) AND the SDK
    // flags optimizing. The dip is held on flush #1, but the retry confirms the
    // optimization cleared and paints the true lower balance — no event needed.
    mockGetSparkBalance
      .mockResolvedValueOnce(bal(200)) // setup
      .mockResolvedValueOnce(bal(100)) // flush #1 (dip)
      .mockResolvedValueOnce(bal(100)); // retry flush (still 100 — real spend)
    mockIsOptimizationInProgress
      .mockResolvedValueOnce({ didWork: true, isOptimizing: true })
      .mockResolvedValueOnce({ didWork: true, isOptimizing: false });

    const onUpdate = jest.fn();
    const sub = subscribeToSparkBalance({
      mnemonic: 'seed',
      onUpdate,
      stabilize: true,
    });
    await sub.ready;
    await flushSetup();

    emitBalance();
    await jest.advanceTimersByTimeAsync(3000); // held
    expect(onUpdate.mock.calls.map(c => c[0].balance)).toEqual([200]);

    await jest.advanceTimersByTimeAsync(10000); // retry paints the real spend
    expect(onUpdate.mock.calls.map(c => c[0].balance)).toEqual([200, 100]);
    sub.unsubscribe();
  });

  it('does not read or paint when unsubscribed during the debounce window', async () => {
    mockGetSparkBalance.mockResolvedValue(bal(200));

    const onUpdate = jest.fn();
    const sub = subscribeToSparkBalance({
      mnemonic: 'seed',
      onUpdate,
      stabilize: true,
    });
    await sub.ready;
    await flushSetup();

    expect(mockGetSparkBalance).toHaveBeenCalledTimes(1); // setup read only
    emitBalance();
    sub.unsubscribe(); // tear down mid-debounce
    await jest.advanceTimersByTimeAsync(11000);

    expect(mockGetSparkBalance).toHaveBeenCalledTimes(1); // no flush read
    expect(onUpdate).toHaveBeenCalledTimes(1); // setup paint only
  });

  it('drops a stale optimization-check result superseded by a newer flush', async () => {
    // flush #1 reads a dip (120) and its optimization check is left pending;
    // flush #2 reads the settled 200. When the stale check finally resolves
    // "not optimizing", the generation guard must drop it so 120 never paints.
    let resolveCheck;
    mockGetSparkBalance
      .mockResolvedValueOnce(bal(200)) // setup
      .mockResolvedValueOnce(bal(120)) // flush #1 (dip)
      .mockResolvedValueOnce(bal(200)); // flush #2 (settled)
    mockIsOptimizationInProgress.mockImplementationOnce(
      () => new Promise(res => (resolveCheck = res)),
    );

    const onUpdate = jest.fn();
    const sub = subscribeToSparkBalance({
      mnemonic: 'seed',
      onUpdate,
      stabilize: true,
    });
    await sub.ready;
    await flushSetup();

    emitBalance();
    await jest.advanceTimersByTimeAsync(3000); // flush #1 -> 120 -> check pending
    emitBalance();
    await jest.advanceTimersByTimeAsync(3000); // flush #2 -> 200 (equal, no paint)

    resolveCheck({ didWork: true, isOptimizing: false }); // stale resolves late
    await flushSetup();

    expect(onUpdate.mock.calls.map(c => c[0].balance)).toEqual([200]);
    sub.unsubscribe();
  });

  it('default (stabilize off) paints every event immediately with no debounce', async () => {
    mockGetSparkBalance.mockResolvedValue(bal(150));

    const onUpdate = jest.fn();
    const sub = subscribeToSparkBalance({ mnemonic: 'seed', onUpdate });
    await sub.ready;
    await flushSetup();

    emitBalance();
    await flushSetup(); // no timers involved

    expect(onUpdate.mock.calls.map(c => c[0].balance)).toEqual([150, 150]);
    expect(mockIsOptimizationInProgress).not.toHaveBeenCalled();
    sub.unsubscribe();
  });
});
