// Regression coverage for the Flashnet swap-completion wait. The old inline
// `while (true)` loops polled getSingleTxDetails every 1.5s with no attempt
// cap: a stuck or malicious Spark node returning a perpetually non-completed
// status kept the device polling (~40 requests / 60s) with no way to abort.
// The helper must bound the wait by work (attempt cap + exponential backoff)
// and error out immediately on terminal 'failed' statuses.

const mockGetSingleTxDetails = jest.fn();
const mockGetSparkPaymentStatus = jest.fn();
const mockIsOptimizationInProgress = jest.fn();
const mockUnsubscribe = jest.fn();
let balanceUpdate;

jest.mock('../../../app/functions/spark', () => ({
  getSingleTxDetails: (...a) => mockGetSingleTxDetails(...a),
  getSparkPaymentStatus: (...a) => mockGetSparkPaymentStatus(...a),
  isOptimizationInProgress: (...a) => mockIsOptimizationInProgress(...a),
}));

jest.mock('../../../app/functions/spark/awaitBalanceChange', () => ({
  subscribeToSparkBalance: ({ onUpdate }) => {
    balanceUpdate = onUpdate;
    onUpdate({ didWork: true, balance: 1000 });
    return { ready: Promise.resolve(), unsubscribe: mockUnsubscribe };
  },
}));

jest.mock('../../../app/constants', () => ({
  IS_SPARK_ID: /^spark/,
}));

const { waitForSwapCompletion } = require(
  '../../../app/functions/spark/waitForSwapCompletion',
);

describe('waitForSwapCompletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    balanceUpdate = null;
    mockIsOptimizationInProgress.mockResolvedValue({
      didWork: true,
      isOptimizing: false,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('resolves after a completed transfer has a stable balance', async () => {
    mockGetSingleTxDetails.mockResolvedValue({
      status: 'TRANSFER_STATUS_COMPLETED',
    });
    mockGetSparkPaymentStatus.mockReturnValue('completed');

    const promise = waitForSwapCompletion('mnemonic', 'spark-id-1');

    await jest.advanceTimersByTimeAsync(7000);
    await promise;

    expect(mockGetSingleTxDetails).toHaveBeenCalledTimes(1);
    expect(mockIsOptimizationInProgress).toHaveBeenCalledTimes(2);
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  test('waits for Spark optimization to finish before resolving', async () => {
    mockGetSingleTxDetails.mockResolvedValue({
      status: 'TRANSFER_STATUS_COMPLETED',
    });
    mockGetSparkPaymentStatus.mockReturnValue('completed');
    mockIsOptimizationInProgress
      .mockResolvedValueOnce({ didWork: true, isOptimizing: true })
      .mockResolvedValueOnce({ didWork: true, isOptimizing: false })
      .mockResolvedValueOnce({ didWork: true, isOptimizing: false });

    let resolved = false;
    const promise = waitForSwapCompletion('mnemonic', 'spark-id-1').then(
      () => (resolved = true),
    );

    await jest.advanceTimersByTimeAsync(3000);
    expect(resolved).toBe(false);

    await jest.advanceTimersByTimeAsync(2000);
    await promise;

    expect(mockIsOptimizationInProgress).toHaveBeenCalledTimes(3);
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  test('restarts stabilization when the subscribed balance changes', async () => {
    mockGetSingleTxDetails.mockResolvedValue({
      status: 'TRANSFER_STATUS_COMPLETED',
    });
    mockGetSparkPaymentStatus.mockReturnValue('completed');

    let resolved = false;
    const promise = waitForSwapCompletion('mnemonic', 'spark-id-1').then(
      () => (resolved = true),
    );

    await jest.advanceTimersByTimeAsync(1600);
    expect(mockIsOptimizationInProgress).toHaveBeenCalledTimes(1);

    balanceUpdate({ didWork: true, balance: 2000 });
    await jest.advanceTimersByTimeAsync(1500);
    expect(resolved).toBe(false);
    expect(mockIsOptimizationInProgress).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(3000);
    await promise;

    expect(mockIsOptimizationInProgress).toHaveBeenCalledTimes(3);
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  test('times out instead of sending while optimization state is unknown', async () => {
    mockGetSingleTxDetails.mockResolvedValue({
      status: 'TRANSFER_STATUS_COMPLETED',
    });
    mockGetSparkPaymentStatus.mockReturnValue('completed');
    mockIsOptimizationInProgress.mockResolvedValue({ didWork: false });

    const promise = waitForSwapCompletion('mnemonic', 'spark-id-1').catch(
      e => e,
    );

    await jest.advanceTimersByTimeAsync(120000);
    const error = await promise;

    expect(error.message).toBe('Swap balance stabilization timeout');
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  test('caps polling and throws timeout when status stays perpetually pending', async () => {
    mockGetSparkPaymentStatus.mockReturnValue('pending');

    // .catch(e => e) surfaces the rejection as a value so it can be asserted
    // after the fake clock has run (also avoids an unhandled rejection)
    const promise = waitForSwapCompletion('mnemonic', 'spark-id-1').catch(
      e => e,
    );

    await jest.advanceTimersByTimeAsync(120000);

    const error = await promise;
    expect(error.message).toBe('Swap completion timeout');
    // Attempt cap holds even when the server never reports completion
    expect(mockGetSingleTxDetails).toHaveBeenCalledTimes(8);
  });

  test('backs off exponentially instead of polling at a fixed interval', async () => {
    mockGetSparkPaymentStatus.mockReturnValue('pending');

    const promise = waitForSwapCompletion('mnemonic', 'spark-id-1').catch(
      e => e,
    );

    // Polls land at t=0, 1500ms, 4500ms → 3 calls by 4.5s (fixed 1.5s
    // interval would already be at 4)
    await jest.advanceTimersByTimeAsync(4500);
    expect(mockGetSingleTxDetails).toHaveBeenCalledTimes(3);

    await jest.advanceTimersByTimeAsync(120000);
    await promise;
  });

  test('fails fast on a terminal failed status without burning the poll budget', async () => {
    mockGetSingleTxDetails.mockResolvedValue({
      status: 'TRANSFER_STATUS_RETURNED',
    });
    mockGetSparkPaymentStatus.mockReturnValue('failed');

    const promise = waitForSwapCompletion('mnemonic', 'spark-id-1').catch(
      e => e,
    );

    await jest.advanceTimersByTimeAsync(5000);

    const error = await promise;
    expect(error.message).toBe('Swap failed');
    expect(mockGetSingleTxDetails).toHaveBeenCalledTimes(1);
  });

  test('non-spark transfer id waits once without querying tx details', async () => {
    const promise = waitForSwapCompletion('mnemonic', 'not-a-spark-id');

    await jest.advanceTimersByTimeAsync(7000);
    await promise;

    expect(mockGetSingleTxDetails).not.toHaveBeenCalled();
  });
});
