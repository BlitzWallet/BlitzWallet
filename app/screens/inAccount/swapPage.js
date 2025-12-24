import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Bitcoin, DollarSign, ArrowDownUp } from 'lucide-react-native';
import {
  COLORS,
  FONT,
  SATSPERBITCOIN,
  SIZES,
  USDB_TOKEN_ID,
} from '../../constants';
import { HIDDEN_OPACITY, WINDOWWIDTH } from '../../constants/theme';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import CustomSettingsTopBar from '../../functions/CustomElements/settingsTopBar';
import displayCorrectDenomination from '../../functions/displayCorrectDenomination';
import { useSparkWallet } from '../../../context-store/sparkContext';
import { useGlobalContextProvider } from '../../../context-store/context';
import { useNodeContext } from '../../../context-store/nodeContext';
import formatTokensNumber from '../../functions/lrc20/formatTokensBalance';
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

// USDB Token address - update this with your actual USDB token address
const USDB_ASSET_PUBKEY =
  '3206c93b24a4d18ea19d0a9a213204af2c7e74a6d16c7535cc5d33eca4ad1eca';

export default function SwapsPage() {
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { sparkInformation, sparkAPI } = useSparkWallet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();

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

  // Get balances
  const tokenInformation = sparkInformation?.tokens?.[USDB_TOKEN_ID];
  const usdBalance =
    formatTokensNumber(
      tokenInformation?.balance,
      tokenInformation?.tokenMetadata?.decimals,
    ) ?? 0;
  const btcBalance = sparkInformation?.balance || 0;

  const displayBalance = fromAsset === 'BTC' ? btcBalance : usdBalance;

  // Load pool information on mount
  useEffect(() => {
    // requestManualClawback(
    //   currentWalletMnemoinc,
    //   '70d966bb1baad893217f9216c199508ae6a1f061781e6ed6e5b25ef94dc4f1b9',
    //   '02894808873b896e21d29856a6d7bb346fb13c019739adb9bf0b6a8b7e28da53da',
    // )
    //   .then(data => console.log(data, 'manual clawback'))
    //   .catch(err => console.log(err, 'clawback err'));
    // listClawbackableTransfers(currentWalletMnemoinc, 50).then(data =>
    //   console.log(data),
    // );
    loadPoolInfo();
  }, []);

  const loadPoolInfo = async () => {
    setIsLoadingPool(true);
    setError(null);

    try {
      // Use the new findBestPool function for automatic pool discovery
      const result = await findBestPool(
        currentWalletMnemoinc,
        BTC_ASSET_ADDRESS,
        USDB_ASSET_PUBKEY,
        // { minTvl: 1000 }, // Minimum $1000 TVL for safety
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
        Alert.alert(
          'Pool Not Available',
          'Unable to find a BTC/USDB liquidity pool. Please try again later.',
        );
      }
    } catch (err) {
      console.error('Load pool info error:', err);
      setError('Failed to load pool information');
      Alert.alert(
        'Error',
        'Failed to connect to swap service. Please check your connection.',
      );
    } finally {
      setIsLoadingPool(false);
    }
  };

  // Simulate swap when amount changes
  useEffect(() => {
    if (fromAmount && !isNaN(fromAmount) && parseFloat(fromAmount) > 0) {
      simulateSwapAmount(fromAmount);
    } else {
      setToAmount('');
      setSimulationResult(null);
      setPriceImpact(null);
    }
  }, [fromAmount, fromAsset, toAsset, poolInfo]);

  const simulateSwapAmount = useCallback(
    async amount => {
      if (!poolInfo) return;

      setIsSimulating(true);
      setError(null);

      try {
        const isBtcToUsdb = fromAsset === 'BTC';
        const decimals = tokenInformation?.tokenMetadata?.decimals || 6;

        // Convert amount to proper format (smallest units)
        const amountInSmallestUnits = isBtcToUsdb
          ? Math.floor(parseFloat(amount)) // BTC in sats
          : Math.floor(parseFloat(amount) * Math.pow(10, decimals)); // USDB in token units

        // Determine asset addresses based on swap direction
        const assetInAddress = isBtcToUsdb
          ? BTC_ASSET_ADDRESS
          : USDB_ASSET_PUBKEY;
        const assetOutAddress = isBtcToUsdb
          ? USDB_ASSET_PUBKEY
          : BTC_ASSET_ADDRESS;

        // Simulate the swap using the new unified function
        const result = await simulateSwap(currentWalletMnemoinc, {
          poolId: poolInfo.lpPublicKey,
          assetInAddress,
          assetOutAddress,
          amountIn: amountInSmallestUnits,
        });

        if (result.didWork && result.simulation) {
          setSimulationResult(result.simulation);
          setPriceImpact(parseFloat(result.simulation.priceImpact));

          // Convert output amount to display format
          const outputAmount = isBtcToUsdb
            ? (
                parseFloat(result.simulation.expectedOutput) /
                Math.pow(10, decimals)
              ).toFixed(2)
            : parseFloat(result.simulation.expectedOutput).toFixed(0);

          setToAmount(outputAmount);

          // Warn if price impact is high
          if (parseFloat(result.simulation.priceImpact) > 3) {
            setError(`⚠️ High price impact: ${result.simulation.priceImpact}%`);
          }
        } else {
          const errorInfo = handleFlashnetError(result.details);
          setError(
            errorInfo.userMessage || result.error || 'Simulation failed',
          );
          setToAmount('0');
        }
      } catch (err) {
        console.error('Simulate swap error:', err);
        setError('Failed to calculate swap amount');
        setToAmount('0');
      } finally {
        setIsSimulating(false);
      }
    },
    [fromAsset, toAsset, poolInfo, tokenInformation, currentWalletMnemoinc],
  );

  const handleSwapAssets = () => {
    // Swap the assets and amounts
    const tempAsset = fromAsset;
    const tempAmount = fromAmount;

    setFromAsset(toAsset);
    setToAsset(tempAsset);
    setFromAmount(toAmount);
    setToAmount(tempAmount);
    setSimulationResult(null);
    setPriceImpact(null);
    setError(null);
  };

  const handleFromAmountChange = value => {
    // Only allow valid decimal numbers
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setFromAmount(value);
    }
  };

  const setPercentage = percent => {
    const balance = fromAsset === 'BTC' ? btcBalance : usdBalance;
    const amount = (balance * percent).toString();
    handleFromAmountChange(amount);
  };

  const executeSwapAction = async () => {
    if (!poolInfo || !fromAmount || parseFloat(fromAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    // Check price impact before confirming
    const priceImpactWarning =
      priceImpact > 5
        ? `\n\n⚠️ WARNING: High price impact of ${priceImpact.toFixed(2)}%`
        : '';

    // Confirm swap with user
    Alert.alert(
      'Confirm Swap',
      `Swap ${fromAmount} ${fromAsset} for approximately ${toAmount} ${toAsset}?${priceImpactWarning}\n\n` +
        `Price Impact: ${priceImpact?.toFixed(2) || 'N/A'}%\n` +
        `Pool: ${poolInfo.lpPublicKey.substring(0, 8)}...`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: performSwap,
          style: priceImpact > 5 ? 'destructive' : 'default',
        },
      ],
    );
  };

  const performSwap = async () => {
    setIsSwapping(true);
    setError(null);

    try {
      const isBtcToUsdb = fromAsset === 'BTC';
      const decimals = tokenInformation?.tokenMetadata?.decimals || 6;

      // Convert amount to smallest units
      const amountInSmallestUnits = isBtcToUsdb
        ? Math.floor(parseFloat(fromAmount))
        : Math.floor(parseFloat(fromAmount) * Math.pow(10, decimals));

      // Use the convenient swap functions
      const result = isBtcToUsdb
        ? await swapBitcoinToToken(currentWalletMnemoinc, {
            tokenAddress: USDB_ASSET_PUBKEY,
            amountSats: amountInSmallestUnits,
            poolId: poolInfo.lpPublicKey,
            maxSlippageBps: priceImpact > 3 ? 200 : 100, // Higher slippage for high impact
          })
        : await swapTokenToBitcoin(currentWalletMnemoinc, {
            tokenAddress: USDB_ASSET_PUBKEY,
            tokenAmount: amountInSmallestUnits,
            poolId: poolInfo.lpPublicKey,
            maxSlippageBps: priceImpact > 3 ? 200 : 100,
          });

      if (result.didWork && result.swap) {
        // Calculate actual received amount
        const receivedAmount = isBtcToUsdb
          ? (
              parseFloat(result.swap.amountOut) / Math.pow(10, decimals)
            ).toFixed(2)
          : parseFloat(result.swap.amountOut).toFixed(0);

        Alert.alert(
          '✅ Swap Successful!',
          `You received ${receivedAmount} ${toAsset}\n\n` +
            `Transfer ID: ${result.swap.outboundTransferId.substring(
              0,
              16,
            )}...`,
          [
            {
              text: 'OK',
              onPress: () => {
                // Reset form
                setFromAmount('');
                setToAmount('');
                setSimulationResult(null);
                setPriceImpact(null);
                setError(null);

                // Refresh balance
                sparkAPI.getSparkBalance({
                  mnemonic: currentWalletMnemoinc,
                });
              },
            },
          ],
        );
      } else {
        // Handle errors using the new error handler
        const errorInfo = handleFlashnetError(result.details);

        let errorMessage =
          errorInfo.userMessage || result.error || 'Swap failed';
        let errorTitle = 'Swap Failed';

        // Show fund recovery status
        if (errorInfo.clawback) {
          if (errorInfo.clawback.allRecovered) {
            errorTitle = 'Swap Failed - Funds Recovered';
            errorMessage +=
              '\n\n✅ Your funds have been automatically recovered.';
          } else if (errorInfo.clawback.partialRecovered) {
            errorTitle = 'Swap Failed - Partial Recovery';
            errorMessage += `\n\n⚠️ Some funds recovered automatically (${errorInfo.clawback.recoveredCount}).`;
          }
        } else if (errorInfo.autoRefund) {
          errorMessage += '\n\n✅ Your funds will be automatically refunded.';
        }

        // Add helpful suggestions based on error type
        if (errorInfo.type === 'slippage') {
          errorMessage +=
            '\n\n💡 Try increasing slippage tolerance or waiting for better market conditions.';
        } else if (errorInfo.type === 'insufficient_liquidity') {
          errorMessage +=
            '\n\n💡 Try swapping a smaller amount or waiting for more liquidity.';
        }

        Alert.alert(errorTitle, errorMessage);
        setError(errorInfo.userMessage || result.error);
      }
    } catch (err) {
      console.error('Execute swap error:', err);
      Alert.alert(
        'Error',
        'An unexpected error occurred during the swap. Please try again.',
      );
      setError('Swap execution failed');
    } finally {
      setIsSwapping(false);
    }
  };

  // Determine if swap can be executed
  const canSwap =
    fromAmount &&
    parseFloat(fromAmount) > 0 &&
    toAmount &&
    parseFloat(toAmount) > 0 &&
    !isSimulating &&
    !isSwapping &&
    !isLoadingPool &&
    poolInfo &&
    (!error || error.includes('⚠️ High price impact')); // Allow swap even with price impact warning

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.contentWrapper}>
          {/* Loading State */}
          {isLoadingPool && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <ThemeText
                styles={styles.loadingText}
                content="Loading pool information..."
              />
            </View>
          )}

          {/* Main Content */}
          {!isLoadingPool && poolInfo && (
            <>
              {/* From Section */}
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
                      <View style={[styles.iconContainer, { backgroundColor }]}>
                        {fromAsset === 'BTC' ? (
                          <Bitcoin
                            color={
                              theme ? COLORS.darkModeText : COLORS.lightModeText
                            }
                          />
                        ) : (
                          <DollarSign
                            size={24}
                            color={
                              theme ? COLORS.darkModeText : COLORS.lightModeText
                            }
                          />
                        )}
                      </View>
                      <ThemeText
                        styles={styles.assetText}
                        content={fromAsset}
                      />
                    </View>

                    <TextInput
                      style={[
                        styles.amountInput,
                        {
                          color: theme
                            ? COLORS.darkModeText
                            : COLORS.lightModeText,
                        },
                      ]}
                      value={fromAmount}
                      onChangeText={handleFromAmountChange}
                      placeholder="0"
                      placeholderTextColor={COLORS.gray2}
                      keyboardType="decimal-pad"
                      editable={!isSwapping && !isLoadingPool}
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

                {/* To Section */}
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
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    )}
                  </View>

                  <View style={styles.assetRow}>
                    <View style={styles.assetInfo}>
                      <View style={[styles.iconContainer, { backgroundColor }]}>
                        {fromAsset !== 'BTC' ? (
                          <Bitcoin
                            color={
                              theme ? COLORS.darkModeText : COLORS.lightModeText
                            }
                          />
                        ) : (
                          <DollarSign
                            size={24}
                            color={
                              theme ? COLORS.darkModeText : COLORS.lightModeText
                            }
                          />
                        )}
                      </View>
                      <ThemeText styles={styles.assetText} content={toAsset} />
                    </View>
                    <ThemeText
                      styles={styles.amountDisplay}
                      content={toAmount || '0'}
                    />
                  </View>
                </View>
              </View>

              {/* Quick Amount Buttons */}
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
                  <ThemeText styles={styles.quickButtonText} content={'MIN'} />
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
                  <ThemeText styles={styles.quickButtonText} content={'HALF'} />
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
                  <ThemeText styles={styles.quickButtonText} content={'MAX'} />
                </TouchableOpacity>
              </View>

              {/* Swap Details */}
              {simulationResult && (
                <View style={styles.detailsContainer}>
                  <View style={styles.detailRow}>
                    <ThemeText
                      styles={styles.detailLabel}
                      content="Price Impact"
                    />
                    <ThemeText
                      styles={[
                        styles.detailValue,
                        priceImpact > 5 && styles.detailValueWarning,
                      ]}
                      content={`${priceImpact.toFixed(2)}%`}
                    />
                  </View>
                  <View style={styles.detailRow}>
                    <ThemeText
                      styles={styles.detailLabel}
                      content="Exchange Rate"
                    />
                    <ThemeText
                      styles={styles.detailValue}
                      content={simulationResult.executionPrice}
                    />
                  </View>
                  <View style={styles.detailRow}>
                    <ThemeText styles={styles.detailLabel} content="Pool" />
                    <ThemeText
                      styles={styles.detailValue}
                      content={`${poolInfo.lpPublicKey.substring(0, 8)}...`}
                    />
                  </View>
                </View>
              )}

              {/* Error Display */}
              {error && (
                <View
                  style={[
                    styles.errorContainer,
                    error.includes('⚠️') && styles.warningContainer,
                  ]}
                >
                  <ThemeText styles={styles.errorText} content={error} />
                </View>
              )}

              {/* Swap Action Button */}
              <CustomButton
                buttonStyles={{
                  marginTop: 'auto',
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

              {/* Pool Info */}
              {poolInfo && (
                <View style={styles.poolInfoContainer}>
                  <ThemeText
                    styles={styles.poolInfoText}
                    content={`TVL: $${
                      poolInfo.tvlAssetB?.toLocaleString() || 'N/A'
                    } • 24h Vol: $${
                      poolInfo.volume24hAssetB?.toLocaleString() || 'N/A'
                    }`}
                  />
                </View>
              )}

              <ThemeText
                styles={styles.disclaimer}
                content={'Swap services powered by Flashnet AMM'}
              />
            </>
          )}

          {/* Error State - No Pool */}
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
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flexGrow: 1, alignItems: 'center' },
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
  amountDisplay: {
    fontSize: SIZES.xxLarge,
    fontWeight: '500',
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
  detailsContainer: {
    marginTop: 16,
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    padding: 16,
    borderRadius: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: SIZES.small,
    fontFamily: FONT.Descriptoin_Regular,
    opacity: HIDDEN_OPACITY,
  },
  detailValue: {
    fontSize: SIZES.small,
    fontFamily: FONT.Descriptoin_Regular,
    fontWeight: '500',
  },
  detailValueWarning: {
    color: COLORS.cancelRed,
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  warningContainer: {
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
  },
  errorText: {
    color: COLORS.cancelRed,
    fontSize: SIZES.small,
    textAlign: 'center',
  },
  poolInfoContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  poolInfoText: {
    fontSize: SIZES.xSmall,
    fontFamily: FONT.Descriptoin_Regular,
    color: COLORS.gray,
    opacity: HIDDEN_OPACITY,
  },
  disclaimer: {
    textAlign: 'center',
    fontSize: SIZES.xSmall,
    fontFamily: FONT.Descriptoin_Regular,
    color: COLORS.gray,
    marginTop: 12,
    lineHeight: 16,
  },
  errorStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  errorStateTitle: {
    fontSize: SIZES.xLarge,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorStateMessage: {
    fontSize: SIZES.medium,
    textAlign: 'center',
    opacity: HIDDEN_OPACITY,
    lineHeight: 22,
  },
});
