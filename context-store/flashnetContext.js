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
} from '../app/functions/spark/flashnet';
import { useAppStatus } from './appStatus';
import { useSparkWallet } from './sparkContext';
import { useActiveCustodyAccount } from './activeAccount';
import {
  getSingleTxDetails,
  getSparkPaymentStatus,
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

const FlashnetContext = createContext(null);

export function FlashnetProvider({ children }) {
  const { showToast } = useToast();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { appState } = useAppStatus();
  const { sparkInformation, sparkInfoRef } = useSparkWallet();
  const [poolInfo, setPoolInfo] = useState({});
  const [swapLimits, setSwapLimits] = useState({ usd: 1, bitcoin: 1000 });
  const swapLimitsRef = useRef(swapLimits);
  const poolInfoRef = useRef({});
  const poolIntervalRef = useRef(null);
  const currentWalletMnemoincRef = useRef(currentWalletMnemoinc);

  const triggeredSwapsRef = useRef(new Set());

  const refundMonitorIntervalRef = useRef(null);
  const swapMonitorIntervalRef = useRef(null);
  const { authResetkey } = useAuthContext();

  const REFUND_MONITOR_INTERVAL = 25_000;
  const SWAP_MONITOR_INTERVAL = 30_000;

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
    if (!sparkInformation.didConnect) return;
    if (appState !== 'active') return;

    const result = await findBestPool(
      currentWalletMnemoincRef.current,
      BTC_ASSET_ADDRESS,
      USD_ASSET_ADDRESS,
    );

    if (result?.didWork && result.pool) {
      setPoolInfo(result.pool);
    }
  };

  const handleAutoSwap = async (sparkRequestID, retryCount = 0) => {
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
        setFlashnetTransfer(txDetails.id);
        await updateSparkTransactionDetails(lightningRequest.sparkID, {
          completedSwaptoUSD: true,
          swapExecuting: false,
        });

        console.log('Auto-swap completed successfully:', {
          amountOut: result.swap.amountOut,
          executionPrice: result.swap.executionPrice,
        });

        const realFeeAmount = Math.round(
          dollarsToSats(
            result.swap.feeAmount / Math.pow(10, 6),
            result.swap.executionPrice,
          ),
        );

        const userSwaps = await getUserSwapHistory(
          currentWalletMnemoincRef.current,
          5,
        );

        const swap = userSwaps.swaps.find(
          savedSwap =>
            savedSwap.outboundTransferId === result.swap.outboundTransferId,
        );

        const description = invoice
          ? decode(invoice).tags.find(tag => tag.tagName === 'description')
              ?.data ||
            lightningRequest?.description ||
            ''
          : lightningRequest?.description || '';

        // clear funding and ln payment from tx list
        setFlashnetTransfer(swap.inboundTransferId);

        const tx = {
          id: swap.outboundTransferId,
          paymentStatus: 'completed',
          paymentType: 'spark',
          accountId: sparkInfoRef.current.identityPubKey,
          details: {
            fee: realFeeAmount,
            totalFee: realFeeAmount,
            supportFee: 0,
            amount: parseFloat(result.swap.amountOut),
            description: description,
            address: sparkInfoRef.current.sparkAddress,
            time: Date.now() + 1000,
            createdAt: Date.now() + 1000,
            direction: 'INCOMING',
            isLRC20Payment: true,
            LRC20Token: USDB_TOKEN_ID,
            currentPriceAInB: poolInfoRef.current?.currentPriceAInB,
          },
        };
        bulkUpdateSparkTransactions([tx], 'fullUpdate-tokens');
      } else {
        console.error('Auto-swap failed:', result.error);

        // Mark as failed but not executing, so it can be retried
        await updateSparkTransactionDetails(sparkRequestID, {
          swapExecuting: false,
        });

        triggeredSwapsRef.current.delete(sparkRequestID);
      }
    } catch (error) {
      console.error('Error in auto-swap handler:', error);
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
      if (!sparkInformation.didConnect) return;
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

    runPendingSwapsMonitor(); // immediate pass

    swapMonitorIntervalRef.current = setInterval(
      runPendingSwapsMonitor,
      SWAP_MONITOR_INTERVAL,
    );
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
      if (!sparkInformation.didConnect) return;
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

    runRefundMonitor(); // immediate pass

    refundMonitorIntervalRef.current = setInterval(
      runRefundMonitor,
      REFUND_MONITOR_INTERVAL,
    );
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
      sparkInformation.didConnect &&
      poolInfo?.lpPublicKey
    ) {
      startPendingSwapsMonitor();
    } else {
      stopPendingSwapsMonitor();
    }

    return stopPendingSwapsMonitor;
  }, [appState, sparkInformation.didConnect, poolInfo?.lpPublicKey]);

  useEffect(() => {
    if (appState === 'active' && sparkInformation.didConnect) {
      startRefundMonitor();
    } else {
      stopRefundMonitor();
    }

    return stopRefundMonitor;
  }, [appState, sparkInformation.didConnect]);

  useEffect(() => {
    // Stop any existing interval first
    if (poolIntervalRef.current) {
      clearInterval(poolIntervalRef.current);
      poolIntervalRef.current = null;
    }

    // Only start polling when conditions are correct
    if (!sparkInformation.didConnect) return;
    if (appState !== 'active') return;

    // Run immediately on activation
    refreshPool();

    // Start interval
    poolIntervalRef.current = setInterval(() => {
      refreshPool();
    }, 30_000);

    return () => {
      if (poolIntervalRef.current) {
        clearInterval(poolIntervalRef.current);
        poolIntervalRef.current = null;
      }
    };
  }, [appState, sparkInformation.didConnect]);

  useEffect(() => {
    if (!sparkInformation.didConnect) return;
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
  }, [sparkInformation.didConnect]);

  const swapUSDPriceDollars = useMemo(() => {
    return (poolInfo?.currentPriceAInB * 100000000) / 1000000;
  }, [poolInfo?.currentPriceAInB]);

  useEffect(() => {
    stopRefundMonitor();
    stopPendingSwapsMonitor();
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
