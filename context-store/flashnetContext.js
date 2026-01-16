import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BTC_ASSET_ADDRESS,
  findBestPool,
  USD_ASSET_ADDRESS,
  swapBitcoinToToken,
  getUserSwapHistory,
  minFlashnetSwapAmounts,
  checkClawbackEligibility,
  requestManualClawback,
  dollarsToSats,
  currentPriceAinBToPriceDollars,
  addActiveSwap,
  removeActiveSwap,
  savePendingSwapConfirmation,
  completeSwapConfirmation,
  retryPendingSwapConfirmations,
} from '../app/functions/spark/flashnet';
import { useAppStatus } from './appStatus';
import { useSparkWallet } from './sparkContext';
import { useActiveCustodyAccount } from './activeAccount';
import {
  getSingleTxDetails,
  getSparkPaymentStatus,
  initializeFlashnet,
} from '../app/functions/spark';
import { USDB_TOKEN_ID } from '../app/constants';
import {
  bulkUpdateSparkTransactions,
  deleteUnpaidSparkLightningTransaction,
  flashnetAutoSwapsEventListener,
  getPendingAutoSwaps,
  getSingleSparkLightningRequest,
  HANDLE_FLASHNET_AUTO_SWAP,
  updateSparkTransactionDetails,
} from '../app/functions/spark/transactions';
import {
  isFlashnetTransfer,
  loadSavedTransferIds,
  setFlashnetTransfer,
} from '../app/functions/spark/handleFlashnetTransferIds';
import { useToast } from './toastManager';
import { decode } from 'bolt11';
import { useAuthContext } from './authContext';
import { listClawbackableTransfers } from '../app/functions/spark/flashnet';
import { getLocalStorageItem, setLocalStorageItem } from '../app/functions';

const FlashnetContext = createContext(null);

export function FlashnetProvider({ children }) {
  const { showToast } = useToast();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { appState } = useAppStatus();
  const { sparkInformation, sparkInfoRef, setSparkInformation } =
    useSparkWallet();
  const [poolInfo, setPoolInfo] = useState({});
  const [swapLimits, setSwapLimits] = useState({ usd: 1, bitcoin: 1000 });
  const swapLimitsRef = useRef(swapLimits);
  const poolInfoRef = useRef({});
  const poolIntervalRef = useRef(null);
  const currentWalletMnemoincRef = useRef(currentWalletMnemoinc);

  const triggeredSwapsRef = useRef(new Set());

  const refundMonitorIntervalRef = useRef(null);
  const swapMonitorIntervalRef = useRef(null);
  const retryTimeoutRef = useRef(null);

  const flashnetRetryIntervalRef = useRef(null);
  const flashnetRetryDelayRef = useRef(5_000);
  const { authResetkey } = useAuthContext();
  const authResetKeyRef = useRef(authResetkey);

  const REFUND_MONITOR_INTERVAL = 25_000;
  const SWAP_MONITOR_INTERVAL = 30_000;

  useEffect(() => {
    authResetKeyRef.current = authResetkey;
  }, [authResetkey]);

  useEffect(() => {
    currentWalletMnemoincRef.current = currentWalletMnemoinc;
  }, [currentWalletMnemoinc]);

  useEffect(() => {
    poolInfoRef.current = poolInfo;
  }, [poolInfo]);

  useEffect(() => {
    swapLimitsRef.current = swapLimits;
  }, [swapLimits]);

  const togglePoolInfo = poolInfo => {
    setPoolInfo(poolInfo);
  };

  const refreshPool = async () => {
    if (!sparkInformation.didConnectToFlashnet) return;
    if (appState !== 'active') return;

    const result = await findBestPool(
      currentWalletMnemoincRef.current,
      BTC_ASSET_ADDRESS,
      USD_ASSET_ADDRESS,
    );

    if (result?.didWork && result.pool) {
      setLocalStorageItem('swapPoolInfo', JSON.stringify(result.pool));
      setPoolInfo(result.pool);
    }
  };

  useEffect(() => {
    async function loadSavedPoolInfo() {
      const savedPoolInfo = JSON.parse(
        await getLocalStorageItem('swapPoolInfo'),
      );
      console.log('saved pool info', savedPoolInfo);
      if (savedPoolInfo) {
        setPoolInfo(savedPoolInfo);
      }
    }
    if (Object.keys(poolInfo).length) return;
    if (appState !== 'active') return;
    loadSavedPoolInfo();
  }, [appState]);

  useEffect(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    if (
      appState === 'active' &&
      sparkInformation.didConnectToFlashnet &&
      currentWalletMnemoincRef.current &&
      poolInfo?.lpPublicKey
    ) {
      // Delay to ensure everything is initialized
      const capturedAuthKey = authResetKeyRef.current;

      retryTimeoutRef.current = setTimeout(() => {
        // Check if auth has changed before executing
        if (capturedAuthKey !== authResetKeyRef.current) {
          console.log('[Flashnet] Auth changed, skipping retry confirmations');
          return;
        }

        retryPendingSwapConfirmations(
          currentWalletMnemoincRef.current,
          sparkInfoRef,
        );
      }, 3000);
    }

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [appState, sparkInformation.didConnectToFlashnet, poolInfo?.lpPublicKey]);

  const handleAutoSwap = async (sparkRequestID, retryCount = 0) => {
    let outboundTransferId;
    try {
      const MAX_RETRIES = 7;
      const RETRY_DELAY = 2000;
      console.log('Auto-swap triggered for sparkRequestID:', sparkRequestID);
      if (triggeredSwapsRef.current.has(sparkRequestID)) {
        console.warn(
          'Auto-swap already triggered for sparkRequestID:',
          sparkRequestID,
        );
        return;
      } else {
        triggeredSwapsRef.current.add(sparkRequestID);
      }

      await updateSparkTransactionDetails(sparkRequestID, {
        swapExecuting: true,
        lastSwapAttempt: Date.now(),
      });

      // Get the lightning request
      const lightningRequest = await getSingleSparkLightningRequest(
        sparkRequestID,
      );

      console.log(
        'found saved lightning requset invoice for',
        lightningRequest,
      );

      if (!lightningRequest) {
        console.error('Lightning request not found');
        triggeredSwapsRef.current.delete(sparkRequestID);
        await updateSparkTransactionDetails(sparkRequestID, {
          swapExecuting: false,
        });
        return;
      }

      // Check if we have the finalSparkID
      if (!lightningRequest.details?.finalSparkID) {
        console.error('No finalSparkID found in lightning request');
        triggeredSwapsRef.current.delete(sparkRequestID);
        await updateSparkTransactionDetails(sparkRequestID, {
          swapExecuting: false,
        });
        return;
      }

      // Get the transaction details
      const txDetails = await getSingleTxDetails(
        currentWalletMnemoincRef.current,
        lightningRequest.details.finalSparkID,
      );

      if (!txDetails) {
        console.error('Transaction details not found');
        triggeredSwapsRef.current.delete(sparkRequestID);
        await updateSparkTransactionDetails(sparkRequestID, {
          swapExecuting: false,
        });
        return;
      }

      const status = getSparkPaymentStatus(txDetails.status);

      // Check if payment is settled
      if (status !== 'completed') {
        console.log('Payment not yet settled, status:', status);

        // Retry logic
        if (retryCount < MAX_RETRIES) {
          setTimeout(() => {
            triggeredSwapsRef.current.delete(sparkRequestID);
            handleAutoSwap(sparkRequestID, retryCount + 1);
          }, RETRY_DELAY);
          return;
        } else {
          console.error('Max retries reached, payment still not settled');
          triggeredSwapsRef.current.delete(sparkRequestID);
          await updateSparkTransactionDetails(sparkRequestID, {
            swapExecuting: false,
          });
          return;
        }
      }

      const userRequest = txDetails.userRequest;
      const invoice = userRequest ? userRequest.invoice?.encodedInvoice : '';

      // Get the amount in sats
      const amountSats = txDetails.totalValue;

      if (
        !amountSats ||
        amountSats <= 0 ||
        amountSats < swapLimitsRef.current.bitcoin
      ) {
        console.error('Invalid amount for swap');
        triggeredSwapsRef.current.delete(sparkRequestID);
        deleteUnpaidSparkLightningTransaction(sparkRequestID);
        return;
      }

      // Check if we have pool info
      const currentPoolInfo = poolInfoRef.current;
      if (!currentPoolInfo || !currentPoolInfo.lpPublicKey) {
        console.error('Pool info not available');
        triggeredSwapsRef.current.delete(sparkRequestID);
        await updateSparkTransactionDetails(sparkRequestID, {
          swapExecuting: false,
        });
        return;
      }

      console.log('Executing auto-swap:', {
        amount: amountSats,
        poolId: currentPoolInfo.lpPublicKey,
      });

      // Execute the swap
      const result = await swapBitcoinToToken(
        currentWalletMnemoincRef.current,
        {
          tokenAddress: USD_ASSET_ADDRESS,
          amountSats: amountSats,
          poolId: currentPoolInfo.lpPublicKey,
        },
      );

      if (result.didWork && result.swap) {
        outboundTransferId = result.swap.outboundTransferId;
        addActiveSwap(result.swap.outboundTransferId);
        savePendingSwapConfirmation(sparkRequestID, outboundTransferId);
        await updateSparkTransactionDetails(lightningRequest.sparkID, {
          completedSwaptoUSD: true,
          swapExecuting: false,
        });

        console.log('Auto-swap completed successfully:', {
          amountOut: result.swap.amountOut,
          executionPrice: result.swap.executionPrice,
        });

        const success = await completeSwapConfirmation(
          sparkRequestID,
          outboundTransferId,
          lightningRequest,
          txDetails,
          result,
          invoice,
          currentWalletMnemoincRef.current,
          sparkInfoRef,
        );

        if (!success) {
          console.warn(
            '[Auto-swap] Confirmation failed, will retry on next load',
          );
        }
      } else {
        console.error('Auto-swap failed:', result.error);

        if (outboundTransferId) {
          removeActiveSwap(sparkRequestID);
        }

        // Mark as failed but not executing, so it can be retried
        await updateSparkTransactionDetails(sparkRequestID, {
          swapExecuting: false,
        });

        triggeredSwapsRef.current.delete(sparkRequestID);
      }
    } catch (error) {
      console.error('Error in auto-swap handler:', error);
      if (outboundTransferId) {
        removeActiveSwap(outboundTransferId);
      }
      // Mark as failed but not executing
      try {
        await updateSparkTransactionDetails(sparkRequestID, {
          swapExecuting: false,
        });
      } catch (updateError) {
        console.error('Failed to update swap status:', updateError);
      }

      triggeredSwapsRef.current.delete(sparkRequestID);
    }
  };

  // Monitor for stuck/failed swaps that need retry
  const runPendingSwapsMonitor = async () => {
    try {
      if (appState !== 'active') return;
      if (!sparkInformation.didConnectToFlashnet) return;
      if (!currentWalletMnemoincRef.current) return;
      if (!poolInfoRef.current?.lpPublicKey) return;

      console.log('[Pending Swaps Monitor] Checking for stuck swaps...');

      const pendingSwaps = await getPendingAutoSwaps();

      if (!pendingSwaps || pendingSwaps.length === 0) {
        return;
      }

      console.log(
        `[Pending Swaps Monitor] Found ${pendingSwaps.length} pending swap(s)`,
      );

      for (const swapRequest of pendingSwaps) {
        const sparkID = swapRequest.sparkID;
        const details = swapRequest.details || {};
        const finalSparkID = details.finalSparkID;

        // Skip if already in our triggered set (currently processing)
        if (triggeredSwapsRef.current.has(sparkID)) {
          console.log(
            `[Pending Swaps Monitor] Swap ${sparkID} already processing`,
          );
          continue;
        }

        // Handle payments already swapped but have not been removed from db yet
        if (details.completedSwaptoUSD || isFlashnetTransfer(finalSparkID)) {
          console.warn(
            `[Pending Swaps Monitor] Blocking already completed swaps`,
          );
          continue;
        }

        // Handle swaps marked as executing (potential orphaned state from app closure)
        if (details.swapExecuting) {
          const lastAttempt = details.lastSwapAttempt || 0;
          const timeSinceAttempt = Date.now() - lastAttempt;
          const EXECUTION_TIMEOUT = 2 * 60 * 1000; // 2 minutes

          console.log(
            `[Pending Swaps Monitor] Swap ${sparkID} marked as executing`,
          );

          if (isFlashnetTransfer(finalSparkID)) {
            console.log(
              `[Pending Swaps Monitor] Swap ${sparkID} was already completed, marking as such`,
            );
            await updateSparkTransactionDetails(sparkID, {
              completedSwaptoUSD: true,
              swapExecuting: false,
            });
            continue;
          }

          // If it's been executing for too long, it's orphaned - reset and retry
          if (timeSinceAttempt > EXECUTION_TIMEOUT) {
            console.log(
              `[Pending Swaps Monitor] Swap ${sparkID} execution timeout, resetting and retrying`,
            );
            await updateSparkTransactionDetails(sparkID, {
              swapExecuting: false,
            });
          } else {
            // Still within execution window, skip for now
            console.log(
              `[Pending Swaps Monitor] Swap ${sparkID} still within execution window`,
            );
            continue;
          }
        }

        console.log(`[Pending Swaps Monitor] Retrying swap ${sparkID}`);

        // Trigger the swap
        handleAutoSwap(sparkID);

        // Add delay between retries to avoid overwhelming the system
        await new Promise(res => setTimeout(res, 1000));
      }
    } catch (err) {
      console.error('[Pending Swaps Monitor] error:', err);
    }
  };

  const startPendingSwapsMonitor = () => {
    if (swapMonitorIntervalRef.current) return;

    const capturedAuthKey = authResetKeyRef.current;

    runPendingSwapsMonitor(); // immediate pass

    swapMonitorIntervalRef.current = setInterval(async () => {
      // Check if auth has changed
      if (capturedAuthKey !== authResetKeyRef.current) {
        console.log('[Pending Swaps Monitor] Auth changed, stopping monitor');
        stopPendingSwapsMonitor();
        return;
      }

      await runPendingSwapsMonitor();
    }, SWAP_MONITOR_INTERVAL);
  };

  const stopPendingSwapsMonitor = () => {
    if (!swapMonitorIntervalRef.current) return;

    clearInterval(swapMonitorIntervalRef.current);
    swapMonitorIntervalRef.current = null;
  };

  const runRefundMonitor = async () => {
    try {
      // Hard guards — never trust effects alone
      if (appState !== 'active') return;
      if (!sparkInformation.didConnectToFlashnet) return;
      if (!currentWalletMnemoincRef.current) return;

      const refundableTransfers = await listClawbackableTransfers(
        currentWalletMnemoincRef.current,
        50,
      );

      if (
        !refundableTransfers?.didWork ||
        !refundableTransfers.resposne?.transfers.length
      )
        return;

      const uniqueTransfers = Array.from(
        new Map(
          refundableTransfers.resposne.transfers.map(t => [t.id, t]),
        ).values(),
      );

      for (const transfer of uniqueTransfers) {
        const transferId = transfer.id;

        const eligibility = await checkClawbackEligibility(
          currentWalletMnemoincRef.current,
          transferId,
        );

        if (eligibility.didWork && eligibility.response) {
          console.warn('[Flashnet Refund Monitor] Refundable', transferId);

          const response = await requestManualClawback(
            currentWalletMnemoincRef.current,
            transferId,
            transfer.lpIdentityPublicKey,
          );

          if (response.didWork && response.accepted) {
            await new Promise(res => setTimeout(res, 500));
          }
        }
      }
    } catch (err) {
      console.error('[Flashnet Refund Monitor] error:', err);
    }
  };

  const startRefundMonitor = () => {
    if (refundMonitorIntervalRef.current) return;

    const capturedAuthKey = authResetKeyRef.current;

    refundMonitorIntervalRef.current = setInterval(async () => {
      // Check if auth has changed
      if (capturedAuthKey !== authResetKeyRef.current) {
        console.log('[Refund Monitor] Auth changed, stopping monitor');
        stopRefundMonitor();
        return;
      }

      await runRefundMonitor();
    }, REFUND_MONITOR_INTERVAL);
  };

  const stopRefundMonitor = () => {
    if (!refundMonitorIntervalRef.current) return;

    clearInterval(refundMonitorIntervalRef.current);
    refundMonitorIntervalRef.current = null;
  };

  // Set up the auto-swap event listener
  useEffect(() => {
    flashnetAutoSwapsEventListener.on(
      HANDLE_FLASHNET_AUTO_SWAP,
      handleAutoSwap,
    );

    loadSavedTransferIds();

    return () => {
      flashnetAutoSwapsEventListener.off(
        HANDLE_FLASHNET_AUTO_SWAP,
        handleAutoSwap,
      );
    };
  }, []);

  useEffect(() => {
    if (
      appState === 'active' &&
      sparkInformation.didConnectToFlashnet &&
      poolInfo?.lpPublicKey
    ) {
      startPendingSwapsMonitor();
    } else {
      stopPendingSwapsMonitor();
    }

    return stopPendingSwapsMonitor;
  }, [appState, sparkInformation.didConnectToFlashnet, poolInfo?.lpPublicKey]);

  useEffect(() => {
    let refundMonitorTimeout;
    if (appState === 'active' && sparkInformation.didConnectToFlashnet) {
      const capturedAuthKey = authResetKeyRef.current;

      refundMonitorTimeout = setTimeout(() => {
        // Check if auth has changed before executing
        if (capturedAuthKey !== authResetKeyRef.current) {
          console.log('[Refund Monitor] Auth changed, skipping initial run');
          return;
        }
        runRefundMonitor();
      }, 1500);

      startRefundMonitor();
    } else {
      stopRefundMonitor();
    }

    return () => {
      if (refundMonitorTimeout) {
        clearTimeout(refundMonitorTimeout);
      }
      stopRefundMonitor();
    };
  }, [appState, sparkInformation.didConnectToFlashnet]);

  useEffect(() => {
    const INITIAL_RETRY_DELAY = 5_000; // 5 seconds
    const MAX_RETRY_DELAY = 120_000; // 2 minutes

    const attemptFlashnetConnection = async () => {
      try {
        if (
          sparkInformation.didConnect === true &&
          sparkInformation.didConnectToFlashnet === false &&
          appState === 'active' &&
          currentWalletMnemoincRef.current
        ) {
          console.log(
            `[Flashnet Retry] Attempting to initialize Flashnet... (delay: ${flashnetRetryDelayRef.current}ms)`,
          );

          const result = await initializeFlashnet(
            currentWalletMnemoincRef.current,
          );

          if (result === true) {
            console.log('[Flashnet Retry] Successfully initialized Flashnet');
            setSparkInformation(prev => ({
              ...prev,
              didConnectToFlashnet: true,
            }));

            // Reset delay on success
            flashnetRetryDelayRef.current = INITIAL_RETRY_DELAY;

            if (flashnetRetryIntervalRef.current) {
              clearTimeout(flashnetRetryIntervalRef.current);
              flashnetRetryIntervalRef.current = null;
            }
          } else {
            console.warn(
              `[Flashnet Retry] Failed to initialize, will retry in ${
                flashnetRetryDelayRef.current / 1000
              }s...`,
            );

            // Schedule next retry with exponential backoff
            if (flashnetRetryIntervalRef.current) {
              clearTimeout(flashnetRetryIntervalRef.current);
            }

            const capturedAuthKey = authResetKeyRef.current;

            flashnetRetryIntervalRef.current = setTimeout(() => {
              // Check if auth has changed
              if (capturedAuthKey !== authResetKeyRef.current) {
                console.log('[Flashnet Retry] Auth changed, aborting retry');
                return;
              }
              attemptFlashnetConnection();
            }, flashnetRetryDelayRef.current);

            // Double the delay for next time, capped at MAX_RETRY_DELAY
            flashnetRetryDelayRef.current = Math.min(
              flashnetRetryDelayRef.current * 2,
              MAX_RETRY_DELAY,
            );
          }
        }
      } catch (error) {
        console.error('[Flashnet Retry] Error during initialization:', error);

        // Schedule retry on error as well
        if (flashnetRetryIntervalRef.current) {
          clearTimeout(flashnetRetryIntervalRef.current);
        }

        const capturedAuthKey = authResetKeyRef.current;

        flashnetRetryIntervalRef.current = setTimeout(() => {
          // Check if auth has changed
          if (capturedAuthKey !== authResetKeyRef.current) {
            console.log(
              '[Flashnet Retry] Auth changed, aborting retry after error',
            );
            return;
          }
          attemptFlashnetConnection();
        }, flashnetRetryDelayRef.current);

        flashnetRetryDelayRef.current = Math.min(
          flashnetRetryDelayRef.current * 2,
          MAX_RETRY_DELAY,
        );
      }
    };

    if (
      sparkInformation.didConnect === true &&
      sparkInformation.didConnectToFlashnet === false &&
      appState === 'active'
    ) {
      // Reset delay when starting fresh
      flashnetRetryDelayRef.current = INITIAL_RETRY_DELAY;

      // Immediate first attempt
      attemptFlashnetConnection();
    } else {
      // Clean up timeout if conditions no longer met
      if (flashnetRetryIntervalRef.current) {
        clearTimeout(flashnetRetryIntervalRef.current);
        flashnetRetryIntervalRef.current = null;
      }

      // Reset delay when stopping
      flashnetRetryDelayRef.current = INITIAL_RETRY_DELAY;
    }

    return () => {
      if (flashnetRetryIntervalRef.current) {
        clearTimeout(flashnetRetryIntervalRef.current);
        flashnetRetryIntervalRef.current = null;
      }
    };
  }, [
    sparkInformation.didConnect,
    sparkInformation.didConnectToFlashnet,
    appState,
  ]);

  useEffect(() => {
    // Stop any existing interval first
    if (poolIntervalRef.current) {
      clearInterval(poolIntervalRef.current);
      poolIntervalRef.current = null;
    }

    // Only start polling when conditions are correct
    if (!sparkInformation.didConnectToFlashnet) return;
    if (appState !== 'active') return;

    // Start interval
    const capturedAuthKey = authResetKeyRef.current;

    poolIntervalRef.current = setInterval(() => {
      // Check if auth has changed
      if (capturedAuthKey !== authResetKeyRef.current) {
        console.log('[Pool Refresh] Auth changed, stopping refresh');
        if (poolIntervalRef.current) {
          clearInterval(poolIntervalRef.current);
          poolIntervalRef.current = null;
        }
        return;
      }

      refreshPool();
    }, 30_000);

    // Run immediately on activation
    const refreshPoolTimeout = setTimeout(() => {
      // Check if auth has changed
      if (capturedAuthKey !== authResetKeyRef.current) {
        console.log('[Pool Refresh] Auth changed, skipping initial refresh');
        return;
      }
      refreshPool();
    }, 2000);

    return () => {
      if (refreshPoolTimeout) {
        clearTimeout(refreshPoolTimeout);
      }

      if (poolIntervalRef.current) {
        clearInterval(poolIntervalRef.current);
        poolIntervalRef.current = null;
      }
    };
  }, [appState, sparkInformation.didConnectToFlashnet]);

  useEffect(() => {
    if (!sparkInformation.didConnectToFlashnet) return;
    async function getLimits() {
      const [usdLimits, bitconLimits] = await Promise.all([
        minFlashnetSwapAmounts(
          currentWalletMnemoincRef.current,
          USD_ASSET_ADDRESS,
        ),
        minFlashnetSwapAmounts(
          currentWalletMnemoincRef.current,
          BTC_ASSET_ADDRESS,
        ),
      ]);
      if (usdLimits.didWork && bitconLimits.didWork) {
        setSwapLimits({
          usd: Number(usdLimits.assetData) / 1000000,
          bitcoin: Number(bitconLimits.assetData),
        });
      }
    }
    getLimits();
  }, [sparkInformation.didConnectToFlashnet]);

  const swapUSDPriceDollars = useMemo(() => {
    return currentPriceAinBToPriceDollars(poolInfo?.currentPriceAInB);
  }, [poolInfo?.currentPriceAInB]);

  // Clean up all intervals and timeouts when auth resets
  useEffect(() => {
    console.log('[Flashnet] Auth reset detected, cleaning up all processes');

    stopRefundMonitor();
    stopPendingSwapsMonitor();

    if (poolIntervalRef.current) {
      clearInterval(poolIntervalRef.current);
      poolIntervalRef.current = null;
    }

    if (flashnetRetryIntervalRef.current) {
      clearTimeout(flashnetRetryIntervalRef.current);
      flashnetRetryIntervalRef.current = null;
    }

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    // Clear triggered swaps set
    triggeredSwapsRef.current.clear();

    // Reset retry delay
    flashnetRetryDelayRef.current = 5_000;
  }, [authResetkey]);

  const contextValue = useMemo(() => {
    return {
      poolInfo,
      togglePoolInfo,
      poolInfoRef: poolInfoRef.current,
      swapLimits,
      swapUSDPriceDollars,
    };
  }, [poolInfo, togglePoolInfo, swapLimits, swapUSDPriceDollars]);

  return (
    <FlashnetContext.Provider value={contextValue}>
      {children}
    </FlashnetContext.Provider>
  );
}

export const useFlashnet = () => useContext(FlashnetContext);
