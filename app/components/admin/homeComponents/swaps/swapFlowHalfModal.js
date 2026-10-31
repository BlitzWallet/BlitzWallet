import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import {
  APPROXIMATE_SYMBOL,
  CENTER,
  SIZES,
  USDB_TOKEN_ID,
} from '../../../../constants';
import { INSET_WINDOW_WIDTH } from '../../../../constants/theme';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import {
  isSendingPayingEventEmiiter,
  SENDING_PAYMENT_EVENT_NAME,
  useSparkWallet,
} from '../../../../../context-store/sparkContext';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import {
  findBestPool,
  simulateSwap,
  swapBitcoinToToken,
  swapTokenToBitcoin,
  handleFlashnetError,
  BTC_ASSET_ADDRESS,
  USD_ASSET_ADDRESS,
  getUserSwapHistory,
  satsToDollars,
  dollarsToSats,
  INTEGRATOR_FEE,
} from '../../../../functions/spark/flashnet';
import { useActiveCustodyAccount } from '../../../../../context-store/activeAccount';
import useDebounce from '../../../../hooks/useDebounce';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { bulkUpdateSparkTransactions } from '../../../../functions/spark/transactions';
import { formatBalanceAmount } from '../../../../functions';
import customUUID from '../../../../functions/customUUID';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import { useUserBalanceContext } from '../../../../../context-store/userBalanceContext';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import AnimatedStep, {
  growThenStep,
  useStepSheetHeight,
} from '../../../../functions/CustomElements/redesign/AnimatedStep';
import SwapChooseCurrency from './SwapChooseCurrency';
import SwapHistory from './SwapHistory';
import SwapAmount from './SwapAmount';
import SwapReview from './SwapReview';
import SwapSuccess from './SwapSuccess';

// Sheet heights from Swap.dc.html. History keeps one height while it loads
// (a resize during a step slide-in leaves its buttons dead on iOS).
const STEP_HEIGHTS = {
  routeSelection: 480,
  historyExpanded: 600,
  amountInput: 790,
  review: 640,
  confirmation: 520,
};

export default function SwapFlowHalfModal({
  initialFromAsset,
  setContentHeight,
  handleBackPressFunction,
}) {
  const navigate = useNavigation();
  const {
    poolInfo: globalPoolInfo,
    togglePoolInfo,
    swapUSDPriceDollars,
    swapLimits,
  } = useFlashnet();
  const { dollarBalanceToken, bitcoinBalance } = useUserBalanceContext();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { sparkInformation } = useSparkWallet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { t } = useTranslation();
  const { height: windowHeight } = useWindowDimensions();

  // Step state
  const [currentStep, setCurrentStep] = useState('routeSelection');
  const [stepDirection, setStepDirection] = useState(1);

  // Swap state (migrated from SwapsPage verbatim)
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [fromAsset, setFromAsset] = useState(initialFromAsset || 'BTC');
  const [toAsset, setToAsset] = useState(
    initialFromAsset === 'USD' ? 'BTC' : 'USD',
  );
  const [isSimulating, setIsSimulating] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [isLoadingPool, setIsLoadingPool] = useState(true);
  const [poolInfo, setPoolInfo] = useState(null);
  const [simulationResult, setSimulationResult] = useState(null);
  const [error, setError] = useState(null);
  const [priceImpact, setPriceImpact] = useState(null);
  const [confirmedSwap, setConfirmedSwap] = useState(null);
  const [lastEditedField, setLastEditedField] = useState('from');
  const [slippagePercent, setSlippagePercent] = useState('');
  const [activePercentage, setActivePercentage] = useState(null);
  const currentRequetId = useRef(null);
  const lastSimulatedAmount = useRef(null);
  const isPillPressRef = useRef(false);
  const isSwappingRef = useRef(false);

  // The amount sheet is taller than a small phone.
  const heightFor = useCallback(
    step =>
      step === 'amountInput'
        ? Math.min(STEP_HEIGHTS.amountInput, windowHeight - 60)
        : STEP_HEIGHTS[step],
    [windowHeight],
  );
  useStepSheetHeight(setContentHeight, heightFor(currentStep));

  // Navigate between steps with slide direction. The direction lands one
  // render before the step changes so the outgoing step exits the right way.
  const navigateToStep = useCallback(
    (newStep, dir = 'forward') => {
      setStepDirection(dir === 'forward' ? 1 : -1);
      growThenStep(
        setContentHeight,
        heightFor(currentStep),
        heightFor(newStep),
        () => setTimeout(() => setCurrentStep(newStep), 0),
      );
    },
    [currentStep, heightFor, setContentHeight],
  );

  // A balance page opens at Amount once the pool is ready; under that side's
  // minimum it stays on Choose currency.
  const didAutoOpenAmount = useRef(!initialFromAsset);
  useEffect(() => {
    if (didAutoOpenAmount.current || isLoadingPool || !poolInfo) return;
    didAutoOpenAmount.current = true;
    const isAboveMinimum =
      initialFromAsset === 'BTC'
        ? bitcoinBalance >= swapLimits.bitcoin
        : dollarBalanceToken >= swapLimits.usd;
    if (isAboveMinimum) navigateToStep('amountInput', 'forward');
  }, [isLoadingPool, poolInfo]);

  // Mirror of currentStep readable inside async handlers, so a swap/simulation
  // that resolves after the user has navigated away doesn't force a step change.
  const currentStepRef = useRef(currentStep);
  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  // Android hardware back press — intercepts step-level navigation
  const handleBackPressAndroid = useCallback(() => {
    if (isSwappingRef.current) return true;
    if (currentStep === 'historyExpanded') {
      navigateToStep('routeSelection', 'backward');
      return true;
    }
    if (currentStep === 'amountInput') {
      navigateToStep('routeSelection', 'backward');
      return true;
    }
    if (currentStep === 'review') {
      navigateToStep('amountInput', 'backward');
      return true;
    }
    return false;
  }, [currentStep, navigateToStep]);
  useHandleBackPressNew(handleBackPressAndroid);

  // Derived state
  const tokenInformation = sparkInformation?.tokens?.[USDB_TOKEN_ID];
  const btcBalance = sparkInformation?.balance || 0;
  const displayBalance =
    fromAsset === 'BTC'
      ? displayCorrectDenomination({
          amount: btcBalance,
          masterInfoObject: {
            ...masterInfoObject,
            userBalanceDenomination: 'sats',
          },
          fiatStats,
        })
      : displayCorrectDenomination({
          amount: formatBalanceAmount(
            dollarBalanceToken,
            false,
            masterInfoObject,
          ),
          masterInfoObject: {
            ...masterInfoObject,
            userBalanceDenomination: 'fiat',
          },
          fiatStats,
          forceCurrency: 'USD',
          convertAmount: false,
        });

  const hasEnoughBalance =
    (fromAsset === 'BTC' && Number(fromAmount) <= Number(bitcoinBalance)) ||
    (fromAsset === 'USD' && Number(fromAmount) <= Number(dollarBalanceToken));

  const canSwap =
    fromAmount &&
    parseFloat(fromAmount) > 0 &&
    toAmount &&
    parseFloat(toAmount) > 0 &&
    !isSimulating &&
    !isSwapping &&
    !isLoadingPool &&
    poolInfo &&
    (!error ||
      error.includes(t('screens.inAccount.swapsPage.checkSwapMessage'))) &&
    hasEnoughBalance;

  const canProceed =
    !fromAmount ||
    isSimulating ||
    (!!poolInfo &&
      parseFloat(fromAmount) > 0 &&
      !(fromAsset === 'BTC' && Number(fromAmount) < swapLimits.bitcoin) &&
      !(fromAsset === 'USD' && Number(fromAmount) < swapLimits.usd) &&
      hasEnoughBalance &&
      !!simulationResult &&
      Object.keys(simulationResult).length > 0 &&
      !isSwapping);

  // ── Pool loading ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!sparkInformation.didConnectToFlashnet) return;
    if (Object.keys(globalPoolInfo).length) {
      setPoolInfo(globalPoolInfo);
      setIsLoadingPool(false);
    } else {
      loadPoolInfo();
    }
  }, [sparkInformation.didConnectToFlashnet]);

  const clearPageStates = () => {
    setFromAmount('');
    setToAmount('');
    setSimulationResult(null);
    setPriceImpact(null);
    setError(null);
    setLastEditedField('from');
    setConfirmedSwap(null);
  };

  const loadPoolInfo = async () => {
    setIsLoadingPool(true);
    setError(null);
    try {
      const result = await findBestPool(
        currentWalletMnemoinc,
        BTC_ASSET_ADDRESS,
        USD_ASSET_ADDRESS,
      );
      if (result.didWork && result.pool) {
        setPoolInfo(result.pool);
        togglePoolInfo(result.pool);
        console.log('✓ Found BTC/USDB pool:', {
          poolId: result.pool.lpPublicKey,
          tvl: result.pool.tvlAssetB,
          volume24h: result.pool.volume24hAssetB,
        });
      } else {
        navigate.navigate('ErrorScreen', {
          errorMessage: t('screens.inAccount.swapsPage.noPoolFoundBackup'),
        });
      }
    } catch (err) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('screens.inAccount.swapsPage.loadPoolError'),
      });
      console.warn('Load pool info error:', err);
    } finally {
      setIsLoadingPool(false);
    }
  };

  // ── Simulation (migrated verbatim from SwapsPage) ────────────────────────────

  useEffect(() => {
    const uuid = customUUID();
    currentRequetId.current = uuid;
    if (lastEditedField === 'from') {
      if (
        fromAmount.length &&
        !isNaN(fromAmount) &&
        parseFloat(fromAmount) > 0
      ) {
        if (lastSimulatedAmount.current === fromAmount && !!toAmount.length)
          return;
        lastSimulatedAmount.current = fromAmount;
        setIsSimulating(true);
        setError(null);
        simulateSwapAmount(fromAmount, 'from', uuid);
      } else {
        setToAmount('');
        setSimulationResult(null);
        setPriceImpact(null);
        setError('');
        setIsSimulating(false);
      }
    } else if (lastEditedField === 'to') {
      if (toAmount.length && !isNaN(toAmount) && parseFloat(toAmount) > 0) {
        if (lastSimulatedAmount.current === toAmount && fromAmount) return;
        lastSimulatedAmount.current = toAmount;
        setIsSimulating(true);
        setError(null);
        simulateSwapAmount(toAmount, 'to', uuid);
      } else {
        setFromAmount('');
        setSimulationResult(null);
        setPriceImpact(null);
        setError('');
        setIsSimulating(false);
      }
    }
  }, [fromAmount, toAmount, fromAsset, toAsset, poolInfo, lastEditedField]);

  const simulateSwapAmount = useDebounce(async (amount, direction, uuid) => {
    if (!poolInfo) return;
    if (uuid !== currentRequetId.current) {
      console.log('New request created, blocking...');
      return;
    }
    if (!amount) {
      setError('');
      return;
    }

    try {
      const isBtcToUsdb = fromAsset === 'BTC';
      const decimals = tokenInformation?.tokenMetadata?.decimals || 6;
      const isForwardDirection = direction === 'from';

      let amountInSmallestUnits;
      let assetInAddress;
      let assetOutAddress;

      if (isForwardDirection) {
        amountInSmallestUnits = isBtcToUsdb
          ? Math.floor(parseFloat(amount))
          : Math.floor(parseFloat(amount) * Math.pow(10, decimals));
        assetInAddress = isBtcToUsdb ? BTC_ASSET_ADDRESS : USD_ASSET_ADDRESS;
        assetOutAddress = isBtcToUsdb ? USD_ASSET_ADDRESS : BTC_ASSET_ADDRESS;
      } else {
        amountInSmallestUnits = isBtcToUsdb
          ? Math.floor(parseFloat(amount) * Math.pow(10, decimals))
          : Math.floor(parseFloat(amount));
        assetInAddress = isBtcToUsdb ? USD_ASSET_ADDRESS : BTC_ASSET_ADDRESS;
        assetOutAddress = isBtcToUsdb ? BTC_ASSET_ADDRESS : USD_ASSET_ADDRESS;
      }

      const result = await simulateSwap(currentWalletMnemoinc, {
        poolId: poolInfo.lpPublicKey,
        assetInAddress,
        assetOutAddress,
        amountIn: amountInSmallestUnits,
      });

      if (uuid !== currentRequetId.current) {
        console.log('New request created, blocking...');
        return;
      }

      if (result.didWork && result.simulation) {
        setSimulationResult(result.simulation);
        setPriceImpact(parseFloat(result.simulation.priceImpact));

        let outputAmount;
        if (isForwardDirection) {
          outputAmount = isBtcToUsdb
            ? (
                parseFloat(result.simulation.expectedOutput) /
                Math.pow(10, decimals)
              ).toFixed(2)
            : parseFloat(result.simulation.expectedOutput).toFixed(0);
          setToAmount(outputAmount);
        } else {
          outputAmount = isBtcToUsdb
            ? parseFloat(result.simulation.expectedOutput).toFixed(0)
            : (
                parseFloat(result.simulation.expectedOutput) /
                Math.pow(10, decimals)
              ).toFixed(2);
          setFromAmount(outputAmount);
        }

        if (parseFloat(result.simulation.priceImpact) > 3) {
          navigate.navigate('ErrorScreen', {
            errorMessage: t('screens.inAccount.swapsPage.highPriceImpact', {
              priceImpact: result.simulation.priceImpact,
            }),
          });
        }
      } else {
        const errorInfo = handleFlashnetError({
          ...result.details,
          error: result.error,
        });
        setError(true);
        if (isForwardDirection) {
          setToAmount('0');
        } else {
          setFromAmount('0');
        }
      }
    } catch (err) {
      console.warn('Simulate swap error:', err);
      setError(true);
      if (direction === 'from') {
        setToAmount('0');
      } else {
        setFromAmount('0');
      }
    } finally {
      setIsSimulating(false);
    }
  }, 500);

  // ── Handlers (migrated verbatim from SwapsPage) ──────────────────────────────

  const handleSwapAssets = () => {
    setFromAsset(toAsset);
    setToAsset(fromAsset);
    setFromAmount('');
    setToAmount('');
    setLastEditedField('from');
    currentRequetId.current = null;
    setSimulationResult(null);
    setPriceImpact(null);
    setError(null);
  };

  // Step 1 currency selection — sets fromAsset, auto-sets toAsset, clears amounts
  const handleSelectFromAsset = newFrom => {
    if (fromAsset === newFrom) return;

    setFromAsset(newFrom);
    setToAsset(newFrom === 'BTC' ? 'USD' : 'BTC');
    setFromAmount('');
    setToAmount('');
    setSimulationResult(null);
    setActivePercentage(null);
  };

  const handleFromAmountChange = (value, direction) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      if (!isPillPressRef.current) {
        setActivePercentage(null);
      }
      isPillPressRef.current = false;
      if (direction === 'from') {
        setFromAmount(value);
        setLastEditedField('from');
      } else {
        setToAmount(value);
        setLastEditedField('to');
      }
    }
  };

  const setPercentage = percent => {
    const balance = fromAsset === 'BTC' ? btcBalance : dollarBalanceToken;
    const decimals = fromAsset === 'BTC' ? 0 : 2;
    const multiplier = Math.pow(10, decimals);
    const amount = (Math.floor(balance * percent * multiplier) / multiplier)
      .toFixed(decimals)
      .toString();
    setFromAmount(amount);
    setLastEditedField('from');
  };

  const handleInputPress = direction => {
    setLastEditedField(direction);
  };

  const handleKeyboardInput = value => {
    if (lastEditedField === 'from') {
      handleFromAmountChange(value, 'from');
    } else {
      handleFromAmountChange(value, 'to');
    }
  };

  const executeSwapAction = async () => {
    if (!fromAmount) {
      navigateToStep('routeSelection', 'backward');
      return;
    }
    if (!poolInfo || !fromAmount || parseFloat(fromAmount) <= 0) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('screens.inAccount.swapsPage.invalidAmount'),
      });
      return;
    }

    if (fromAsset === 'BTC' && fromAmount < swapLimits.bitcoin) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('screens.inAccount.swapsPage.minBTCError', {
          min: displayCorrectDenomination({
            amount: swapLimits.bitcoin,
            masterInfoObject: {
              ...masterInfoObject,
              userBalanceDenomination: 'sats',
            },
            fiatStats,
          }),
        }),
      });
      return;
    }

    if (fromAsset === 'USD' && fromAmount < swapLimits.usd) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('screens.inAccount.swapsPage.minUSDError', {
          min: displayCorrectDenomination({
            amount: swapLimits.usd,
            masterInfoObject: {
              ...masterInfoObject,
              userBalanceDenomination: 'fiat',
            },
            fiatStats,
            forceCurrency: 'USD',
            convertAmount: false,
          }),
        }),
      });
      return;
    }

    if (isSimulating) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('screens.inAccount.swapsPage.simulationInProgress'),
      });
      return;
    }

    if (!hasEnoughBalance) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('screens.inAccount.swapsPage.insufficientBalance'),
      });
      return;
    }

    if (!simulationResult || !Object.keys(simulationResult).length) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('screens.inAccount.swapsPage.simulationError'),
      });
      return;
    }

    if (isSwapping) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('screens.inAccount.swapsPage.swapInProgressError'),
      });
      return;
    }

    if (lastEditedField === 'to') {
      setIsSimulating(true);
      setError(null);

      try {
        const isBtcToUsdb = fromAsset === 'BTC';
        const decimals = tokenInformation?.tokenMetadata?.decimals || 6;

        const amountInSmallestUnits = isBtcToUsdb
          ? Math.floor(parseFloat(fromAmount))
          : Math.floor(parseFloat(fromAmount) * Math.pow(10, decimals));

        const assetInAddress = isBtcToUsdb
          ? BTC_ASSET_ADDRESS
          : USD_ASSET_ADDRESS;
        const assetOutAddress = isBtcToUsdb
          ? USD_ASSET_ADDRESS
          : BTC_ASSET_ADDRESS;

        const uuid = customUUID();
        currentRequetId.current = uuid;

        const result = await simulateSwap(currentWalletMnemoinc, {
          poolId: poolInfo.lpPublicKey,
          assetInAddress,
          assetOutAddress,
          amountIn: amountInSmallestUnits,
        });

        if (uuid !== currentRequetId.current) {
          console.log('New request created during re-simulation, blocking...');
          setIsSimulating(false);
          return;
        }

        if (result.didWork && result.simulation) {
          setSimulationResult(result.simulation);
          setPriceImpact(parseFloat(result.simulation.priceImpact));

          const outputAmount = isBtcToUsdb
            ? (
                parseFloat(result.simulation.expectedOutput) /
                Math.pow(10, decimals)
              ).toFixed(2)
            : parseFloat(result.simulation.expectedOutput).toFixed(0);

          lastSimulatedAmount.current = fromAmount;
          setLastEditedField('from');
          setToAmount(outputAmount);

          if (parseFloat(result.simulation.priceImpact) > 3) {
            navigate.navigate('ErrorScreen', {
              errorMessage: t('screens.inAccount.swapsPage.highPriceImpact', {
                priceImpact: result.simulation.priceImpact,
              }),
            });
            setIsSimulating(false);
            return;
          }

          setIsSimulating(false);

          if (currentStepRef.current !== 'amountInput') return;
          navigateToStep('review', 'forward');
        } else {
          const errorInfo = handleFlashnetError({
            ...result.details,
            error: result.error,
          });
          setError(true);
          setIsSimulating(false);
          navigate.navigate('ErrorScreen', {
            errorMessage: errorInfo.userMessage || result.error,
          });
        }
      } catch (err) {
        console.warn('Re-simulate swap error:', err);
        setError(true);
        setIsSimulating(false);
        navigate.navigate('ErrorScreen', {
          errorMessage: t('screens.inAccount.swapsPage.simulationError'),
        });
      }
    } else {
      navigateToStep('review', 'forward');
    }
  };

  const handleAcceptReview = () => {
    const showConfirmScreen = priceImpact > 5;
    if (!showConfirmScreen) {
      performSwap();
      return;
    }
    navigate.navigate('ConfirmActionPage', {
      confirmMessage: t('screens.inAccount.swapsPage.priceImpact', {
        impact: priceImpact?.toFixed(2) || 'N/A',
      }),
      confirmFunction: () => performSwap(),
    });
  };

  const handleDropdownToggle = value => {
    setSlippagePercent(value.value);
  };

  const performSwap = async () => {
    if (isSwappingRef.current) return;

    const hasBalance =
      (fromAsset === 'BTC' && Number(fromAmount) <= Number(bitcoinBalance)) ||
      (fromAsset === 'USD' && Number(fromAmount) <= Number(dollarBalanceToken));
    if (!hasBalance) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('screens.inAccount.swapsPage.insufficientBalance'),
      });
      return;
    }

    isSwappingRef.current = true;
    setIsSwapping(true);
    setError(null);
    // A swap moves funds like a send: hold the sats side until the swap's own
    // tx write lands sats and USD together (no half-swapped total).
    isSendingPayingEventEmiiter.emit(SENDING_PAYMENT_EVENT_NAME, true);

    try {
      const isBtcToUsdb = fromAsset === 'BTC';
      const decimals = tokenInformation?.tokenMetadata?.decimals || 6;

      const amountInSmallestUnits = isBtcToUsdb
        ? Math.floor(parseFloat(fromAmount))
        : Math.floor(parseFloat(fromAmount) * Math.pow(10, decimals));

      const result = isBtcToUsdb
        ? await swapBitcoinToToken(currentWalletMnemoinc, {
            tokenAddress: USD_ASSET_ADDRESS,
            amountSats: amountInSmallestUnits,
            poolId: poolInfo.lpPublicKey,
            maxSlippageBps: (slippagePercent || 5) * 100,
          })
        : await swapTokenToBitcoin(currentWalletMnemoinc, {
            tokenAddress: USD_ASSET_ADDRESS,
            tokenAmount: amountInSmallestUnits,
            poolId: poolInfo.lpPublicKey,
            maxSlippageBps: (slippagePercent || 5) * 100,
          });

      console.log('Execute swap response', result);

      if (result.didWork && result.swap) {
        const realReceivedAmount = isBtcToUsdb
          ? dollarsToSats(
              result.swap.amountOut / Math.pow(10, decimals),
              result.swap.executionPrice,
            )
          : parseFloat(result.swap.amountOut).toFixed(0);
        const realFeeAmount = Math.round(
          dollarsToSats(
            parseFloat(result.swap.feeAmount) / Math.pow(10, decimals),
            result.swap.executionPrice,
          ),
        );

        setConfirmedSwap({ ...result.swap, realReceivedAmount, realFeeAmount });

        if (currentStepRef.current === 'review') {
          navigateToStep('confirmation', 'forward');
        }

        const userSwaps = await getUserSwapHistory(currentWalletMnemoinc, 5);
        const swap = userSwaps.swaps.find(
          savedSwap =>
            savedSwap.outboundTransferId === result.swap.outboundTransferId,
        );

        let incomingTransfer, outgoingTransfer;

        if (swap) {
          if (isBtcToUsdb) {
            incomingTransfer = {
              id: swap.outboundTransferId,
              paymentStatus: 'completed',
              paymentType: 'spark',
              accountId: sparkInformation.identityPubKey,
              details: {
                fee: realFeeAmount,
                totalFee: realFeeAmount,
                supportFee: 0,
                amount: parseFloat(result.swap.amountOut),
                description: t(
                  'screens.inAccount.swapsPage.paymentDescription_incoming',
                  {
                    swapDirection: t(
                      'screens.inAccount.swapsPage.swapDirection_btcusd',
                    ),
                  },
                ),
                address: sparkInformation.sparkAddress,
                time: Date.now(),
                createdAt: Date.now(),
                direction: 'INCOMING',
                isLRC20Payment: true,
                LRC20Token: USDB_TOKEN_ID,
                showSwapLabel: true,
                currentPriceAInB: result.swap.executionPrice,
              },
            };
            outgoingTransfer = {
              id: swap.inboundTransferId,
              paymentStatus: 'completed',
              paymentType: 'spark',
              accountId: sparkInformation.identityPubKey,
              details: {
                fee: 0,
                totalFee: 0,
                supportFee: 0,
                amount: parseFloat(swap.amountIn),
                description: t(
                  'screens.inAccount.swapsPage.paymentDescription_outgoing',
                  {
                    swapDirection: t(
                      'screens.inAccount.swapsPage.swapDirection_btcusd',
                    ),
                  },
                ),
                address: sparkInformation.sparkAddress,
                time: Date.now(),
                createdAt: Date.now(),
                direction: 'OUTGOING',
                showSwapLabel: true,
                currentPriceAInB: result.swap.executionPrice,
              },
            };
          } else {
            incomingTransfer = {
              id: swap.outboundTransferId,
              paymentStatus: 'pending',
              paymentType: 'spark',
              accountId: sparkInformation.identityPubKey,
              details: {
                fee: realFeeAmount,
                totalFee: realFeeAmount,
                supportFee: 0,
                amount: parseFloat(swap.amountOut),
                description: t(
                  'screens.inAccount.swapsPage.paymentDescription_incoming',
                  {
                    swapDirection: t(
                      'screens.inAccount.swapsPage.swapDirection_usdbtc',
                    ),
                  },
                ),
                address: sparkInformation.sparkAddress,
                time: Date.now(),
                createdAt: Date.now(),
                direction: 'INCOMING',
                showSwapLabel: true,
                currentPriceAInB: result.swap.executionPrice,
              },
            };
            outgoingTransfer = {
              id: swap.inboundTransferId,
              paymentStatus: 'completed',
              paymentType: 'spark',
              accountId: sparkInformation.identityPubKey,
              details: {
                fee: 0,
                totalFee: 0,
                supportFee: 0,
                amount: parseFloat(swap.amountIn),
                description: t(
                  'screens.inAccount.swapsPage.paymentDescription_outgoing',
                  {
                    swapDirection: t(
                      'screens.inAccount.swapsPage.swapDirection_usdbtc',
                    ),
                  },
                ),
                address: sparkInformation.sparkAddress,
                time: Date.now(),
                createdAt: Date.now(),
                direction: 'OUTGOING',
                isLRC20Payment: true,
                LRC20Token: USDB_TOKEN_ID,
                showSwapLabel: true,
                currentPriceAInB: result.swap.executionPrice,
              },
            };
          }
        }

        if (incomingTransfer) {
          await bulkUpdateSparkTransactions(
            [incomingTransfer, outgoingTransfer],
            'fullUpdate',
          );
        }
      } else {
        const errorInfo = handleFlashnetError({
          ...result.details,
          error: result.error,
        });
        console.log(errorInfo, 'error info');
        navigate.navigate('ErrorScreen', {
          errorMessage: errorInfo.userMessage || result.error,
        });
      }
    } catch (err) {
      console.warn('Execute swap error:', err);
      navigate.navigate('ErrorScreen', {
        errorMessage: t('screens.inAccount.swapsPage.fullSwapError'),
      });
    } finally {
      isSendingPayingEventEmiiter.emit(SENDING_PAYMENT_EVENT_NAME, false);
      isSwappingRef.current = false;
      setIsSwapping(false);
    }
  };

  // ── Review step computed values (safe to call unconditionally) ───────────────

  const isBtcToUsdbReview = fromAsset === 'BTC';
  const reviewDecimals = tokenInformation?.tokenMetadata?.decimals || 6;

  const reviewSwapFee = simulationResult
    ? isBtcToUsdbReview
      ? Number(simulationResult.feePaidAssetIn / 1000000)
      : dollarsToSats(
          simulationResult.feePaidAssetIn / 1000000,
          poolInfo?.currentPriceAInB,
        )
    : 0;

  const reviewLpFee =
    simulationResult && isBtcToUsdbReview
      ? (simulationResult.expectedOutput * INTEGRATOR_FEE) / 1000000
      : 0;

  const reviewExchangeRate = poolInfo
    ? isBtcToUsdbReview
      ? `${displayCorrectDenomination({
          amount: 1,
          masterInfoObject: {
            ...masterInfoObject,
            userBalanceDenomination: 'sats',
          },
        })} ${APPROXIMATE_SYMBOL} ${displayCorrectDenomination({
          amount: Number(satsToDollars(1, poolInfo.currentPriceAInB)).toFixed(
            6,
          ),
          masterInfoObject: {
            ...masterInfoObject,
            userBalanceDenomination: 'fiat',
          },
          forceCurrency: 'USD',
          convertAmount: false,
        })}`
      : `${displayCorrectDenomination({
          amount: 1,
          masterInfoObject: {
            ...masterInfoObject,
            userBalanceDenomination: 'fiat',
          },
          forceCurrency: 'USD',
          convertAmount: false,
        })} ${APPROXIMATE_SYMBOL} ${displayCorrectDenomination({
          amount: Number(dollarsToSats(1, poolInfo.currentPriceAInB)).toFixed(
            0,
          ),
          masterInfoObject: {
            ...masterInfoObject,
            userBalanceDenomination: 'sats',
          },
        })}`
    : '';

  const reviewFormattedBitcoinPrice = displayCorrectDenomination({
    amount: Number(swapUSDPriceDollars).toFixed(2),
    masterInfoObject: {
      ...masterInfoObject,
      userBalanceDenomination: 'fiat',
    },
    forceCurrency: 'USD',
    convertAmount: false,
  });

  const reviewFormattedFee = displayCorrectDenomination({
    amount: Number(reviewSwapFee + reviewLpFee).toFixed(
      isBtcToUsdbReview ? 3 : 0,
    ),
    masterInfoObject: {
      ...masterInfoObject,
      userBalanceDenomination: isBtcToUsdbReview ? 'fiat' : 'sats',
    },
    forceCurrency: 'USD',
    convertAmount: false,
  });

  // ── Render ───────────────────────────────────────────────────────────────────

  const handlePercent = pill => {
    isPillPressRef.current = true;
    setActivePercentage(pill.value);
    setPercentage(pill.pct);
  };

  const goBack = () => handleBackPressAndroid();

  return (
    <View style={styles.container}>
      <AnimatedStep
        active={currentStep === 'routeSelection'}
        direction={stepDirection}
        exitsBack={stepDirection === -1}
      >
        <SwapChooseCurrency
          isLoadingPool={isLoadingPool}
          poolInfo={poolInfo}
          onRetry={loadPoolInfo}
          onSelect={asset => {
            handleSelectFromAsset(asset);
            navigateToStep('amountInput', 'forward');
          }}
          onHistory={() => navigateToStep('historyExpanded', 'forward')}
          onClose={() => handleBackPressFunction()}
        />
      </AnimatedStep>

      <AnimatedStep
        active={currentStep === 'historyExpanded'}
        direction={stepDirection}
        exitsBack={stepDirection === -1}
      >
        <SwapHistory onBack={goBack} />
      </AnimatedStep>

      <AnimatedStep
        active={currentStep === 'amountInput'}
        direction={stepDirection}
        exitsBack={stepDirection === -1}
      >
        <SwapAmount
          balanceLabel={displayBalance}
          fromAsset={fromAsset}
          toAsset={toAsset}
          fromAmount={fromAmount}
          toAmount={toAmount}
          lastEditedField={lastEditedField}
          isSimulating={isSimulating}
          activePercentage={activePercentage}
          canProceed={canProceed}
          isBusy={isSwapping || isLoadingPool || isSimulating}
          onBack={goBack}
          onFieldPress={handleInputPress}
          onFlip={() => {
            handleSwapAssets();
            setActivePercentage(null);
          }}
          onPercent={handlePercent}
          onKeyboardInput={handleKeyboardInput}
          onContinue={executeSwapAction}
        />
      </AnimatedStep>

      <AnimatedStep
        active={currentStep === 'review'}
        direction={stepDirection}
        exitsBack={stepDirection === -1}
      >
        <SwapReview
          fromAsset={fromAsset}
          toAsset={toAsset}
          fromAmount={fromAmount}
          toAmount={toAmount}
          bitcoinPrice={`${APPROXIMATE_SYMBOL} ${reviewFormattedBitcoinPrice}`}
          fee={`${APPROXIMATE_SYMBOL} ${reviewFormattedFee}`}
          isSwapping={isSwapping}
          onBack={goBack}
          onConfirm={handleAcceptReview}
        />
      </AnimatedStep>

      <AnimatedStep
        active={currentStep === 'confirmation'}
        direction={stepDirection}
        fadeOnly={true}
      >
        <SwapSuccess
          onDone={() => handleBackPressFunction()}
          onNewSwap={() => {
            clearPageStates();
            navigateToStep('routeSelection', 'backward');
          }}
        />
      </AnimatedStep>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    overflow: 'hidden',
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 16,
  },
  navbarBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navbarLabel: {
    fontSize: SIZES.smedium,
    includeFontPadding: false,
  },
});
