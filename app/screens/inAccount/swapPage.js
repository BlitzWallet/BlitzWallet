import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import {
  APPROXIMATE_SYMBOL,
  CENTER,
  COLORS,
  ICONS,
  SIZES,
  USDB_TOKEN_ID,
} from '../../constants';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  WINDOWWIDTH,
} from '../../constants/theme';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import CustomSettingsTopBar from '../../functions/CustomElements/settingsTopBar';
import displayCorrectDenomination from '../../functions/displayCorrectDenomination';
import { useSparkWallet } from '../../../context-store/sparkContext';
import { useGlobalContextProvider } from '../../../context-store/context';
import { useNodeContext } from '../../../context-store/nodeContext';
import { useGlobalThemeContext } from '../../../context-store/theme';
import GetThemeColors from '../../hooks/themeColors';
import CustomButton from '../../functions/CustomElements/button';
import {
  findBestPool,
  simulateSwap,
  swapBitcoinToToken,
  swapTokenToBitcoin,
  handleFlashnetError,
  BTC_ASSET_ADDRESS,
  USD_ASSET_ADDRESS,
  requestManualClawback,
  listClawbackableTransfers,
  getUserSwapHistory,
  satsToDollars,
  dollarsToSats,
} from '../../functions/spark/flashnet';

import { useActiveCustodyAccount } from '../../../context-store/activeAccount';
import useDebounce from '../../hooks/useDebounce';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { updateConfirmAnimation } from '../../functions/lottieViewColorTransformer';
import LottieView from 'lottie-react-native';
import { useAppStatus } from '../../../context-store/appStatus';
import { bulkUpdateSparkTransactions } from '../../functions/spark/transactions';
import ThemeImage from '../../functions/CustomElements/themeImage';
import FullLoadingScreen from '../../functions/CustomElements/loadingScreen';
import CustomNumberKeyboard from '../../functions/CustomElements/customNumberKeyboard';
import { formatBalanceAmount } from '../../functions';
import customUUID from '../../functions/customUUID';
import { useFlashnet } from '../../../context-store/flashnetContext';
import { useUserBalanceContext } from '../../../context-store/userBalanceContext';
import useHandleBackPressNew from '../../hooks/useHandleBackPressNew';
import FormattedSatText from '../../functions/CustomElements/satTextDisplay';
import DropdownMenu from '../../functions/CustomElements/dropdownMenu';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import { setFlashnetTransfer } from '../../functions/spark/handleFlashnetTransferIds';

const confirmTxAnimation = require('../../assets/confirmTxAnimation.json');

const SLIPPAGE_DROPDOWN_OPTIONS = [
  { label: '0.1%', value: '0.1' },
  { label: '0.5%', value: '0.5' },
  { label: '1%', value: '1' },
  { label: '3%', value: '3' },
  { label: '5%', value: '5' },
];

export default function SwapsPage() {
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
  const { screenDimensions } = useAppStatus();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor, textColor } = GetThemeColors();
  const { t } = useTranslation();

  // State management
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [fromAsset, setFromAsset] = useState('BTC');
  const [toAsset, setToAsset] = useState('USD');
  const [isSimulating, setIsSimulating] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [isLoadingPool, setIsLoadingPool] = useState(true);
  const [poolInfo, setPoolInfo] = useState(null);
  const [simulationResult, setSimulationResult] = useState(null);
  const [error, setError] = useState(null);
  const [priceImpact, setPriceImpact] = useState(null);
  const [confirmedSwap, setConfirmedSwap] = useState(null);
  const [lastEditedField, setLastEditedField] = useState('from');
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [showReviewScreen, setShowReviewScreen] = useState(false);
  const [slippagePercent, setSlippagePercent] = useState('');

  // Animated values for font sizes
  const fromAmountFontSize = useSharedValue(SIZES.large);
  const toAmountFontSize = useSharedValue(SIZES.large);
  const fromAmountScale = useSharedValue(1);
  const toAmountScale = useSharedValue(1);
  const fromAmountOpacity = useSharedValue(1);
  const toAmountOpacity = useSharedValue(1);
  const isInitialMount = useRef(true);
  const currentRequetId = useRef(null);
  const lastSimulatedAmount = useRef(null);

  // Get balances
  const tokenInformation = sparkInformation?.tokens?.[USDB_TOKEN_ID];

  const btcBalance = sparkInformation?.balance || 0;

  const displayBalance =
    fromAsset === 'BTC'
      ? btcBalance
      : formatBalanceAmount(dollarBalanceToken, false, masterInfoObject);

  const fromAssetLabel =
    fromAsset === 'USD'
      ? t('constants.dollars_upper')
      : t('constants.bitcoin_upper');

  const toAssetLabel =
    toAsset === 'USD'
      ? t('constants.dollars_upper')
      : t('constants.bitcoin_upper');

  // Load pool information on mount
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
    setShowReviewScreen(false);
    // setShowKeyboard(false);
    isInitialMount.current = true;
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

  // Simulate swap when amount changes
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
        simulateSwapAmount(fromAmount, 'from', uuid);
      } else {
        setToAmount('');
        setSimulationResult(null);
        setPriceImpact(null);
        setError('');
      }
    } else if (lastEditedField === 'to') {
      if (toAmount.length && !isNaN(toAmount) && parseFloat(toAmount) > 0) {
        if (lastSimulatedAmount.current === toAmount && fromAmount) return;
        lastSimulatedAmount.current = toAmount;
        simulateSwapAmount(toAmount, 'to', uuid);
      } else {
        setFromAmount('');
        setSimulationResult(null);
        setPriceImpact(null);
        setError('');
      }
    }
  }, [fromAmount, toAmount, fromAsset, toAsset, poolInfo, lastEditedField]);

  const simulateSwapAmount = useDebounce(async (amount, direction, uuid) => {
    if (!poolInfo) return;
    if (uuid !== currentRequetId.current) {
      console.log('New requset created, blocking...');
      return;
    }
    if (!amount) {
      setError('');
      return;
    }
    setIsSimulating(true);
    setError(null);

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
        console.log('New requset created, blocking...');
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

  const handleSwapAssets = () => {
    const tempAsset = fromAsset;
    const tempAmount = fromAmount;

    setFromAsset(toAsset);
    setToAsset(tempAsset);
    setFromAmount('');
    setToAmount('');

    setLastEditedField('from');
    currentRequetId.current = null;

    setSimulationResult(null);
    setPriceImpact(null);
    setError(null);
  };

  const handleFromAmountChange = (value, direction) => {
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      if (direction === 'from') {
        setFromAmount(value);
        setLastEditedField('from');
      } else {
        setToAmount(value);
        setLastEditedField('to');
      }
    }
  };

  const handleBackPressAndroid = useCallback(() => {
    if (showReviewScreen) {
      setShowReviewScreen(false);
      return true;
    } else {
      return false;
    }
  }, [showReviewScreen]);
  useHandleBackPressNew(handleBackPressAndroid);

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
    // setShowKeyboard(true);
  };

  const handleKeyboardInput = value => {
    if (lastEditedField === 'from') {
      handleFromAmountChange(value, 'from');
    } else {
      handleFromAmountChange(value, 'to');
    }
  };

  // const dismissKeyboard = () => {
  //   setShowKeyboard(false);
  // };

  // Calculate dynamic font size based on text length
  const getAmountFontSize = amount => {
    if (!amount) return SIZES.large;

    const length = amount.toString().length;

    if (length <= 6) return SIZES.large;
    if (length <= 9) return SIZES.medium;
    if (length <= 12) return SIZES.smedium;
    if (length <= 15) return SIZES.small;
    return SIZES.xSmall;
  };

  // Update animated font sizes when amounts change
  useEffect(() => {
    const newSize = getAmountFontSize(fromAmount);

    if (isInitialMount.current) {
      fromAmountFontSize.value = newSize;
    } else {
      fromAmountFontSize.value = withSpring(newSize, {
        damping: 500,
        stiffness: 400,
      });
    }
  }, [fromAmount]);

  useEffect(() => {
    const newSize = getAmountFontSize(toAmount);

    if (isInitialMount.current) {
      toAmountFontSize.value = newSize;
      isInitialMount.current = false;
    } else {
      toAmountFontSize.value = withSpring(newSize, {
        damping: 500,
        stiffness: 400,
      });
    }
  }, [toAmount]);

  // Animated styles
  const fromAmountAnimatedStyle = useAnimatedStyle(() => ({
    fontSize: fromAmountFontSize.value,
    opacity: fromAmountOpacity.value,
    transform: [{ scale: fromAmountScale.value }],
  }));

  const toAmountAnimatedStyle = useAnimatedStyle(() => ({
    fontSize: toAmountFontSize.value,
    opacity: toAmountOpacity.value,
    transform: [{ scale: toAmountScale.value }],
  }));

  const executeSwapAction = async () => {
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
            // convertAmount: false,
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
          setShowReviewScreen(true);
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
      setShowReviewScreen(true);
    }
  };

  const handleAcceptReview = () => {
    // Check for high price impact
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
    setIsSwapping(true);
    setError(null);

    try {
      const isBtcToUsdb = fromAsset === 'BTC';
      const decimals = tokenInformation?.tokenMetadata?.decimals || 6;

      const amountInSmallestUnits = isBtcToUsdb
        ? Math.floor(parseFloat(fromAmount))
        : Math.floor(parseFloat(fromAmount) * Math.pow(10, decimals));

      // const fee = isBtcToUsdb
      //   ? Number(
      //       dollarsToSats(
      //         simulationResult.feePaidAssetIn / Math.pow(10, decimals),
      //         poolInfo.currentPriceAInB,
      //       ),
      //     )
      //   : Number(simulationResult.feePaidAssetIn);

      // const userBalance = isBtcToUsdb
      //   ? bitcoinBalance
      //   : dollarBalanceToken * 1000000;

      // const swapAmount = Math.min(
      //   userBalance,
      //   Math.round(amountInSmallestUnits + fee),
      // );

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

      console.log('Execure swap response', result);

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
        setShowReviewScreen(false);
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
                time: Date.now() + 1000,
                createdAt: Date.now() + 1000,
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
                time: Date.now() + 1000,
                createdAt: Date.now() + 1000,
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

        // setFlashnetTransfer(outgoingTransfer.id);

        if (incomingTransfer) {
          bulkUpdateSparkTransactions(
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
      navigate.navigate('ErrorScreen', {
        errorMessage: t('screens.inAccount.swapsPage.fullSwapError'),
      });
    } finally {
      setIsSwapping(false);
    }
  };

  const confirmAnimation = useMemo(() => {
    return updateConfirmAnimation(
      confirmTxAnimation,
      theme ? (darkModeType ? 'lightsOut' : 'dark') : 'light',
    );
  }, [theme, darkModeType]);

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

  if (isLoadingPool) {
    return (
      <GlobalThemeView useStandardWidth={true} styles={styles.globalContainer}>
        <CustomSettingsTopBar containerStyles={{ marginBottom: 0 }} />
        <View style={styles.loadingContainer}>
          <FullLoadingScreen
            textStyles={styles.loadingText}
            text={t('screens.inAccount.swapsPage.loadingPool')}
          />
        </View>
      </GlobalThemeView>
    );
  }

  if (confirmedSwap) {
    const isBtcToUsdb = fromAsset === 'BTC';

    return (
      <GlobalThemeView useStandardWidth={true} styles={styles.globalContainer}>
        <CustomSettingsTopBar containerStyles={{ marginBottom: 0 }} />
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: 'center',
          }}
        >
          <LottieView
            source={confirmAnimation}
            loop={false}
            autoPlay={true}
            style={{
              width: screenDimensions.width / 2,
              height: screenDimensions.width / 2,
              maxWidth: 280,
              maxHeight: 280,
            }}
          />

          <ThemeText
            styles={{
              fontSize: SIZES.xLarge,
              marginBottom: 8,
            }}
            content={t('screens.inAccount.swapsPage.swapConfimred')}
          />
          {/* Action Buttons */}
          <CustomButton
            buttonStyles={{
              width: 'auto',
              minWidth: 300,
              backgroundColor: theme ? COLORS.darkModeText : COLORS.primary,
              marginTop: 'auto',
            }}
            textStyles={{
              color: theme ? COLORS.lightModeText : COLORS.darkModeText,
            }}
            actionFunction={navigate.goBack}
            textContent={t('constants.done')}
          />
          <CustomButton
            buttonStyles={{
              width: 'auto',
              minWidth: 300,
              backgroundColor: 'transparent',
            }}
            textStyles={{ color: textColor }}
            actionFunction={() => {
              setConfirmedSwap(null);
              clearPageStates();
            }}
            textContent={t('screens.inAccount.swapsPage.newSwap')}
          />
        </ScrollView>
      </GlobalThemeView>
    );
  }

  // Review Screen
  if (showReviewScreen) {
    const isBtcToUsdb = fromAsset === 'BTC';

    const swapFee = isBtcToUsdb
      ? Number(simulationResult.feePaidAssetIn / 1000000)
      : dollarsToSats(
          simulationResult.feePaidAssetIn / 1000000,
          poolInfo.currentPriceAInB,
        );

    const lpFee = isBtcToUsdb
      ? (simulationResult.expectedOutput * (poolInfo.lpFeeBps / 100 + 1)) /
        100 /
        1000000
      : (simulationResult.expectedOutput * (poolInfo.lpFeeBps / 100 + 1)) / 100;

    const exchangeRate = isBtcToUsdb
      ? `${displayCorrectDenomination({
          amount: 1,
          masterInfoObject: {
            ...masterInfoObject,
            userBalanceDenomination: 'sats',
          },
          convertAmount: false,
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
        })}`;

    const formattedBitcoinPrice = displayCorrectDenomination({
      amount: Number(swapUSDPriceDollars).toFixed(2),
      masterInfoObject: {
        ...masterInfoObject,
        userBalanceDenomination: 'fiat',
      },
      forceCurrency: 'USD',
      convertAmount: false,
    });

    const formattedFee = displayCorrectDenomination({
      amount: Number(swapFee + lpFee).toFixed(isBtcToUsdb ? 3 : 0),
      masterInfoObject: {
        ...masterInfoObject,
        userBalanceDenomination: isBtcToUsdb ? 'fiat' : 'sats',
      },
      forceCurrency: 'USD',
      convertAmount: false,
    });

    return (
      <GlobalThemeView useStandardWidth={true}>
        <CustomSettingsTopBar
          containerStyles={{ marginBottom: 0 }}
          customBackFunction={() => setShowReviewScreen(false)}
          label={t('constants.review')}
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: 'center',
            paddingTop: 40,
          }}
        >
          <View style={styles.contentWrapper}>
            <View style={[styles.cardContainer, { marginBottom: 20 }]}>
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: theme
                      ? backgroundOffset
                      : COLORS.darkModeText,
                  },
                ]}
              >
                <View style={[styles.cardHeader, { marginBottom: 5 }]}>
                  <ThemeText
                    styles={styles.label}
                    content={t('screens.inAccount.swapsPage.yourAreConverting')}
                  />
                </View>

                <View style={styles.assetRow}>
                  <ThemeText
                    styles={[styles.reviewAmount, { fontSize: SIZES.large }]}
                    content={`${formatBalanceAmount(
                      fromAmount,
                      false,
                      masterInfoObject,
                    )} ${fromAsset === 'BTC' ? 'SAT' : 'USD'}`}
                  />
                </View>
              </View>

              {/* Swap Button */}
              <TouchableOpacity
                style={[
                  styles.swapButton,
                  {
                    backgroundColor:
                      theme && darkModeType
                        ? COLORS.darkModeText
                        : COLORS.primary,
                  },
                ]}
                activeOpacity={1}
              >
                <ThemeIcon
                  size={22}
                  iconName={'ArrowDownUp'}
                  styles={{
                    color:
                      theme && darkModeType
                        ? COLORS.lightModeText
                        : COLORS.darkModeText,
                  }}
                />
              </TouchableOpacity>

              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: theme
                      ? backgroundOffset
                      : COLORS.darkModeText,
                  },
                ]}
              >
                <View style={[styles.cardHeader, { marginBottom: 5 }]}>
                  <ThemeText
                    styles={styles.label}
                    content={t('screens.inAccount.swapsPage.youWillReceive')}
                  />
                </View>

                <View style={[styles.assetRow]}>
                  <ThemeText
                    styles={[styles.reviewAmount, { fontSize: SIZES.large }]}
                    content={`${formatBalanceAmount(
                      toAmount,
                      false,
                      masterInfoObject,
                    )} ${toAsset === 'BTC' ? 'SAT' : 'USD'}`}
                  />
                </View>
              </View>
            </View>

            {/* Rate card */}
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme
                    ? backgroundOffset
                    : COLORS.darkModeText,
                  marginBottom: 20,
                },
              ]}
            >
              <View style={styles.reviewSection}>
                <ThemeText
                  styles={[styles.reviewLabel, { opacity: 0.6 }]}
                  content={t('screens.inAccount.swapsPage.exchangeRate')}
                />
                <ThemeText
                  styles={styles.reviewAmount}
                  content={exchangeRate}
                />
              </View>

              <View
                style={{
                  width: '100%',
                  height: 1,
                  backgroundColor: backgroundColor,
                  marginVertical: 10,
                }}
              />

              <View style={styles.reviewSection}>
                <ThemeText
                  styles={[styles.reviewLabel, { opacity: 0.6 }]}
                  content={t('screens.inAccount.swapsPage.bitcoinPrice')}
                />
                <ThemeText
                  styles={styles.reviewAmount}
                  content={`${APPROXIMATE_SYMBOL} ${formattedBitcoinPrice}`}
                />
              </View>
            </View>

            {/* Fee card */}
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme
                    ? backgroundOffset
                    : COLORS.darkModeText,
                  marginBottom: 20,
                },
              ]}
            >
              <View style={styles.reviewSection}>
                <ThemeText
                  styles={[styles.reviewLabel, { opacity: 0.6 }]}
                  content={t('screens.inAccount.swapsPage.swapFee')}
                />
                <ThemeText
                  styles={styles.reviewAmount}
                  content={`${APPROXIMATE_SYMBOL} ${formattedFee}`}
                />
              </View>
            </View>

            {/* Fee card */}
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme
                    ? backgroundOffset
                    : COLORS.darkModeText,
                },
              ]}
            >
              <View style={styles.reviewSection}>
                <TouchableOpacity
                  onPress={() => {
                    navigate.navigate('InformationPopup', {
                      textContent: t(
                        'screens.inAccount.swapsPage.slippageDesc',
                      ),
                      buttonText: t('constants.iunderstand'),
                    });
                  }}
                  style={styles.slippageInfoContainer}
                >
                  <ThemeText
                    styles={[styles.reviewLabel, { opacity: 0.6 }]}
                    content={t('screens.inAccount.swapsPage.slippage')}
                  />
                  <ThemeIcon
                    size={20}
                    styles={{ marginLeft: 5 }}
                    iconName={'Info'}
                  />
                </TouchableOpacity>
                <DropdownMenu
                  placeholder={t('screens.inAccount.swapsPage.auto')}
                  options={SLIPPAGE_DROPDOWN_OPTIONS}
                  selectedValue={
                    slippagePercent ? `${slippagePercent}%` : undefined
                  }
                  globalContainerStyles={{
                    width: 'unset',
                    flexShrink: 1,
                  }}
                  onSelect={handleDropdownToggle}
                  showVerticalArrowsAbsolute={true}
                  customButtonStyles={{
                    width: 'unset',
                    minWidth: 'unset',
                    flex: 0,
                    marginLeft: 'auto',
                    backgroundColor,
                  }}
                  showClearIcon={false}
                />
              </View>
            </View>

            <View style={{ marginTop: 'auto' }} />

            {/* Accept Button */}
            <CustomButton
              useLoading={isSwapping}
              buttonStyles={{
                ...CENTER,
                marginTop: 40,
              }}
              actionFunction={handleAcceptReview}
              textContent={t('constants.accept')}
            />
            <ThemeText
              styles={styles.disclaimer}
              content={t('screens.inAccount.swapsPage.swapDisclaimer')}
            />
          </View>
        </ScrollView>
      </GlobalThemeView>
    );
  }

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        label={t('screens.inAccount.swapsPage.convertHead')}
        showLeftImage={true}
        iconNew="History"
        leftImageFunction={() => navigate.navigate('ConversionHistory')}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {/* <Pressable
          style={{ flexGrow: 1, alignItems: 'center' }}
          // onPress={dismissKeyboard}
        > */}
        <View style={styles.contentWrapper}>
          {!isLoadingPool && poolInfo && (
            <>
              <View style={styles.cardContainer}>
                <View
                  style={[
                    styles.card,
                    {
                      backgroundColor: theme
                        ? backgroundOffset
                        : COLORS.darkModeText,
                    },
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <FormattedSatText
                      frontText={
                        t('screens.inAccount.swapsPage.fromBalanceHidden') + ' '
                      }
                      styles={styles.label}
                      balance={displayBalance}
                      globalBalanceDenomination={
                        masterInfoObject.userBalanceDenomination === 'hidden'
                          ? 'hidden'
                          : fromAsset === 'BTC'
                          ? 'sats'
                          : 'fiat'
                      }
                      useBalance={fromAsset === 'USD'}
                      forceCurrency={'USD'}
                    />
                    {isSimulating && lastEditedField === 'to' && (
                      <FullLoadingScreen
                        showText={false}
                        containerStyles={{ flex: 0 }}
                        size="small"
                      />
                    )}
                  </View>

                  <View style={styles.assetRow}>
                    <View style={styles.assetInfo}>
                      <View
                        style={[
                          styles.iconContainer,
                          {
                            backgroundColor:
                              theme && darkModeType
                                ? backgroundColor
                                : fromAsset === 'BTC'
                                ? COLORS.bitcoinOrange
                                : COLORS.dollarGreen,
                          },
                        ]}
                      >
                        {fromAsset === 'BTC' ? (
                          <ThemeImage
                            styles={{ width: 20, height: 20 }}
                            lightModeIcon={ICONS.bitcoinIcon}
                            darkModeIcon={ICONS.bitcoinIcon}
                            lightsOutIcon={ICONS.bitcoinIcon}
                          />
                        ) : (
                          <ThemeImage
                            styles={{ width: 20, height: 20 }}
                            lightModeIcon={ICONS.dollarIcon}
                            darkModeIcon={ICONS.dollarIcon}
                            lightsOutIcon={ICONS.dollarIcon}
                          />
                        )}
                      </View>
                      <ThemeText
                        styles={styles.assetText}
                        content={fromAssetLabel}
                      />
                    </View>
                    <TouchableOpacity
                      onPress={() => handleInputPress('from')}
                      activeOpacity={0.2}
                      style={{ opacity: fromAmount ? 1 : 0.5 }}
                    >
                      <Animated.Text
                        style={[
                          styles.amountInput,
                          {
                            color: theme
                              ? COLORS.darkModeText
                              : COLORS.lightModeText,
                          },
                          fromAmountAnimatedStyle,
                        ]}
                      >
                        {formatBalanceAmount(
                          fromAmount,
                          false,
                          masterInfoObject,
                        ) || '0'}{' '}
                        {fromAsset === 'BTC' ? 'SAT' : 'USD'}
                      </Animated.Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Swap Button */}
                <TouchableOpacity
                  style={[
                    styles.swapButton,
                    {
                      backgroundColor:
                        theme && darkModeType
                          ? COLORS.darkModeText
                          : COLORS.primary,
                    },
                  ]}
                  onPress={handleSwapAssets}
                  activeOpacity={0.7}
                  disabled={isSwapping || isLoadingPool}
                >
                  <ThemeIcon
                    size={22}
                    iconName={'ArrowDownUp'}
                    styles={{
                      color:
                        theme && darkModeType
                          ? COLORS.lightModeText
                          : COLORS.darkModeText,
                    }}
                  />
                </TouchableOpacity>

                <View
                  style={[
                    styles.card,
                    {
                      backgroundColor: theme
                        ? backgroundOffset
                        : COLORS.darkModeText,
                    },
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <ThemeText
                      styles={styles.label}
                      content={t('screens.inAccount.swapsPage.toBalance')}
                    />
                    {isSimulating && lastEditedField === 'from' && (
                      <FullLoadingScreen
                        showText={false}
                        containerStyles={{ flex: 0 }}
                        size="small"
                      />
                    )}
                  </View>

                  <View style={styles.assetRow}>
                    <View style={styles.assetInfo}>
                      <View
                        style={[
                          styles.iconContainer,
                          {
                            backgroundColor:
                              theme && darkModeType
                                ? backgroundColor
                                : fromAsset === 'USD'
                                ? COLORS.bitcoinOrange
                                : COLORS.dollarGreen,
                          },
                        ]}
                      >
                        {fromAsset !== 'BTC' ? (
                          <ThemeImage
                            styles={{ width: 20, height: 20 }}
                            lightModeIcon={ICONS.bitcoinIcon}
                            darkModeIcon={ICONS.bitcoinIcon}
                            lightsOutIcon={ICONS.bitcoinIcon}
                          />
                        ) : (
                          <ThemeImage
                            styles={{ width: 20, height: 20 }}
                            lightModeIcon={ICONS.dollarIcon}
                            darkModeIcon={ICONS.dollarIcon}
                            lightsOutIcon={ICONS.dollarIcon}
                          />
                        )}
                      </View>
                      <ThemeText
                        styles={styles.assetText}
                        content={toAssetLabel}
                      />
                    </View>
                    <TouchableOpacity
                      onPress={() => handleInputPress('to')}
                      activeOpacity={0.2}
                      style={{ opacity: toAmount ? 1 : 0.5 }}
                    >
                      <Animated.Text
                        style={[
                          styles.amountInput,
                          {
                            color: theme
                              ? COLORS.darkModeText
                              : COLORS.lightModeText,
                          },
                          toAmountAnimatedStyle,
                        ]}
                      >
                        {formatBalanceAmount(
                          toAmount,
                          false,
                          masterInfoObject,
                        ) || '0'}{' '}
                        {toAsset === 'BTC' ? 'SAT' : 'USD'}
                      </Animated.Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <ThemeText
                styles={styles.dollarPrice}
                content={`${APPROXIMATE_SYMBOL} ${displayCorrectDenomination({
                  amount: Number(swapUSDPriceDollars).toFixed(2),
                  forceCurrency: 'USD',
                  masterInfoObject: {
                    ...masterInfoObject,
                    userBalanceDenomination: 'fiat',
                  },
                  convertAmount: false,
                })}`}
              />

              <ThemeText
                styles={{ fontSize: SIZES.smedium, marginBottom: 5 }}
                content={t(
                  'screens.inAccount.swapsPage.percentConvertSelector',
                )}
              />
              <View style={styles.quickButtons}>
                <TouchableOpacity
                  style={[
                    styles.quickButton,
                    {
                      backgroundColor: theme
                        ? backgroundOffset
                        : COLORS.darkModeText,
                    },
                  ]}
                  onPress={() => setPercentage(0.25)}
                  activeOpacity={0.7}
                  disabled={isSwapping || isLoadingPool}
                >
                  <ThemeText styles={styles.quickButtonText} content={'25%'} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.quickButton,
                    {
                      backgroundColor: theme
                        ? backgroundOffset
                        : COLORS.darkModeText,
                    },
                  ]}
                  onPress={() => setPercentage(0.5)}
                  activeOpacity={0.7}
                  disabled={isSwapping || isLoadingPool}
                >
                  <ThemeText styles={styles.quickButtonText} content={'50%'} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.quickButton,
                    {
                      backgroundColor: theme
                        ? backgroundOffset
                        : COLORS.darkModeText,
                    },
                  ]}
                  onPress={() => setPercentage(0.75)}
                  activeOpacity={0.7}
                  disabled={isSwapping || isLoadingPool}
                >
                  <ThemeText styles={styles.quickButtonText} content={'75%'} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.quickButton,
                    {
                      backgroundColor: theme
                        ? backgroundOffset
                        : COLORS.darkModeText,
                    },
                  ]}
                  onPress={() => setPercentage(1)}
                  activeOpacity={0.7}
                  disabled={isSwapping || isLoadingPool}
                >
                  <ThemeText styles={styles.quickButtonText} content={'100%'} />
                </TouchableOpacity>
              </View>

              <View style={{ marginTop: 'auto' }} />
            </>
          )}

          {!isLoadingPool && !poolInfo && (
            <View style={styles.errorStateContainer}>
              <ThemeText
                styles={styles.errorStateTitle}
                content={t(
                  'screens.inAccount.swapsPage.serviceUnavailableHead',
                )}
              />
              <ThemeText
                styles={styles.errorStateMessage}
                content={t(
                  'screens.inAccount.swapsPage.serviceUnavailableDesc',
                )}
              />
              <CustomButton
                buttonStyles={{ marginTop: 20 }}
                textContent={t('constants.retry')}
                actionFunction={loadPoolInfo}
              />
            </View>
          )}
        </View>
        {/* </Pressable> */}
      </ScrollView>

      {/* {true && ( */}
      {!isLoadingPool && poolInfo && (
        <>
          <HandleKeyboardRender
            lastEditedField={lastEditedField}
            fromAsset={fromAsset}
            toAsset={toAsset}
            handleKeyboardInput={handleKeyboardInput}
            setFromAmount={setFromAmount}
            fromAmount={fromAmount}
            toAmount={toAmount}
          />
          <CustomButton
            buttonStyles={{
              ...CENTER,
              opacity: canSwap || isSwapping ? 1 : 0.5,
            }}
            useLoading={isSwapping || isLoadingPool}
            textContent={t('constants.review')}
            actionFunction={executeSwapAction}
            // disabled={!canSwap}
          />
          <ThemeText
            styles={styles.disclaimer}
            content={t('screens.inAccount.swapsPage.swapDisclaimer')}
          />
        </>
      )}
      {/* )} */}
    </GlobalThemeView>
  );
}

function HandleKeyboardRender({
  lastEditedField,
  toAsset,
  fromAsset,
  handleKeyboardInput,
  fromAmount,
  toAmount,
}) {
  const [amount, setAmount] = useState(
    lastEditedField === 'from' ? fromAmount : toAmount,
  );
  const fromAmountRef = useRef(fromAmount);
  const toAmountRef = useRef(toAmount);
  const amountRef = useRef(amount);

  useEffect(() => {
    amountRef.current = amount;
  }, [amount]);

  useEffect(() => {
    fromAmountRef.current = fromAmount;
  }, [fromAmount]);

  useEffect(() => {
    toAmountRef.current = toAmount;
  }, [toAmount]);

  useEffect(() => {
    handleKeyboardInput(amount);
  }, [amount]);

  useEffect(() => {
    if (fromAmount !== amountRef.current && lastEditedField === 'from') {
      setAmount(fromAmount);
    } else if (toAmount !== amountRef.current && lastEditedField === 'to') {
      setAmount(toAmount);
    }
  }, [fromAmount, toAmount, lastEditedField]);

  return (
    <CustomNumberKeyboard
      showDot={
        (lastEditedField === 'from' && fromAsset === 'USD') ||
        (lastEditedField === 'to' && toAsset === 'USD')
      }
      usingForBalance={true}
      setInputValue={setAmount}
    />
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flexGrow: 1, paddingTop: 10, alignItems: 'center' },
  contentWrapper: {
    width: WINDOWWIDTH,
    maxWidth: 600,
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: SIZES.medium,
    opacity: HIDDEN_OPACITY,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 15,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  label: {
    fontSize: SIZES.smedium,
    opacity: HIDDEN_OPACITY,
    includeFontPadding: false,
  },
  assetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  assetText: {
    fontSize: SIZES.large,
    fontWeight: '500',
    includeFontPadding: false,
  },
  amountInput: {
    fontWeight: '500',
    textAlign: 'right',
    minWidth: 100,
    includeFontPadding: false,
  },
  cardContainer: {
    gap: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swapButton: {
    width: 40,
    height: 40,
    borderRadius: 26,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    position: 'absolute',
    zIndex: 10,
  },
  quickButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  quickButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  quickButtonText: {
    fontSize: SIZES.smedium,
    fontWeight: '500',
    includeFontPadding: false,
  },
  errorContainer: {
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    fontSize: SIZES.small,
    color: COLORS.darkModeText,
    flexShrink: 1,
    marginLeft: 10,
    includeFontPadding: false,
  },
  disclaimer: {
    textAlign: 'center',
    fontSize: SIZES.xSmall,
    opacity: HIDDEN_OPACITY,
    marginTop: 12,
    maxWidth: 300,
    ...CENTER,
  },
  dollarPrice: {
    textAlign: 'center',
    fontSize: SIZES.smedium,
    opacity: HIDDEN_OPACITY,
    marginTop: 12,
    marginBottom: 5,
    lineHeight: 16,
    maxWidth: 250,
    ...CENTER,
  },
  errorStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorStateTitle: {
    fontSize: SIZES.xLarge,
    fontWeight: '500',
    marginBottom: 8,
  },
  errorStateMessage: {
    fontSize: SIZES.medium,
    textAlign: 'center',
    opacity: HIDDEN_OPACITY,
    lineHeight: 22,
  },
  globalContainer: {
    flex: 1,
    alignItems: 'center',
  },
  paymentTable: {
    width: '95%',
    maxWidth: 300,
    rowGap: 20,
  },
  paymentTableRow: {
    width: '100%',
    minWidth: 200,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  labelText: {
    flexShrink: 1,
    marginRight: 5,
  },

  detailsCard: {
    width: '100%',
    maxWidth: 400,
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    position: 'relative',
  },
  detailSection: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: SIZES.small,
    opacity: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailAmount: {
    fontSize: SIZES.xLarge,
    includeFontPadding: false,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    zIndex: 99,
    borderRadius: 40,
    padding: 5,
  },

  transactionDetails: {
    width: '100%',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 2,
    marginBottom: 30,
    gap: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    maxWidth: 200,
    ...CENTER,
    gap: 10,
  },
  detailRowLabel: {
    fontSize: SIZES.medium,
    opacity: 0.6,
    flexShrink: 1,
  },

  reviewLabel: {
    fontSize: SIZES.smedium,
    includeFontPadding: false,
  },
  reviewAmount: {
    fontSize: SIZES.smedium,
    includeFontPadding: false,
  },
  reviewSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slippageInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 5,
  },
});
