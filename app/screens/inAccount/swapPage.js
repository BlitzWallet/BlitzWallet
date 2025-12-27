import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { Bitcoin, DollarSign, ArrowDownUp } from 'lucide-react-native';
import { CENTER, COLORS, ICONS, SIZES, USDB_TOKEN_ID } from '../../constants';
import { HIDDEN_OPACITY, INSET_WINDOW_WIDTH } from '../../constants/theme';
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
  executeSwap,
  swapBitcoinToToken,
  swapTokenToBitcoin,
  checkSwapViability,
  handleFlashnetError,
  BTC_ASSET_ADDRESS,
  USD_ASSET_ADDRESS,
  requestManualClawback,
  listClawbackableTransfers,
} from '../../functions/spark/flashnet';

import { useActiveCustodyAccount } from '../../../context-store/activeAccount';
import useDebounce from '../../hooks/useDebounce';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { updateConfirmAnimation } from '../../functions/lottieViewColorTransformer';
import LottieView from 'lottie-react-native';
import { useAppStatus } from '../../../context-store/appStatus';
import {
  SPARK_TX_UPDATE_ENVENT_NAME,
  sparkTransactionsEventEmitter,
} from '../../functions/spark/transactions';
import ThemeImage from '../../functions/CustomElements/themeImage';
import FullLoadingScreen from '../../functions/CustomElements/loadingScreen';
import CustomNumberKeyboard from '../../functions/CustomElements/customNumberKeyboard';
import { formatBalanceAmount } from '../../functions';
import customUUID from '../../functions/customUUID';

const confirmTxAnimation = require('../../assets/confirmTxAnimation.json');

export default function SwapsPage() {
  const navigate = useNavigation();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { sparkInformation, USD_BALANCE } = useSparkWallet();
  const { screenDimensions } = useAppStatus();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats, SATS_PER_DOLLAR } = useNodeContext();
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
  const animationRef = useRef(null);

  // Animated values for font sizes
  const fromAmountFontSize = useSharedValue(SIZES.xxLarge);
  const toAmountFontSize = useSharedValue(SIZES.xxLarge);
  const fromAmountScale = useSharedValue(1);
  const toAmountScale = useSharedValue(1);
  const fromAmountOpacity = useSharedValue(1);
  const toAmountOpacity = useSharedValue(1);
  const isInitialMount = useRef(true);
  const currentRequetId = useRef(null);
  const lastSimulatedAmount = useRef(null);

  // Get balances
  const tokenInformation = sparkInformation?.tokens?.[USDB_TOKEN_ID];
  const usdBalance = USD_BALANCE;
  const btcBalance = sparkInformation?.balance || 0;

  const convertedFromAmount =
    fromAsset === 'BTC' ? fromAmount : fromAmount * SATS_PER_DOLLAR;

  const displayBalance =
    fromAsset === 'BTC' ? btcBalance : usdBalance * SATS_PER_DOLLAR;

  const executionPrice =
    lastEditedField === 'from'
      ? fromAsset === 'BTC'
        ? simulationResult?.executionPrice
        : simulationResult?.executionPrice * 1000000
      : fromAsset === 'BTC'
      ? simulationResult?.executionPrice * 1000000
      : simulationResult?.executionPrice;

  // Load pool information on mount
  useEffect(() => {
    loadPoolInfo();
  }, []);

  const clearPageStates = () => {
    setFromAmount('');
    setToAmount('');
    setSimulationResult(null);
    setPriceImpact(null);
    setError(null);
    setLastEditedField('from');
    setShowKeyboard(false);
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
        console.log('✓ Found BTC/USDB pool:', {
          poolId: result.pool.lpPublicKey,
          tvl: result.pool.tvlAssetB,
          volume24h: result.pool.volume24hAssetB,
        });
      } else {
        setError(
          result.error || t('screens.inAccount.swapsPage.noPoolFoundBackup'),
        );
      }
    } catch (err) {
      console.error('Load pool info error:', err);
      setError(t('screens.inAccount.swapsPage.loadPoolError'));
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
          setError(
            t('screens.inAccount.swapsPage.highPriceImpact', {
              priceImpact: result.simulation.priceImpact,
            }),
          );
        }
      } else {
        const errorInfo = handleFlashnetError(result.details);
        setError(
          errorInfo.message ||
            result.error ||
            t('screens.inAccount.swapsPage.failedSimulation'),
        );
        if (isForwardDirection) {
          setToAmount('0');
        } else {
          setFromAmount('0');
        }
      }
    } catch (err) {
      console.error('Simulate swap error:', err);
      setError(t('screens.inAccount.swapsPage.swapAmountCalculatorFailed'));
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

    setLastEditedField(lastEditedField === 'from' ? 'to' : 'from');
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

  const setPercentage = percent => {
    const balance = fromAsset === 'BTC' ? btcBalance : usdBalance;
    const amount = (balance * percent).toString();

    setFromAmount(amount);
    setLastEditedField('from');
  };

  const handleInputPress = direction => {
    setLastEditedField(direction);
    setShowKeyboard(true);
  };

  const handleKeyboardInput = value => {
    if (lastEditedField === 'from') {
      handleFromAmountChange(value, 'from');
    } else {
      handleFromAmountChange(value, 'to');
    }
  };

  const dismissKeyboard = () => {
    setShowKeyboard(false);
  };

  // Calculate dynamic font size based on text length
  const getAmountFontSize = amount => {
    if (!amount) return SIZES.xxLarge;

    const length = amount.toString().length;

    if (length <= 6) return SIZES.xxLarge;
    if (length <= 9) return SIZES.xLarge;
    if (length <= 12) return SIZES.large;
    if (length <= 15) return SIZES.medium;
    return SIZES.smedium;
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
          })
        : await swapTokenToBitcoin(currentWalletMnemoinc, {
            tokenAddress: USD_ASSET_ADDRESS,
            tokenAmount: amountInSmallestUnits,
            poolId: poolInfo.lpPublicKey,
          });

      if (result.didWork && result.swap) {
        const realReceivedAmount = isBtcToUsdb
          ? (parseFloat(result.swap.amountOut) / Math.pow(10, decimals)) *
            SATS_PER_DOLLAR
          : parseFloat(result.swap.amountOut).toFixed(0);
        const realFeeAmount = Math.round(
          (parseFloat(result.swap.feeAmount) / Math.pow(10, decimals)) *
            SATS_PER_DOLLAR,
        );
        setConfirmedSwap({ ...result.swap, realReceivedAmount, realFeeAmount });
        sparkTransactionsEventEmitter.emit(
          SPARK_TX_UPDATE_ENVENT_NAME,
          'fullUpdate',
        );
        requestAnimationFrame(() => {
          animationRef.current?.play();
        });
      } else {
        const errorInfo = handleFlashnetError(result.details);

        let errorMessage =
          errorInfo.userMessage ||
          result.error ||
          t('screens.inAccount.swapsPage.swapFailedBackupError');

        if (errorInfo.clawback) {
          if (errorInfo.clawback.allRecovered) {
            errorMessage += t(
              'screens.inAccount.swapsPage.swapAutomaticRecovery',
            );
          } else if (errorInfo.clawback.partialRecovered) {
            errorMessage += t(
              'screens.inAccount.swapsPage.swapPartialRecovery',
              { count: errorInfo.clawback.recoveredCount },
            );
          }
        } else if (errorInfo.autoRefund) {
          errorMessage += t('screens.inAccount.swapsPage.swapFutureRecovery');
        }

        if (errorInfo.type === 'slippage') {
          errorMessage += t('screens.inAccount.swapsPage.swapSlippageError');
        } else if (errorInfo.type === 'insufficient_liquidity') {
          errorMessage += t('screens.inAccount.swapsPage.swapLiquidityError');
        }

        navigate.navigate('errorScreen', { errorMessage: errorMessage });
        setError(errorInfo.userMessage || result.error);
      }
    } catch (err) {
      console.error('Execute swap error:', err);
      navigate.navigate('errorScreen', {
        errorMessage: t('screens.inAccount.swapsPage.fullSwapError'),
      });
      setError(t('screens.inAccount.swapsPage.fullSwapError'));
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
      error.includes(t('screens.inAccount.swapsPage.checkSwapMessage')));

  if (confirmedSwap) {
    const isBtcToUsdb = fromAsset === 'BTC';

    return (
      <GlobalThemeView useStandardWidth={true} styles={styles.globalContainer}>
        <CustomSettingsTopBar />
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: 'center',
          }}
        >
          <LottieView
            ref={animationRef}
            source={confirmAnimation}
            loop={false}
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

          {/* Main Details Card */}
          <View style={styles.detailsCard}>
            {/* You Sent Section */}
            <View
              style={[
                styles.card,
                {
                  alignItems: 'center',
                  backgroundColor: theme
                    ? backgroundOffset
                    : COLORS.darkModeText,
                },
              ]}
            >
              <ThemeText
                styles={styles.detailLabel}
                content={t('screens.inAccount.swapsPage.youSent')}
              />
              <ThemeText
                styles={styles.detailAmount}
                content={displayCorrectDenomination({
                  amount: convertedFromAmount,
                  masterInfoObject: {
                    ...masterInfoObject,
                    userBalanceDenomination: !isBtcToUsdb ? 'fiat' : 'sats',
                  },
                  fiatStats,
                  forceCurrency: 'USD',
                })}
              />
            </View>

            {/* Divider with Arrow */}
            <View
              style={[
                styles.dividerContainer,
                {
                  backgroundColor:
                    theme && darkModeType
                      ? COLORS.darkModeText
                      : COLORS.primary,
                },
              ]}
            >
              <ThemeImage
                styles={{ transform: [{ rotate: '-90deg' }] }}
                lightModeIcon={ICONS.arrow_small_left_white}
                darkModeIcon={ICONS.arrow_small_left_white}
                lightsOutIcon={ICONS.arrow_small_left_black}
              />
            </View>

            {/* You Received Section */}
            <View
              style={[
                styles.card,
                {
                  alignItems: 'center',
                  backgroundColor: theme
                    ? backgroundOffset
                    : COLORS.darkModeText,
                },
              ]}
            >
              <ThemeText
                styles={styles.detailLabel}
                content={t('screens.inAccount.swapsPage.youReceived')}
              />
              <ThemeText
                styles={styles.detailAmount}
                content={displayCorrectDenomination({
                  amount: confirmedSwap.realReceivedAmount,
                  masterInfoObject: {
                    ...masterInfoObject,
                    userBalanceDenomination: isBtcToUsdb ? 'fiat' : 'sats',
                  },
                  fiatStats,
                  forceCurrency: 'USD',
                })}
              />
            </View>
          </View>
          {/* Transaction Details */}
          <View
            style={[
              styles.transactionDetails,
              { borderTopColor: backgroundOffset },
            ]}
          >
            {!!confirmedSwap.realFeeAmount && (
              <View style={styles.detailRow}>
                <ThemeText
                  CustomNumberOfLines={1}
                  styles={styles.detailRowLabel}
                  content={t('constants.fee')}
                />
                <ThemeText
                  styles={styles.detailRowValue}
                  content={displayCorrectDenomination({
                    amount: confirmedSwap.realFeeAmount,
                    masterInfoObject,
                    fiatStats,
                  })}
                />
              </View>
            )}
          </View>

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

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        <Pressable
          style={{ flexGrow: 1, alignItems: 'center' }}
          onPress={dismissKeyboard}
        >
          <View style={styles.contentWrapper}>
            {isLoadingPool && (
              <View style={styles.loadingContainer}>
                <FullLoadingScreen
                  textStyles={styles.loadingText}
                  text={t('screens.inAccount.swapsPage.loadingPool')}
                />
              </View>
            )}

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
                      <ThemeText
                        styles={styles.label}
                        content={t('screens.inAccount.swapsPage.fromBalance', {
                          amount: displayCorrectDenomination({
                            amount: displayBalance,
                            masterInfoObject: {
                              ...masterInfoObject,
                              userBalanceDenomination:
                                fromAsset === 'BTC' ? 'sats' : 'fiat',
                            },
                            forceCurrency: 'USD',
                            fiatStats,
                          }),
                        })}
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
                          style={[styles.iconContainer, { backgroundColor }]}
                        >
                          {fromAsset === 'BTC' ? (
                            <Bitcoin
                              color={
                                theme
                                  ? COLORS.darkModeText
                                  : COLORS.lightModeText
                              }
                            />
                          ) : (
                            <DollarSign
                              size={24}
                              color={
                                theme
                                  ? COLORS.darkModeText
                                  : COLORS.lightModeText
                              }
                            />
                          )}
                        </View>
                        <ThemeText
                          styles={styles.assetText}
                          content={fromAsset}
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
                          ) || '0'}
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
                    <ArrowDownUp
                      size={22}
                      color={
                        theme && darkModeType
                          ? COLORS.lightModeText
                          : COLORS.darkModeText
                      }
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
                          style={[styles.iconContainer, { backgroundColor }]}
                        >
                          {fromAsset !== 'BTC' ? (
                            <Bitcoin
                              color={
                                theme
                                  ? COLORS.darkModeText
                                  : COLORS.lightModeText
                              }
                            />
                          ) : (
                            <DollarSign
                              size={24}
                              color={
                                theme
                                  ? COLORS.darkModeText
                                  : COLORS.lightModeText
                              }
                            />
                          )}
                        </View>
                        <ThemeText
                          styles={styles.assetText}
                          content={toAsset}
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
                          ) || '0'}
                        </Animated.Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                <View style={styles.quickButtons}>
                  <TouchableOpacity
                    style={[
                      styles.quickButton,
                      { backgroundColor: backgroundOffset },
                    ]}
                    onPress={() => setPercentage(0.25)}
                    activeOpacity={0.7}
                    disabled={isSwapping || isLoadingPool}
                  >
                    <ThemeText
                      styles={styles.quickButtonText}
                      content={t('screens.inAccount.swapsPage.min')}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.quickButton,
                      { backgroundColor: backgroundOffset },
                    ]}
                    onPress={() => setPercentage(0.5)}
                    activeOpacity={0.7}
                    disabled={isSwapping || isLoadingPool}
                  >
                    <ThemeText
                      styles={styles.quickButtonText}
                      content={t('screens.inAccount.swapsPage.half')}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.quickButton,
                      { backgroundColor: backgroundOffset },
                    ]}
                    onPress={() => setPercentage(1)}
                    activeOpacity={0.7}
                    disabled={isSwapping || isLoadingPool}
                  >
                    <ThemeText
                      styles={styles.quickButtonText}
                      content={t('screens.inAccount.swapsPage.max')}
                    />
                  </TouchableOpacity>
                </View>

                {error && (
                  <View
                    style={[
                      styles.errorContainer,
                      {
                        backgroundColor:
                          theme && darkModeType
                            ? backgroundOffset
                            : COLORS.primary,
                      },
                    ]}
                  >
                    <ThemeImage
                      styles={{ width: 22, height: 22 }}
                      lightModeIcon={ICONS.warningWhite}
                      darkModeIcon={ICONS.warningWhite}
                      lightsOutIcon={ICONS.warningWhite}
                    />
                    <ThemeText styles={styles.errorText} content={error} />
                  </View>
                )}
                <View style={{ marginTop: 'auto' }} />

                {!showKeyboard && (
                  <>
                    <CustomButton
                      buttonStyles={{
                        marginTop: 20,
                        opacity: canSwap ? 1 : 0.5,
                      }}
                      textContent={
                        isSwapping
                          ? t(
                              'screens.inAccount.swapsPage.swappingMessageButton',
                            )
                          : isLoadingPool
                          ? t(
                              'screens.inAccount.swapsPage.loadingMessageButton',
                            )
                          : t('screens.inAccount.swapsPage.swapMessageButton', {
                              fromAsset,
                              toAsset,
                            })
                      }
                      actionFunction={executeSwapAction}
                      disabled={!canSwap}
                    />

                    <ThemeText
                      styles={styles.disclaimer}
                      content={t('screens.inAccount.swapsPage.swapDisclaimer')}
                    />
                  </>
                )}
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
        </Pressable>
      </ScrollView>

      {showKeyboard && (
        <HandleKeyboardRender
          lastEditedField={lastEditedField}
          fromAsset={fromAsset}
          toAsset={toAsset}
          handleKeyboardInput={handleKeyboardInput}
          fromAmount={fromAmount}
          toAmount={toAmount}
        />
      )}
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
    if (
      lastEditedField === 'from' &&
      fromAmountRef.current !== amountRef.current
    ) {
      setAmount(fromAmountRef.current);
    } else if (
      lastEditedField === 'to' &&
      toAmountRef.current !== amountRef.current
    ) {
      setAmount(toAmountRef.current);
    }
  }, [lastEditedField]);

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
  scrollContainer: { flexGrow: 1, paddingTop: 20 },
  contentWrapper: {
    width: INSET_WINDOW_WIDTH,
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
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  label: {
    fontSize: SIZES.smedium,
    opacity: HIDDEN_OPACITY,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  assetText: {
    fontSize: SIZES.large,
    fontWeight: '500',
  },
  amountInput: {
    fontWeight: '500',
    textAlign: 'right',
    minWidth: 100,
    color: COLORS.lightModeText,
  },
  cardContainer: {
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  swapButton: {
    width: 52,
    height: 52,
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
    marginTop: 8,
  },
  quickButton: {
    flex: 1,
    backgroundColor: COLORS.white,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  quickButtonText: {
    fontSize: SIZES.smedium,
    fontWeight: '500',
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
    gap: 15,
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
});
