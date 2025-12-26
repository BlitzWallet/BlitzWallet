import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import { Bitcoin, DollarSign, ArrowDownUp } from 'lucide-react-native';
import { CENTER, COLORS, ICONS, SIZES, USDB_TOKEN_ID } from '../../constants';
import { HIDDEN_OPACITY, WINDOWWIDTH } from '../../constants/theme';
import {
  CustomKeyboardAvoidingView,
  GlobalThemeView,
  ThemeText,
} from '../../functions/CustomElements';
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

const confirmTxAnimation = require('../../assets/confirmTxAnimation.json');

// USDB Token address - update this with your actual USDB token address
const USDB_ASSET_PUBKEY =
  '3206c93b24a4d18ea19d0a9a213204af2c7e74a6d16c7535cc5d33eca4ad1eca';

export default function SwapsPage() {
  const navigate = useNavigation();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { sparkInformation, USD_BALANCE } = useSparkWallet();
  const { screenDimensions } = useAppStatus();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats, SATS_PER_DOLLAR } = useNodeContext();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
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
  };

  const loadPoolInfo = async () => {
    setIsLoadingPool(true);
    setError(null);

    try {
      const result = await findBestPool(
        currentWalletMnemoinc,
        BTC_ASSET_ADDRESS,
        USDB_ASSET_PUBKEY,
      );

      if (result.didWork && result.pool) {
        setPoolInfo(result.pool);
        console.log('✓ Found BTC/USDB pool:', {
          poolId: result.pool.lpPublicKey,
          tvl: result.pool.tvlAssetB,
          volume24h: result.pool.volume24hAssetB,
        });
      } else {
        setError(result.error || 'BTC/USDB pool not found');
      }
    } catch (err) {
      console.error('Load pool info error:', err);
      setError('Failed to load pool information');
    } finally {
      setIsLoadingPool(false);
    }
  };

  // Simulate swap when amount changes
  useEffect(() => {
    if (lastEditedField === 'from') {
      if (fromAmount && !isNaN(fromAmount) && parseFloat(fromAmount) > 0) {
        simulateSwapAmount(fromAmount, 'from');
      } else {
        setToAmount('');
        setSimulationResult(null);
        setPriceImpact(null);
        setError('');
      }
    } else if (lastEditedField === 'to') {
      if (toAmount && !isNaN(toAmount) && parseFloat(toAmount) > 0) {
        simulateSwapAmount(toAmount, 'to');
      } else {
        setFromAmount('');
        setSimulationResult(null);
        setPriceImpact(null);
        setError('');
      }
    }
  }, [fromAmount, toAmount, fromAsset, toAsset, poolInfo, lastEditedField]);

  const simulateSwapAmount = useDebounce(async (amount, direction) => {
    if (!poolInfo) return;

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

        assetInAddress = isBtcToUsdb ? BTC_ASSET_ADDRESS : USDB_ASSET_PUBKEY;
        assetOutAddress = isBtcToUsdb ? USDB_ASSET_PUBKEY : BTC_ASSET_ADDRESS;
      } else {
        amountInSmallestUnits = isBtcToUsdb
          ? Math.floor(parseFloat(amount) * Math.pow(10, decimals))
          : Math.floor(parseFloat(amount));

        assetInAddress = isBtcToUsdb ? USDB_ASSET_PUBKEY : BTC_ASSET_ADDRESS;
        assetOutAddress = isBtcToUsdb ? BTC_ASSET_ADDRESS : USDB_ASSET_PUBKEY;
      }

      const result = await simulateSwap(currentWalletMnemoinc, {
        poolId: poolInfo.lpPublicKey,
        assetInAddress,
        assetOutAddress,
        amountIn: amountInSmallestUnits,
      });

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
          setError(`High price impact: ${result.simulation.priceImpact}%`);
        }
      } else {
        const errorInfo = handleFlashnetError(result.details);
        setError(errorInfo.message || result.error || 'Simulation failed');
        if (isForwardDirection) {
          setToAmount('0');
        } else {
          setFromAmount('0');
        }
      }
    } catch (err) {
      console.error('Simulate swap error:', err);
      setError('Failed to calculate swap amount');
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
    setShowKeyboard(true);
  };

  const handleInputPress = direction => {
    setLastEditedField(direction);
    setShowKeyboard(true);
  };

  const handleKeyboardInput = value => {
    console.log(value, 'est');
    if (lastEditedField === 'from') {
      handleFromAmountChange(value, 'from');
    } else {
      handleFromAmountChange(value, 'to');
    }
  };

  const dismissKeyboard = () => {
    setShowKeyboard(false);
  };

  const executeSwapAction = async () => {
    if (!poolInfo || !fromAmount || parseFloat(fromAmount) <= 0) {
      navigate.navigate('ErrorScreen', {
        errorMessage: 'Please enter a valid amount',
      });
      return;
    }

    const showConfirmScreen = priceImpact > 5;

    if (!showConfirmScreen) {
      performSwap();
      return;
    }

    navigate.navigate('ConfirmActionPage', {
      confirmMessage: t(
        `Price Impact: ${priceImpact?.toFixed(2) || 'N/A'}%\n` +
          'Do you still want to swap?',
      ),
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
            tokenAddress: USDB_ASSET_PUBKEY,
            amountSats: amountInSmallestUnits,
            poolId: poolInfo.lpPublicKey,
          })
        : await swapTokenToBitcoin(currentWalletMnemoinc, {
            tokenAddress: USDB_ASSET_PUBKEY,
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
          errorInfo.userMessage || result.error || 'Swap failed';

        if (errorInfo.clawback) {
          if (errorInfo.clawback.allRecovered) {
            errorMessage +=
              '\n\n✅ Your funds have been automatically recovered.';
          } else if (errorInfo.clawback.partialRecovered) {
            errorMessage += `\n\n⚠️ Some funds recovered automatically (${errorInfo.clawback.recoveredCount}).`;
          }
        } else if (errorInfo.autoRefund) {
          errorMessage += '\n\n✅ Your funds will be automatically refunded.';
        }

        if (errorInfo.type === 'slippage') {
          errorMessage +=
            '\n\n💡 Try increasing slippage tolerance or waiting for better market conditions.';
        } else if (errorInfo.type === 'insufficient_liquidity') {
          errorMessage +=
            '\n\n💡 Try swapping a smaller amount or waiting for more liquidity.';
        }

        navigate.navigate('errorScreen', { errorMessage: errorMessage });
        setError(errorInfo.userMessage || result.error);
      }
    } catch (err) {
      console.error('Execute swap error:', err);
      navigate.navigate('errorScreen', {
        errorMessage:
          'An unexpected error occurred during the swap. Please try again.',
      });
      setError('Swap execution failed');
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
    (!error || error.includes('High price impact'));

  if (confirmedSwap) {
    const isBtcToUsdb = fromAsset === 'BTC';

    return (
      <GlobalThemeView useStandardWidth={true} styles={styles.globalContainer}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, alignItems: 'center' }}
        >
          <LottieView
            ref={animationRef}
            source={confirmAnimation}
            loop={false}
            style={{
              width: screenDimensions.width / 1.5,
              height: screenDimensions.width / 1.5,
              maxWidth: 400,
              maxHeight: 400,
            }}
          />

          <ThemeText
            styles={{ fontSize: SIZES.large, marginBottom: 10 }}
            content={'Swap Confirmed'}
          />

          <View style={{ marginBottom: 5 }}>
            <ThemeText
              styles={{
                fontSize: SIZES.small,
                opacity: 0.6,
                textAlign: 'center',
              }}
              content={'You sent'}
            />
          </View>
          <View style={{ marginBottom: 20 }}>
            <ThemeText
              styles={{
                fontSize: SIZES.xLarge,
                includeFontPadding: false,
                textAlign: 'center',
              }}
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

          <View style={{ marginBottom: 5 }}>
            <ThemeText
              styles={{
                fontSize: SIZES.small,
                opacity: 0.6,
                textAlign: 'center',
              }}
              content={'You received'}
            />
          </View>
          <View style={{ marginBottom: 40 }}>
            <ThemeText
              styles={{
                fontSize: SIZES.huge,
                includeFontPadding: false,
                textAlign: 'center',
              }}
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

          <View style={styles.paymentTable}>
            {priceImpact && (
              <View style={styles.paymentTableRow}>
                <ThemeText
                  CustomNumberOfLines={1}
                  styles={styles.labelText}
                  content={'Price Impact'}
                />
                <ThemeText
                  styles={priceImpact > 5 ? { color: COLORS.cancelRed } : {}}
                  content={`${priceImpact.toFixed(2)}%`}
                />
              </View>
            )}

            {!!confirmedSwap.realFeeAmount && (
              <View style={styles.paymentTableRow}>
                <ThemeText
                  CustomNumberOfLines={1}
                  styles={styles.labelText}
                  content={'Fee'}
                />
                <ThemeText
                  content={displayCorrectDenomination({
                    amount: confirmedSwap.realFeeAmount,
                    masterInfoObject,
                    fiatStats,
                  })}
                />
              </View>
            )}
          </View>

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
            textContent={'Go back'}
          />
          <CustomButton
            buttonStyles={{
              width: 'auto',
              minWidth: 300,
              backgroundColor: 'transparent',
            }}
            actionFunction={() => {
              setConfirmedSwap(null);
              clearPageStates();
            }}
            textContent={'Create Another Swap'}
          />
        </ScrollView>
      </GlobalThemeView>
    );
  }

  const handleContainerClick = () => {
    setShowKeyboard(false);
  };

  return (
    <CustomKeyboardAvoidingView
      useTouchableWithoutFeedback={true}
      touchableWithoutFeedbackFunction={handleContainerClick}
      useStandardWidth={true}
    >
      <CustomSettingsTopBar />
      <TouchableWithoutFeedback onPress={dismissKeyboard}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContainer}
        >
          <View style={styles.contentWrapper}>
            {isLoadingPool && (
              <View style={styles.loadingContainer}>
                <FullLoadingScreen
                  textStyles={styles.loadingText}
                  text={'Loading pool information...'}
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
                        content={`I have ${displayCorrectDenomination({
                          amount: displayBalance,
                          masterInfoObject: {
                            ...masterInfoObject,
                            userBalanceDenomination:
                              fromAsset === 'BTC' ? 'sats' : 'fiat',
                          },
                          forceCurrency: 'USD',
                          fiatStats,
                        })}`}
                      />
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
                        activeOpacity={0.7}
                      >
                        <ThemeText
                          styles={[
                            styles.amountInput,
                            {
                              color: theme
                                ? COLORS.darkModeText
                                : COLORS.lightModeText,
                            },
                          ]}
                          content={fromAmount || '0'}
                        />
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

                  {!showKeyboard && (
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
                  )}

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
                      <ThemeText styles={styles.label} content={`I want`} />
                      {isSimulating && (
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
                        activeOpacity={0.7}
                      >
                        <ThemeText
                          styles={[
                            styles.amountInput,
                            {
                              color: theme
                                ? COLORS.darkModeText
                                : COLORS.lightModeText,
                            },
                          ]}
                          content={toAmount || '0'}
                        />
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
                      content={'MIN'}
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
                      content={'HALF'}
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
                      content={'MAX'}
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
                          ? 'Swapping...'
                          : isLoadingPool
                          ? 'Loading...'
                          : `Swap ${fromAsset} → ${toAsset}`
                      }
                      actionFunction={executeSwapAction}
                      disabled={!canSwap}
                    />

                    <ThemeText
                      styles={styles.disclaimer}
                      content={
                        'Swap services are available through third-party API providers.'
                      }
                    />
                  </>
                )}
              </>
            )}

            {!isLoadingPool && !poolInfo && (
              <View style={styles.errorStateContainer}>
                <ThemeText
                  styles={styles.errorStateTitle}
                  content="Service Unavailable"
                />
                <ThemeText
                  styles={styles.errorStateMessage}
                  content="Unable to connect to swap service. Please check your connection and try again."
                />
                <CustomButton
                  buttonStyles={{ marginTop: 20 }}
                  textContent="Retry"
                  actionFunction={loadPoolInfo}
                />
              </View>
            )}
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
      {showKeyboard && (
        <HandleKeyboardRender
          lastEditedField={lastEditedField}
          fromAsset={fromAsset}
          toAsset={toAsset}
          handleKeyboardInput={handleKeyboardInput}
        />
      )}
    </CustomKeyboardAvoidingView>
  );
}

function HandleKeyboardRender({
  lastEditedField,
  toAsset,
  fromAsset,
  handleKeyboardInput,
}) {
  const [amount, setAmount] = useState('');

  useEffect(() => {
    handleKeyboardInput(amount);
  }, [amount]);

  return (
    <CustomNumberKeyboard
      showDot={
        (lastEditedField === 'from' && fromAsset === 'USD') ||
        (lastEditedField === 'to' && toAsset === 'USD')
      }
      setInputValue={setAmount}
    />
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flexGrow: 1, alignItems: 'center', paddingTop: 20 },
  contentWrapper: {
    width: WINDOWWIDTH,
    maxWidth: 600,
    flexGrow: 1,
    paddingBottom: 20,
    paddingHorizontal: 16,
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
    fontSize: SIZES.xxLarge,
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
    textAlign: 'center',
    color: COLORS.darkModeText,
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
});
