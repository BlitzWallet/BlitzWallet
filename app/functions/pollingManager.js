import { getSparkBalance } from './spark';
import { fullRestoreSparkState } from './spark/restore';

/**
 * Generic polling utility with exponential backoff
 * @param {Object} config - Configuration object
 * @param {Function} config.pollFn - Async function to poll (receives delayIndex)
 * @param {Function} config.shouldContinue - Function that returns boolean to continue polling
 * @param {Function} config.onUpdate - Callback when poll succeeds with new data
 * @param {Array<number>} config.delays - Array of delay intervals in ms
 * @param {AbortController} config.abortController - Optional abort controller
 * @param {Function} config.validateResult - Function to validate if result should stop polling
 * @returns {Object} - Returns cleanup function and current state
 */
export const createPollingManager = ({
  pollFn,
  shouldContinue,
  onUpdate,
  delays = [1000, 2000, 5000, 15000],
  abortController,
  validateResult = () => true,
  initialBalance,
}) => {
  let timeoutRef = null;
  let previousResult = initialBalance || null;

  const cleanup = () => {
    if (timeoutRef) {
      clearTimeout(timeoutRef);
      timeoutRef = null;
    }
  };

  const poll = async (delayIndex = 0, resolve, reject) => {
    try {
      // Check abort conditions
      if (abortController?.signal?.aborted || !shouldContinue()) {
        console.log('Polling stopped:', {
          aborted: abortController?.signal?.aborted,
          shouldContinue: shouldContinue(),
        });
        cleanup();
        resolve({ success: false, reason: 'aborted' });
        return;
      }

      // Check if we've exhausted all delays
      if (delayIndex >= delays.length) {
        console.log('Polling completed after all retries');
        cleanup();
        resolve({
          success: false,
          reason: 'max_retries',
          result: previousResult,
        });
        return;
      }

      timeoutRef = setTimeout(async () => {
        let globalResult;
        try {
          // Re-check abort conditions before executing
          if (abortController?.signal?.aborted || !shouldContinue()) {
            cleanup();
            resolve({ success: false, reason: 'aborted' });
            return;
          }

          // Execute the poll function
          globalResult = await pollFn(delayIndex);

          // Validate if we should continue
          if (validateResult(globalResult, previousResult)) {
            // Call update callback
            if (onUpdate) {
              onUpdate(globalResult, delayIndex);
            }

            // Success - stop polling
            cleanup();
            resolve({ success: true, globalResult });
            return;
          }

          // Continue to next delay
          poll(delayIndex + 1, resolve, reject);
        } catch (err) {
          console.log('Error in polling iteration, continuing:', err);
          poll(delayIndex + 1, resolve, reject);
        } finally {
          if (
            globalResult != null &&
            (previousResult == null || globalResult !== previousResult)
          ) {
            // Only update if balance changes
            previousResult = globalResult;
          }
        }
      }, delays[delayIndex]);
    } catch (err) {
      console.log('Error in poll setup:', err);
      cleanup();
      reject(err);
    }
  };

  return {
    start: () => new Promise((resolve, reject) => poll(0, resolve, reject)),
    cleanup,
  };
};

export const createBalancePoller = (
  mnemonic,
  currentMnemonicRef,
  abortController,
  onBalanceUpdate,
  initialBalance,
) => {
  let hasIncreasedAtLeastOnce = false;
  let sameValueIndex = 0;
  return createPollingManager({
    pollFn: async () => {
      const balance = await getSparkBalance(mnemonic);
      return balance.didWork ? Number(balance.balance) : null;
    },
    shouldContinue: () => mnemonic === currentMnemonicRef.current,
    validateResult: (newBalance, previousBalance) => {
      console.log(
        newBalance,
        previousBalance,
        hasIncreasedAtLeastOnce,
        sameValueIndex,
      );

      if (newBalance == null || previousBalance == null) return false;

      if (newBalance !== previousBalance) {
        console.log('Balance changed — resetting');
        hasIncreasedAtLeastOnce = true;
        sameValueIndex = 0;
      }

      sameValueIndex++;

      if (
        (hasIncreasedAtLeastOnce && sameValueIndex >= 4) ||
        (!hasIncreasedAtLeastOnce && sameValueIndex >= 3)
      ) {
        return true;
      }

      return false;
    },
    onUpdate: (newBalance, delayIndex) => {
      console.log(
        `Balance updated to ${newBalance} after ${delayIndex} attempts`,
      );
      onBalanceUpdate(newBalance);
    },
    abortController,
    delays: [
      1000, 1500, 1500, 1500, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000,
      2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000,
    ],
    initialBalance,
  });
};

export const createRestorePoller = (
  mnemonic,
  isSendingPayment,
  currentMnemonicRef,
  abortController,
  onRestoreComplete,
  sparkInfo,
  sendWebViewRequest,
) => {
  return createPollingManager({
    pollFn: async delayIndex => {
      const result = await fullRestoreSparkState({
        sparkAddress: sparkInfo.sparkAddress,
        batchSize: 2,
        isSendingPayment: isSendingPayment,
        mnemonic,
        identityPubKey: sparkInfo.identityPubKey,
        sendWebViewRequest,
        isInitialRestore: false,
      });
      return result;
    },
    shouldContinue: () => mnemonic === currentMnemonicRef.current,
    validateResult: result => {
      return typeof result === 'number' && result > 0;
    },
    onUpdate: (result, delayIndex) => {
      console.log(
        `Restore completed after ${delayIndex + 1} attempts with ${result} txs`,
      );
      onRestoreComplete(result);
    },
    abortController,
    delays: [0, 2000, 5000],
  });
};
