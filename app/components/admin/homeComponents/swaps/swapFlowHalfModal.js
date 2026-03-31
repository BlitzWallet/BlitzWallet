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
  FlatList,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  APPROXIMATE_SYMBOL,
  CENTER,
  COLORS,
  CONTENT_KEYBOARD_OFFSET,
  ICONS,
  SIZES,
  USDB_TOKEN_ID,
} from '../../../../constants';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  WINDOWWIDTH,
} from '../../../../constants/theme';
import { ThemeText } from '../../../../functions/CustomElements';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import GetThemeColors from '../../../../hooks/themeColors';
import CustomButton from '../../../../functions/CustomElements/button';
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
  currentPriceAinBToPriceDollars,
} from '../../../../functions/spark/flashnet';
import { useActiveCustodyAccount } from '../../../../../context-store/activeAccount';
import useDebounce from '../../../../hooks/useDebounce';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { updateConfirmAnimation } from '../../../../functions/lottieViewColorTransformer';
import LottieView from 'lottie-react-native';
import { useAppStatus } from '../../../../../context-store/appStatus';
import { bulkUpdateSparkTransactions } from '../../../../functions/spark/transactions';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import { formatBalanceAmount } from '../../../../functions';
import customUUID from '../../../../functions/customUUID';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import { useUserBalanceContext } from '../../../../../context-store/userBalanceContext';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import DropdownMenu from '../../../../functions/CustomElements/dropdownMenu';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import CheckMarkCircle from '../../../../functions/CustomElements/checkMarkCircle';
import { getTimeDisplay } from '../../../../functions/contacts';
import useAdaptiveButtonLayout from '../../../../hooks/useAdaptiveButtonLayout';
import NoContentSceen from '../../../../functions/CustomElements/noContentScreen';

const confirmTxAnimation = require('../../../../assets/confirmTxAnimation.json');

const SLIPPAGE_DROPDOWN_OPTIONS = [
  { label: '0.1%', value: '0.1' },
  { label: '0.5%', value: '0.5' },
  { label: '1%', value: '1' },
  { label: '3%', value: '3' },
  { label: '5%', value: '5' },
];

export default function SwapFlowHalfModal({
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
  const { screenDimensions } = useAppStatus();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor, textColor } = GetThemeColors();
  const { t } = useTranslation();

  // Step state
  const [currentStep, setCurrentStep] = useState('routeSelection');
  const dirRef = useRef('forward');
  const stepOpacity = useSharedValue(1);
  const stepTranslateX = useSharedValue(0);

  // Swap state (migrated from SwapsPage verbatim)
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
  const [slippagePercent, setSlippagePercent] = useState('');
  const [activePercentage, setActivePercentage] = useState(null);

  // History state (new — replaces ConversionHistory navigation)
  const [swapHistory, setSwapHistory] = useState({ swaps: [], totalCount: 0 });
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [finishedInitialHistoryLoad, setFinishedInitialHistoryLoad] =
    useState(false);

  // Animated values for amount font sizes (migrated from SwapsPage verbatim)
  const fromAmountFontSize = useSharedValue(SIZES.large);
  const toAmountFontSize = useSharedValue(SIZES.large);
  const fromAmountScale = useSharedValue(1);
  const toAmountScale = useSharedValue(1);
  const fromAmountOpacity = useSharedValue(1);
  const toAmountOpacity = useSharedValue(1);
  const isInitialMount = useRef(true);
  const currentRequetId = useRef(null);
  const lastSimulatedAmount = useRef(null);
  const isPillPressRef = useRef(false);

  // Step transition animated style — matches PoolCreationOverlay pattern
  const stepAnimatedStyle = useAnimatedStyle(() => ({
    opacity: stepOpacity.value,
    transform: [{ translateX: stepTranslateX.value }],
    pointerEvents: stepOpacity.value > 0.5 ? 'auto' : 'none',
  }));

  const HEIGHT_FOR_STEP = useMemo(
    () => ({
      routeSelection: 500,
      historyExpanded: screenDimensions.height,
      amountInput: 700,
      review: screenDimensions.height,
      confirmation: 500,
    }),
    [screenDimensions.height],
  );

  // Resize modal and animate entrance on every step change
  useEffect(() => {
    if (setContentHeight) {
      setContentHeight(HEIGHT_FOR_STEP[currentStep]);
    }
    stepOpacity.value = withTiming(1, { duration: 250 });
    stepTranslateX.value = withTiming(0, { duration: 250 });
  }, [currentStep]);

  // Navigate between steps with slide direction
  const navigateToStep = useCallback((newStep, dir = 'forward') => {
    dirRef.current = dir;
    stepOpacity.value = 0;
    stepTranslateX.value = dir === 'forward' ? 30 : -30;
    setCurrentStep(newStep);
  }, []);

  // Android hardware back press — intercepts step-level navigation
  const handleBackPressAndroid = useCallback(() => {
    if (isSwapping) return true;
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
  }, [currentStep, navigateToStep, isSwapping]);
  useHandleBackPressNew(handleBackPressAndroid);

  // Derived state
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

  const hasEnoughBalance =
    (fromAsset === 'BTC' && Number(fromAmount) <= Number(bitcoinBalance)) ||
    (fromAsset === 'USD' && Number(fromAmount) <= Number(dollarBalanceToken));

  const bitcoinBalanceIsAboveSwapLimit = bitcoinBalance >= swapLimits.bitcoin;
  const dollarBalanceIsAboveSwapLimit = dollarBalanceToken >= swapLimits.usd;

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
    isInitialMount.current = true;
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

  // ── History (inline, replaces ConversionHistory navigation) ─────────────────

  useEffect(() => {
    if (currentStep !== 'historyExpanded') return;
    if (finishedInitialHistoryLoad) return;
    loadSwapHistory();
  }, [currentStep]);

  const loadSwapHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const result = await getUserSwapHistory(currentWalletMnemoinc, 20);
      if (result.didWork) {
        setSwapHistory({ swaps: result.swaps, totalCount: result.totalCount });
      }
    } catch (err) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t(
          'screens.inAccount.swapHistory.loadingSwapHistoryError',
        ),
      });
    } finally {
      setIsLoadingHistory(false);
      setFinishedInitialHistoryLoad(true);
    }
  };

  const loadMoreHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const result = await getUserSwapHistory(
        currentWalletMnemoinc,
        20,
        swapHistory.swaps.length,
      );
      if (result.didWork) {
        setSwapHistory(prev => ({
          swaps: [...prev.swaps, ...result.swaps],
          totalCount: result.totalCount,
        }));
      }
    } catch (err) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t(
          'screens.inAccount.swapHistory.loadingSwapHistoryError',
        ),
      });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const formatDate = useCallback(timestamp => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const timeDifferenceMinutes = diffTime / (1000 * 60);
    const timeDifferenceHours = diffTime / (1000 * 60 * 60);
    const timeDifferenceDays = diffTime / (1000 * 60 * 60 * 24);
    const timeDifferenceYears = diffTime / (1000 * 60 * 60 * 24 * 365);
    return getTimeDisplay(
      timeDifferenceMinutes,
      timeDifferenceHours,
      timeDifferenceDays,
      timeDifferenceYears,
    );
  }, []);

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

  const backLabel = t('constants.back');
  const acceptLabel = t('constants.accept');

  const { shouldStack, containerProps, getLabelProps } =
    useAdaptiveButtonLayout([backLabel, acceptLabel]);

  const getAmountFontSize = amount => {
    if (!amount) return SIZES.large;
    const length = amount.toString().length;
    if (length <= 6) return SIZES.large;
    if (length <= 9) return SIZES.medium;
    if (length <= 12) return SIZES.smedium;
    if (length <= 15) return SIZES.small;
    return SIZES.xSmall;
  };

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
    if (!fromAmount) {
      navigateToStep('routeSelection', 'backwards');
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
    setIsSwapping(true);
    setError(null);

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
        navigateToStep('confirmation', 'forward');

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
    } finally {
      setIsSwapping(false);
    }
  };

  const confirmAnimation = useMemo(
    () =>
      updateConfirmAnimation(
        confirmTxAnimation,
        theme ? (darkModeType ? 'lightsOut' : 'dark') : 'light',
      ),
    [theme, darkModeType],
  );

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

  if (!dollarBalanceToken || !bitcoinBalance) {
    return (
      <View style={styles.container}>
        <NoContentSceen
          iconName="ArrowRightLeft"
          titleText={t('screens.inAccount.swapsPage.noContentTitle')}
          subTitleText={t('screens.inAccount.swapsPage.noContentSubTittle')}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.stepWrapper, stepAnimatedStyle]}>
        {/* ── Step 1: Route Selection ─────────────────────────────────── */}
        {currentStep === 'routeSelection' && (
          <>
            <View style={styles.stepContent}>
              {isLoadingPool && (
                <View style={styles.loadingContainer}>
                  <FullLoadingScreen
                    textStyles={styles.loadingText}
                    text={t('screens.inAccount.swapsPage.loadingPool')}
                  />
                </View>
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

              {!isLoadingPool && poolInfo && (
                <>
                  <ThemeText
                    styles={styles.stepTitle}
                    content={t(
                      'screens.inAccount.swapsPage.chooseCurrencyTitle',
                    )}
                  />

                  {/* BTC selection card */}
                  <TouchableOpacity
                    onPress={() => handleSelectFromAsset('BTC')}
                    activeOpacity={0.7}
                    disabled={!bitcoinBalanceIsAboveSwapLimit}
                    style={[
                      styles.selectionCard,
                      {
                        backgroundColor:
                          theme && darkModeType
                            ? backgroundColor
                            : backgroundOffset,
                        opacity: bitcoinBalanceIsAboveSwapLimit
                          ? 1
                          : HIDDEN_OPACITY,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.selectionIconContainer,
                        {
                          backgroundColor:
                            theme && darkModeType
                              ? backgroundOffset
                              : COLORS.bitcoinOrange,
                        },
                      ]}
                    >
                      <ThemeImage
                        styles={{ width: 25, height: 25 }}
                        lightModeIcon={ICONS.bitcoinIcon}
                        darkModeIcon={ICONS.bitcoinIcon}
                        lightsOutIcon={ICONS.bitcoinIcon}
                      />
                    </View>
                    <View style={styles.selectionTextContainer}>
                      <ThemeText
                        styles={styles.selectionAssetName}
                        content={t('constants.bitcoin_upper')}
                      />
                      <ThemeText
                        styles={styles.selectionBalance}
                        content={displayCorrectDenomination({
                          amount: btcBalance,
                          masterInfoObject: {
                            ...masterInfoObject,
                            userBalanceDenomination: 'sats',
                          },
                          fiatStats,
                          convertAmount: true,
                          forceCurrency: 'USD',
                        })}
                      />
                    </View>
                    <CheckMarkCircle
                      isActive={fromAsset === 'BTC'}
                      containerSize={25}
                      switchDarkMode={theme && !darkModeType}
                    />
                  </TouchableOpacity>

                  {/* USD selection card */}
                  <TouchableOpacity
                    onPress={() => handleSelectFromAsset('USD')}
                    activeOpacity={0.7}
                    disabled={!dollarBalanceIsAboveSwapLimit}
                    style={[
                      styles.selectionCard,
                      {
                        backgroundColor:
                          theme && darkModeType
                            ? backgroundColor
                            : backgroundOffset,
                        opacity: dollarBalanceIsAboveSwapLimit
                          ? 1
                          : HIDDEN_OPACITY,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.selectionIconContainer,
                        {
                          backgroundColor:
                            theme && darkModeType
                              ? backgroundOffset
                              : COLORS.dollarGreen,
                        },
                      ]}
                    >
                      <ThemeImage
                        styles={{ width: 25, height: 25 }}
                        lightModeIcon={ICONS.dollarIcon}
                        darkModeIcon={ICONS.dollarIcon}
                        lightsOutIcon={ICONS.dollarIcon}
                      />
                    </View>
                    <View style={styles.selectionTextContainer}>
                      <ThemeText
                        styles={styles.selectionAssetName}
                        content={t('constants.dollars_upper')}
                      />
                      <ThemeText
                        styles={styles.selectionBalance}
                        content={displayCorrectDenomination({
                          amount: formatBalanceAmount(
                            dollarBalanceToken,
                            false,
                            masterInfoObject,
                          ),
                          masterInfoObject: {
                            ...masterInfoObject,
                            userBalanceDenomination: 'fiat',
                          },
                          forceCurrency: 'USD',
                          convertAmount: false,
                        })}
                      />
                    </View>
                    <CheckMarkCircle
                      isActive={fromAsset === 'USD'}
                      containerSize={25}
                    />
                  </TouchableOpacity>

                  <View style={{ marginTop: 'auto' }} />

                  <TouchableOpacity
                    style={styles.historyButton}
                    onPress={() => navigateToStep('historyExpanded', 'forward')}
                    activeOpacity={0.7}
                  >
                    <ThemeIcon size={18} iconName={'History'} />
                    <ThemeText
                      styles={styles.historyButtonText}
                      content={t('screens.inAccount.swapHistory.pageTitle')}
                    />
                  </TouchableOpacity>

                  <CustomButton
                    buttonStyles={{
                      ...CENTER,
                      marginTop: 12,
                      opacity:
                        !bitcoinBalanceIsAboveSwapLimit &&
                        !dollarBalanceIsAboveSwapLimit
                          ? HIDDEN_OPACITY
                          : 1,
                    }}
                    textContent={t('constants.continue')}
                    actionFunction={() => {
                      if (
                        !bitcoinBalanceIsAboveSwapLimit &&
                        !dollarBalanceIsAboveSwapLimit
                      )
                        return;
                      navigateToStep('amountInput', 'forward');
                    }}
                  />
                </>
              )}
            </View>
          </>
        )}

        {/* ── History Expanded ────────────────────────────────────────── */}
        {currentStep === 'historyExpanded' && (
          <View style={[styles.stepContent, styles.historyContainer]}>
            <View style={styles.historyHeader}>
              <TouchableOpacity
                onPress={() => navigateToStep('routeSelection', 'backward')}
                activeOpacity={0.7}
                style={styles.backButton}
              >
                <ThemeIcon size={30} iconName={'ArrowLeft'} />
              </TouchableOpacity>
            </View>

            {!finishedInitialHistoryLoad ? (
              <FullLoadingScreen />
            ) : (
              <FlatList
                data={swapHistory.swaps}
                keyExtractor={item => item.id}
                renderItem={({ item }) => {
                  const isBtcToUsdSwap =
                    item.assetInAddress === BTC_ASSET_ADDRESS;
                  const formattedAmountOut = isBtcToUsdSwap
                    ? formatBalanceAmount(
                        item.amountOut / Math.pow(10, 6),
                        false,
                        masterInfoObject,
                      )
                    : item.amountOut;
                  const price = currentPriceAinBToPriceDollars(
                    item.price,
                  ).toFixed(2);
                  const date = formatDate(item.timestamp);

                  return (
                    <View
                      style={[
                        styles.transactionRow,
                        {
                          backgroundColor:
                            theme && darkModeType
                              ? backgroundColor
                              : backgroundOffset,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.iconContainer,
                          {
                            backgroundColor:
                              theme && darkModeType
                                ? backgroundOffset
                                : isBtcToUsdSwap
                                ? COLORS.bitcoinOrange
                                : COLORS.dollarGreen,

                            width: 42,
                            height: 42,
                            borderRadius: 26,
                            borderWidth: 2,
                            borderColor:
                              theme && darkModeType
                                ? backgroundColor
                                : backgroundOffset,
                            zIndex: 99,
                            marginRight: -5,
                          },
                        ]}
                      >
                        <ThemeImage
                          styles={{ width: 20, height: 20 }}
                          lightModeIcon={
                            isBtcToUsdSwap
                              ? ICONS.bitcoinIcon
                              : ICONS.dollarIcon
                          }
                          darkModeIcon={
                            isBtcToUsdSwap
                              ? ICONS.bitcoinIcon
                              : ICONS.dollarIcon
                          }
                          lightsOutIcon={
                            isBtcToUsdSwap
                              ? ICONS.bitcoinIcon
                              : ICONS.dollarIcon
                          }
                        />
                      </View>
                      <View
                        style={[
                          styles.iconContainer,
                          {
                            backgroundColor:
                              theme && darkModeType
                                ? backgroundOffset
                                : isBtcToUsdSwap
                                ? COLORS.dollarGreen
                                : COLORS.bitcoinOrange,
                            marginRight: 5,
                          },
                        ]}
                      >
                        <ThemeImage
                          styles={{ width: 20, height: 20 }}
                          lightModeIcon={
                            isBtcToUsdSwap
                              ? ICONS.dollarIcon
                              : ICONS.bitcoinIcon
                          }
                          darkModeIcon={
                            isBtcToUsdSwap
                              ? ICONS.dollarIcon
                              : ICONS.bitcoinIcon
                          }
                          lightsOutIcon={
                            isBtcToUsdSwap
                              ? ICONS.dollarIcon
                              : ICONS.bitcoinIcon
                          }
                        />
                      </View>
                      <View style={styles.transactionContent}>
                        <ThemeText
                          styles={styles.transactionTitle}
                          content={
                            isBtcToUsdSwap
                              ? t(
                                  'screens.inAccount.swapsPage.swapDirection_btcusd',
                                )
                              : t(
                                  'screens.inAccount.swapsPage.swapDirection_usdbtc',
                                )
                          }
                        />
                        <ThemeText
                          styles={styles.transactionSubtext}
                          content={date}
                        />
                      </View>
                      <View style={styles.amountContainer}>
                        <ThemeText
                          styles={styles.amountText}
                          content={displayCorrectDenomination({
                            amount: formattedAmountOut,
                            fiatStats,
                            masterInfoObject: {
                              ...masterInfoObject,
                              userBalanceDenomination: isBtcToUsdSwap
                                ? 'fiat'
                                : 'sats',
                            },
                            convertAmount: !isBtcToUsdSwap,
                            forceCurrency: 'USD',
                          })}
                        />
                        <ThemeText
                          styles={styles.transactionSubtext}
                          content={`${APPROXIMATE_SYMBOL}${displayCorrectDenomination(
                            {
                              amount: price,
                              fiatStats,
                              masterInfoObject: {
                                ...masterInfoObject,
                                userBalanceDenomination: 'fiat',
                              },
                              convertAmount: false,
                              forceCurrency: 'USD',
                            },
                          )}`}
                        />
                      </View>
                    </View>
                  );
                }}
                ListEmptyComponent={
                  <NoContentSceen
                    iconName="ArrowUpDown"
                    titleText={t(
                      'screens.inAccount.swapHistory.noHisotorytitle',
                    )}
                    subTitleText={t(
                      'screens.inAccount.swapHistory.noHisotorydesc',
                    )}
                  />
                }
                ListFooterComponent={
                  swapHistory.swaps.length < swapHistory.totalCount ? (
                    <View style={styles.footerContainer}>
                      <CustomButton
                        useLoading={isLoadingHistory}
                        textContent={t('constants.loadMore')}
                        disabled={isLoadingHistory}
                        actionFunction={loadMoreHistory}
                      />
                    </View>
                  ) : null
                }
                contentContainerStyle={
                  swapHistory.totalCount === 0
                    ? styles.emptyListContainer
                    : styles.historyList
                }
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        )}

        {/* ── Step 2: Amount Input ────────────────────────────────────── */}
        {currentStep === 'amountInput' && (
          <>
            <View style={styles.stepContent}>
              <ScrollView
                contentContainerStyle={{ paddingBottom: 20 }}
                showsVerticalScrollIndicator={false}
              >
                {/* Amount display card — from row + divider + to row */}
                <View
                  style={[
                    styles.amountDisplayCard,
                    {
                      backgroundColor:
                        theme && darkModeType
                          ? backgroundColor
                          : backgroundOffset,
                    },
                  ]}
                >
                  {/* From row */}
                  <TouchableOpacity
                    style={[
                      styles.amountRow,
                      {
                        opacity:
                          lastEditedField === 'from' ? 1 : HIDDEN_OPACITY,
                      },
                    ]}
                    onPress={() => handleInputPress('from')}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.amountRowIcon,
                        {
                          backgroundColor:
                            theme && darkModeType
                              ? backgroundOffset
                              : fromAsset === 'BTC'
                              ? COLORS.bitcoinOrange
                              : COLORS.dollarGreen,
                        },
                      ]}
                    >
                      {fromAsset === 'BTC' ? (
                        <ThemeImage
                          styles={{ width: 18, height: 18 }}
                          lightModeIcon={ICONS.bitcoinIcon}
                          darkModeIcon={ICONS.bitcoinIcon}
                          lightsOutIcon={ICONS.bitcoinIcon}
                        />
                      ) : (
                        <ThemeImage
                          styles={{ width: 18, height: 18 }}
                          lightModeIcon={ICONS.dollarIcon}
                          darkModeIcon={ICONS.dollarIcon}
                          lightsOutIcon={ICONS.dollarIcon}
                        />
                      )}
                    </View>
                    <Animated.Text
                      style={[
                        styles.amountRowText,
                        {
                          color: theme
                            ? COLORS.darkModeText
                            : COLORS.lightModeText,
                        },
                        fromAmountAnimatedStyle,
                      ]}
                    >
                      {displayCorrectDenomination({
                        amount: fromAmount || 0,
                        masterInfoObject: {
                          ...masterInfoObject,
                          userBalanceDenomination:
                            fromAsset === 'BTC' ? 'sats' : 'fiat',
                        },
                        fiatStats,
                        convertAmount: fromAsset === 'BTC',
                        forceCurrency: 'USD',
                      })}
                    </Animated.Text>
                    <ThemeText
                      styles={styles.amountRowCurrency}
                      content={fromAssetLabel}
                    />
                  </TouchableOpacity>

                  <View
                    style={[
                      styles.amountRowDivider,
                      {
                        backgroundColor:
                          theme && darkModeType
                            ? backgroundOffset
                            : backgroundColor,
                      },
                    ]}
                  />

                  {/* To row */}
                  <TouchableOpacity
                    style={[
                      styles.amountRow,
                      {
                        opacity: lastEditedField === 'to' ? 1 : HIDDEN_OPACITY,
                      },
                    ]}
                    onPress={() => handleInputPress('to')}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.amountRowIcon,
                        {
                          backgroundColor:
                            theme && darkModeType
                              ? backgroundOffset
                              : toAsset === 'BTC'
                              ? COLORS.bitcoinOrange
                              : COLORS.dollarGreen,
                        },
                      ]}
                    >
                      {toAsset === 'BTC' ? (
                        <ThemeImage
                          styles={{ width: 18, height: 18 }}
                          lightModeIcon={ICONS.bitcoinIcon}
                          darkModeIcon={ICONS.bitcoinIcon}
                          lightsOutIcon={ICONS.bitcoinIcon}
                        />
                      ) : (
                        <ThemeImage
                          styles={{ width: 18, height: 18 }}
                          lightModeIcon={ICONS.dollarIcon}
                          darkModeIcon={ICONS.dollarIcon}
                          lightsOutIcon={ICONS.dollarIcon}
                        />
                      )}
                    </View>
                    {isSimulating ? (
                      <FullLoadingScreen
                        showText={false}
                        containerStyles={{ flex: 0, marginRight: 'auto' }}
                        size="small"
                      />
                    ) : (
                      <Animated.Text
                        style={[
                          styles.amountRowText,
                          {
                            color: theme
                              ? COLORS.darkModeText
                              : COLORS.lightModeText,
                          },
                          toAmountAnimatedStyle,
                        ]}
                      >
                        {`${APPROXIMATE_SYMBOL}${displayCorrectDenomination({
                          amount: toAmount || 0,
                          masterInfoObject: {
                            ...masterInfoObject,
                            userBalanceDenomination:
                              toAsset === 'BTC' ? 'sats' : 'fiat',
                          },
                          fiatStats,
                          convertAmount: toAsset === 'BTC',
                          forceCurrency: 'USD',
                        })}`}
                      </Animated.Text>
                    )}
                    <ThemeText
                      styles={styles.amountRowCurrency}
                      content={toAssetLabel}
                    />
                  </TouchableOpacity>
                </View>

                {/* Quick-select % pills */}
                <View style={styles.pillRow}>
                  {[
                    { label: '25%', value: '25', pct: 0.25 },
                    { label: '50%', value: '50', pct: 0.5 },
                    { label: '75%', value: '75', pct: 0.75 },
                    { label: '100%', value: '100', pct: 1 },
                  ].map(btn => (
                    <TouchableOpacity
                      key={btn.value}
                      style={[
                        styles.pill,
                        {
                          backgroundColor:
                            activePercentage === btn.value
                              ? theme && darkModeType
                                ? COLORS.darkModeText
                                : COLORS.primary
                              : theme && darkModeType
                              ? backgroundColor
                              : backgroundOffset,
                        },
                      ]}
                      onPress={() => {
                        isPillPressRef.current = true;
                        setActivePercentage(btn.value);
                        setPercentage(btn.pct);
                      }}
                      activeOpacity={0.7}
                      disabled={isSwapping || isLoadingPool}
                    >
                      <ThemeText
                        styles={[
                          styles.pillText,
                          {
                            color:
                              activePercentage === btn.value
                                ? theme && darkModeType
                                  ? COLORS.lightModeText
                                  : COLORS.darkModeText
                                : textColor,
                          },
                        ]}
                        content={btn.label}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <View style={{ marginTop: 'auto' }} />

              <HandleKeyboardRender
                lastEditedField={lastEditedField}
                fromAsset={fromAsset}
                toAsset={toAsset}
                handleKeyboardInput={handleKeyboardInput}
                fromAmount={fromAmount}
                toAmount={toAmount}
              />

              <CustomButton
                buttonStyles={{
                  ...CENTER,
                  opacity: canProceed ? 1 : HIDDEN_OPACITY,
                }}
                disabled={isSwapping || isLoadingPool || isSimulating}
                useLoading={isSwapping || isLoadingPool || isSimulating}
                textContent={
                  fromAmount ? t('constants.review') : t('constants.back')
                }
                actionFunction={executeSwapAction}
              />
              <ThemeText
                styles={styles.disclaimer}
                content={t('screens.inAccount.swapsPage.swapDisclaimer')}
              />
            </View>
          </>
        )}

        {/* ── Step 3: Review ──────────────────────────────────────────── */}
        {currentStep === 'review' && (
          <>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.reviewScroll}
            >
              <View style={[styles.cardContainer, { marginBottom: 20 }]}>
                <View
                  style={[
                    styles.card,
                    {
                      backgroundColor:
                        theme && darkModeType
                          ? backgroundColor
                          : backgroundOffset,
                    },
                  ]}
                >
                  <View style={[styles.cardHeader, { marginBottom: 5 }]}>
                    <ThemeText
                      styles={styles.label}
                      content={t(
                        'screens.inAccount.swapsPage.yourAreConverting',
                      )}
                    />
                  </View>
                  <View style={styles.assetRow}>
                    <ThemeText
                      styles={[styles.reviewAmount, { fontSize: SIZES.large }]}
                      content={displayCorrectDenomination({
                        amount: fromAmount || 0,
                        masterInfoObject: {
                          ...masterInfoObject,
                          userBalanceDenomination:
                            fromAsset === 'BTC' ? 'sats' : 'fiat',
                        },
                        fiatStats,
                        convertAmount: fromAsset === 'BTC',
                        forceCurrency: 'USD',
                      })}
                    />
                  </View>
                </View>

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
                      backgroundColor:
                        theme && darkModeType
                          ? backgroundColor
                          : backgroundOffset,
                    },
                  ]}
                >
                  <View style={[styles.cardHeader, { marginBottom: 5 }]}>
                    <ThemeText
                      styles={styles.label}
                      content={t('screens.inAccount.swapsPage.youWillReceive')}
                    />
                  </View>
                  <View style={styles.assetRow}>
                    <ThemeText
                      styles={[styles.reviewAmount, { fontSize: SIZES.large }]}
                      content={displayCorrectDenomination({
                        amount: toAmount || 0,
                        masterInfoObject: {
                          ...masterInfoObject,
                          userBalanceDenomination:
                            toAsset === 'BTC' ? 'sats' : 'fiat',
                        },
                        fiatStats,
                        convertAmount: toAsset === 'BTC',
                        forceCurrency: 'USD',
                      })}
                    />
                  </View>
                </View>
              </View>

              {/* Rate card */}
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor:
                      theme && darkModeType
                        ? backgroundColor
                        : backgroundOffset,
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
                    content={reviewExchangeRate}
                  />
                </View>
                <View
                  style={{
                    width: '100%',
                    height: 1,
                    backgroundColor:
                      theme && darkModeType
                        ? backgroundOffset
                        : backgroundColor,
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
                    content={`${APPROXIMATE_SYMBOL} ${reviewFormattedBitcoinPrice}`}
                  />
                </View>
              </View>

              {/* Fee card */}
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor:
                      theme && darkModeType
                        ? backgroundColor
                        : backgroundOffset,
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
                    content={`${APPROXIMATE_SYMBOL} ${reviewFormattedFee}`}
                  />
                </View>
              </View>

              {/* Slippage card */}
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor:
                      theme && darkModeType
                        ? backgroundColor
                        : backgroundOffset,
                    marginBottom: 'auto',
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
                    globalContainerStyles={{ width: 'unset', flexShrink: 1 }}
                    onSelect={handleDropdownToggle}
                    showVerticalArrowsAbsolute={true}
                    customButtonStyles={{
                      width: 'unset',
                      minWidth: 'unset',
                      flex: 0,
                      marginLeft: 'auto',
                      backgroundColor:
                        theme && darkModeType
                          ? backgroundOffset
                          : theme
                          ? backgroundColor
                          : COLORS.darkModeText,
                    }}
                    showClearIcon={false}
                  />
                </View>
              </View>
            </ScrollView>
            <View
              {...containerProps}
              style={[
                styles.buttonRow,
                shouldStack ? styles.containerStacked : styles.containerRow,
              ]}
            >
              <CustomButton
                actionFunction={() => navigateToStep('amountInput', 'backward')}
                buttonStyles={[
                  {
                    opacity: isSwapping ? HIDDEN_OPACITY : 1,
                  },
                  shouldStack ? styles.buttonStacked : styles.buttonColumn,
                ]}
                enableElipsis={false}
                {...getLabelProps(0)}
                textContent={backLabel}
                disabled={isSwapping}
              />

              <CustomButton
                useLoading={isSwapping}
                buttonStyles={[
                  shouldStack ? styles.buttonStacked : styles.buttonColumn,
                ]}
                {...getLabelProps(1)}
                enableElipsis={false}
                actionFunction={handleAcceptReview}
                textContent={acceptLabel}
              />
            </View>
            <ThemeText
              styles={styles.disclaimer}
              content={t('screens.inAccount.swapsPage.swapDisclaimer')}
            />
          </>
        )}

        {/* ── Step 4: Confirmation ────────────────────────────────────── */}
        {currentStep === 'confirmation' && (
          <>
            <View style={[styles.stepContent, styles.confirmContainer]}>
              <LottieView
                source={confirmAnimation}
                loop={false}
                autoPlay={true}
                style={{
                  width: 100,
                  height: 100,
                }}
              />
              <ThemeText
                styles={{ fontSize: SIZES.xLarge, marginBottom: 8 }}
                content={t('screens.inAccount.swapsPage.swapConfimred')}
              />
              <View style={styles.confirmButtons}>
                <CustomButton
                  buttonStyles={{
                    width: INSET_WINDOW_WIDTH,
                    backgroundColor: theme
                      ? COLORS.darkModeText
                      : COLORS.primary,
                    ...CENTER,
                  }}
                  textStyles={{
                    color: theme ? COLORS.lightModeText : COLORS.darkModeText,
                  }}
                  actionFunction={handleBackPressFunction}
                  textContent={t('constants.done')}
                />
                <CustomButton
                  buttonStyles={{
                    width: INSET_WINDOW_WIDTH,
                    backgroundColor: 'transparent',
                    ...CENTER,
                  }}
                  textStyles={{ color: textColor }}
                  actionFunction={() => {
                    clearPageStates();
                    navigateToStep('routeSelection', 'backward');
                  }}
                  textContent={t('screens.inAccount.swapsPage.newSwap')}
                />
              </View>
            </View>
          </>
        )}
      </Animated.View>
    </View>
  );
}

// ── SwapModalNavbar — back chevron + iOS-style breadcrumb label ──────────────

function SwapModalNavbar({ onBack, backLabel }) {
  return (
    <View style={styles.navbar}>
      <TouchableOpacity
        onPress={onBack}
        style={styles.navbarBackBtn}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.7}
      >
        <ThemeIcon iconName="ArrowLeft" />
        {/* {backLabel ? (
          <ThemeText styles={styles.navbarLabel} content={backLabel} />
        ) : null} */}
      </TouchableOpacity>
    </View>
  );
}

// ── HandleKeyboardRender (migrated verbatim from SwapsPage) ──────────────────

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

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stepWrapper: {
    flex: 1,
  },
  stepContent: {
    flex: 1,
    paddingHorizontal: 16,
    // paddingTop: 16,
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
  card: {
    width: '100%',
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
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    position: 'absolute',
    zIndex: 10,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    ...CENTER,
  },
  historyButtonText: {
    fontSize: SIZES.smedium,
    opacity: HIDDEN_OPACITY,
    includeFontPadding: false,
  },
  historyContainer: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    // paddingTop: 16,
    paddingBottom: 16,
  },
  backButton: {
    marginRight: 8,
  },
  historyTitle: {
    fontSize: SIZES.large,
    fontWeight: '500',
    includeFontPadding: false,
  },
  historyList: {
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  transactionRow: {
    width: WINDOWWIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 10,
    ...CENTER,
    borderRadius: 8,
  },
  transactionContent: {
    flex: 1,
    justifyContent: 'center',
    marginLeft: 5,
  },
  transactionTitle: {
    marginBottom: 2,
    includeFontPadding: false,
  },
  transactionSubtext: {
    fontSize: SIZES.small,
    opacity: HIDDEN_OPACITY,
    includeFontPadding: false,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amountText: {
    marginBottom: 2,
    includeFontPadding: false,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: SIZES.large,
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: SIZES.smedium,
    opacity: HIDDEN_OPACITY,
    textAlign: 'center',
  },
  footerContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  // ── Navbar ───────────────────────────────────────────────────────────────
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
  // ── Step shared ───────────────────────────────────────────────────────────
  stepTitle: {
    fontWeight: '500',
    fontSize: SIZES.large,
    marginBottom: 20,
    includeFontPadding: false,
  },
  // ── Step 1 selection cards ────────────────────────────────────────────────
  selectionCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    // borderWidth: 2,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  selectionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionTextContainer: {
    flex: 1,
    marginLeft: 14,
  },
  selectionAssetName: {
    fontWeight: '500',
    fontSize: SIZES.large,
    includeFontPadding: false,
  },
  selectionBalance: {
    opacity: 0.7,
    includeFontPadding: false,
  },
  // ── Step 2 amount display ─────────────────────────────────────────────────
  amountDisplayCard: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 14,
    gap: 10,
  },
  amountRowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  amountRowText: {
    flex: 1,
    fontWeight: '500',
    includeFontPadding: false,
  },
  amountRowCurrency: {
    fontSize: SIZES.smedium,
    opacity: HIDDEN_OPACITY,
    includeFontPadding: false,
  },
  amountRowDivider: {
    height: 1,
    marginHorizontal: 14,
  },
  // ── Step 2 percentage pills ───────────────────────────────────────────────
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  pill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
  },
  pillText: {
    fontSize: SIZES.small,
    fontWeight: '500',
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
  reviewScroll: {
    flexGrow: 1,
    paddingHorizontal: 16,
    // paddingTop: 16,
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
  confirmContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtons: {
    marginTop: 'auto',
    width: '100%',
  },

  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: CONTENT_KEYBOARD_OFFSET,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  containerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  containerStacked: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
  },
  buttonStacked: {
    width: '100%',
  },
  buttonColumn: {
    flex: 1,
  },
});
