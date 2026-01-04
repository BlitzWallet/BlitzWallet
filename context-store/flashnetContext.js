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
} from '../app/functions/spark/flashnet';
import { useAppStatus } from './appStatus';
import { useSparkWallet } from './sparkContext';
import { useActiveCustodyAccount } from './activeAccount';
import { useNodeContext } from './nodeContext';
import {
  getSingleTxDetails,
  getSparkPaymentStatus,
} from '../app/functions/spark';
import { USDB_TOKEN_ID } from '../app/constants';
import {
  bulkUpdateSparkTransactions,
  flashnetAutoSwapsEventListener,
  getSingleSparkLightningRequest,
  HANDLE_FLASHNET_AUTO_SWAP,
  updateSparkTransactionDetails,
} from '../app/functions/spark/transactions';
import {
  loadSavedTransferIds,
  setFlashnetTransfer,
} from '../app/functions/spark/handleFlashnetTransferIds';
import { useToast } from './toastManager';
import { decode } from 'bolt11';

const FlashnetContext = createContext(null);

// Need to add function that checks to see if we had any swaps that did not complete and therefore we should rety thenm
export function FlashnetProvider({ children }) {
  const { showToast } = useToast();
  const { SATS_PER_DOLLAR } = useNodeContext();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { appState } = useAppStatus();
  const { sparkInformation, sparkInfoRef } = useSparkWallet();
  const [poolInfo, setPoolInfo] = useState({});
  const [swapLimits, setSwapLimits] = useState({ usd: 1, btc: 1000 });
  const poolInfoRef = useRef({});
  const poolIntervalRef = useRef(null);
  const currentWalletMnemoincRef = useRef(currentWalletMnemoinc);
  const flatnet_sats_per_dollar_ref = useRef(0);

  const flatnet_sats_per_dollar = poolInfo?.currentPriceAInB || SATS_PER_DOLLAR;

  useEffect(() => {
    currentWalletMnemoincRef.current = currentWalletMnemoinc;
  }, [currentWalletMnemoinc]);

  useEffect(() => {
    poolInfoRef.current = poolInfo;
  }, [poolInfo]);

  useEffect(() => {
    flatnet_sats_per_dollar_ref.current = flatnet_sats_per_dollar;
  }, [flatnet_sats_per_dollar]);

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
        return;
      }

      // Check if we have the finalSparkID
      if (!lightningRequest.details?.finalSparkID) {
        console.error('No finalSparkID found in lightning request');
        return;
      }

      // Get the transaction details
      const txDetails = await getSingleTxDetails(
        currentWalletMnemoincRef.current,
        lightningRequest.details.finalSparkID,
      );

      if (!txDetails) {
        console.error('Transaction details not found');
        return;
      }

      const status = getSparkPaymentStatus(txDetails.status);

      // Check if payment is settled
      if (status !== 'completed') {
        console.log('Payment not yet settled, status:', status);

        // Retry logic
        if (retryCount < MAX_RETRIES) {
          setTimeout(() => {
            handleAutoSwap(sparkRequestID, retryCount + 1);
          }, RETRY_DELAY);
          return;
        } else {
          console.error('Max retries reached, payment still not settled');
          return;
        }
      }

      const userRequest = txDetails.userRequest;
      const invoice = userRequest ? userRequest.invoice?.encodedInvoice : '';

      // Get the amount in sats
      const amountSats = txDetails.totalValue;

      if (!amountSats || amountSats <= 0) {
        console.error('Invalid amount for swap');
        return;
      }

      // Check if we have pool info
      const currentPoolInfo = poolInfoRef.current;
      if (!currentPoolInfo) {
        console.error('Pool info not available');
        return;
      }

      // showToast({
      //   duration: 7000,
      //   type: 'handleSwap',
      // });

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
        updateSparkTransactionDetails(lightningRequest.sparkID, {
          completedSwaptoUSD: true,
        });
        console.log('Auto-swap completed successfully:', {
          amountOut: result.swap.amountOut,
          executionPrice: result.swap.executionPrice,
        });

        const realFeeAmount = Math.round(
          (parseFloat(result.swap.feeAmount) / Math.pow(10, 6)) *
            flatnet_sats_per_dollar_ref.current,
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
        setFlashnetTransfer(txDetails.id);

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
      }
    } catch (error) {
      console.error('Error in auto-swap handler:', error);
    }
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

  const contextValue = useMemo(() => {
    return {
      poolInfo,
      togglePoolInfo,
      poolInfoRef: poolInfoRef.current,
      flatnet_sats_per_dollar,
      swapLimits,
      swapUSDPriceDollars,
    };
  }, [
    poolInfo,
    togglePoolInfo,
    flatnet_sats_per_dollar,
    swapLimits,
    swapUSDPriceDollars,
  ]);

  return (
    <FlashnetContext.Provider value={contextValue}>
      {children}
    </FlashnetContext.Provider>
  );
}

export const useFlashnet = () => useContext(FlashnetContext);
