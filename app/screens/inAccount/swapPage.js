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
import { listFlashnetPools } from '../../functions/spark';
import { useActiveCustodyAccount } from '../../../context-store/activeAccount';

// Constants for Flashnet
const BITCOIN_ASSET_PUBKEY =
  '020202020202020202020202020202020202020202020202020202020202020202';
const USDB_ASSET_PUBKEY = USDB_TOKEN_ID;
const DEFAULT_POOL_ID = 'your-btc-usdb-pool-id'; // Get from pool listing
const MAX_SLIPPAGE_BPS = 100; // 1% default slippage

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
  const [poolInfo, setPoolInfo] = useState(null);
  const [simulationResult, setSimulationResult] = useState(null);
  const [error, setError] = useState(null);

  // Get balances
  const tokenInformation = sparkInformation?.tokens?.[USDB_TOKEN_ID];
  const usdBalance =
    formatTokensNumber(
      tokenInformation?.balance,
      tokenInformation?.tokenMetadata?.decimals,
    ) ?? 0;
  const btcBalance = sparkInformation?.balance || 0;

  const displayBalance = fromAsset === 'BTC' ? btcBalance : usdBalance;

  //   Load pool information on mount
  useEffect(() => {
    loadPoolInfo();
  }, []);

  const loadPoolInfo = async () => {
    try {
      const result = await listFlashnetPools({
        mnemonic: currentWalletMnemoinc,
        filters: {
          assetAAddress: BITCOIN_ASSET_PUBKEY,
          assetBAddress:
            'btkn1xgrvjwey5ngcagvap2dzzvsy4uk8ua9x69k82dwvt5e7ef9drm9qztux87',
        },
      });
      console.log(result, 'ts');

      if (result.didWork && result.pools) {
        // Find the BTC/USDB pool
        const btcUsdbPool = result.pools.pools.find(
          pool =>
            (pool.assetA === BITCOIN_ASSET_PUBKEY &&
              pool.assetB === USDB_ASSET_PUBKEY) ||
            (pool.assetA === USDB_ASSET_PUBKEY &&
              pool.assetB === BITCOIN_ASSET_PUBKEY),
        );

        if (btcUsdbPool) {
          setPoolInfo(btcUsdbPool);
        } else {
          setError('BTC/USDB pool not found');
        }
      }
    } catch (err) {
      console.error('Load pool info error:', err);
      setError('Failed to load pool information');
    }
  };

  // Simulate swap when amount changes
  useEffect(() => {
    if (fromAmount && !isNaN(fromAmount) && parseFloat(fromAmount) > 0) {
      simulateSwap(fromAmount);
    } else {
      setToAmount('');
      setSimulationResult(null);
    }
  }, [fromAmount, fromAsset, toAsset]);

  const simulateSwap = useCallback(
    async amount => {
      if (!poolInfo) return;

      setIsSimulating(true);
      setError(null);

      try {
        const isBtcToUsdb = fromAsset === 'BTC';

        // Convert amount to proper format
        const amountToSwap = isBtcToUsdb
          ? Math.floor(parseFloat(amount)).toString() // BTC in sats
          : Math.floor(
              parseFloat(amount) *
                Math.pow(10, tokenInformation?.tokenMetadata?.decimals || 6),
            ).toString(); // USDB in token units

        const simulateFunction = isBtcToUsdb
          ? 'simulateBitcoinToUSDB'
          : 'simulateUSDBToBitcoin';

        const result = await sparkAPI[simulateFunction]({
          poolId: poolInfo.poolId || DEFAULT_POOL_ID,
          amountSats: isBtcToUsdb ? amountToSwap : undefined,
          amountUSDB: !isBtcToUsdb ? amountToSwap : undefined,
          bitcoinPubkey: BITCOIN_ASSET_PUBKEY,
          usdbPubkey: USDB_ASSET_PUBKEY,
          mnemonic: sparkInformation.mnemonicHash,
        });

        if (result.didWork && result.simulation) {
          setSimulationResult(result.simulation);

          // Convert output amount to display format
          const outputAmount = isBtcToUsdb
            ? (
                parseFloat(result.simulation.amountOut) /
                Math.pow(10, tokenInformation?.tokenMetadata?.decimals || 6)
              ).toFixed(2)
            : parseFloat(result.simulation.amountOut).toFixed(0);

          setToAmount(outputAmount);
        } else {
          setError(result.error || 'Simulation failed');
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
    [fromAsset, toAsset, poolInfo, tokenInformation],
  );

  const handleSwapAssets = () => {
    const tempAsset = fromAsset;
    const tempAmount = fromAmount;

    setFromAsset(toAsset);
    setToAsset(tempAsset);
    setFromAmount(toAmount);
    setToAmount(tempAmount);
    setSimulationResult(null);
  };

  const handleFromAmountChange = value => {
    setFromAmount(value);
  };

  const setPercentage = percent => {
    const balance = fromAsset === 'BTC' ? btcBalance : usdBalance;
    const amount = (balance * percent).toString();
    handleFromAmountChange(amount);
  };

  const executeSwap = async () => {
    if (!poolInfo || !fromAmount || parseFloat(fromAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    // Confirm swap with user
    Alert.alert(
      'Confirm Swap',
      `Swap ${fromAmount} ${fromAsset} for approximately ${toAmount} ${toAsset}?\n\n` +
        `Price Impact: ${simulationResult?.priceImpact || 'N/A'}%\n` +
        `Fee: ${simulationResult?.fee || 'N/A'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: performSwap },
      ],
    );
  };

  const performSwap = async () => {
    setIsSwapping(true);
    setError(null);

    try {
      const isBtcToUsdb = fromAsset === 'BTC';

      // Convert amount to proper format
      const amountToSwap = isBtcToUsdb
        ? Math.floor(parseFloat(fromAmount)).toString()
        : Math.floor(
            parseFloat(fromAmount) *
              Math.pow(10, tokenInformation?.tokenMetadata?.decimals || 6),
          ).toString();

      const swapFunction = isBtcToUsdb
        ? 'swapBitcoinToUSDB'
        : 'swapUSDBToBitcoin';

      const result = await sparkAPI[swapFunction]({
        poolId: poolInfo.poolId || DEFAULT_POOL_ID,
        amountSats: isBtcToUsdb ? amountToSwap : undefined,
        amountUSDB: !isBtcToUsdb ? amountToSwap : undefined,
        bitcoinPubkey: BITCOIN_ASSET_PUBKEY,
        usdbPubkey: USDB_ASSET_PUBKEY,
        maxSlippageBps: MAX_SLIPPAGE_BPS,
        mnemonic: sparkInformation.mnemonicHash,
      });

      if (result.didWork && result.swap) {
        Alert.alert(
          'Swap Successful!',
          `You received ${
            isBtcToUsdb
              ? (
                  parseFloat(result.swap.amountOut) /
                  Math.pow(10, tokenInformation?.tokenMetadata?.decimals || 6)
                ).toFixed(2)
              : parseFloat(result.swap.amountOut).toFixed(0)
          } ${toAsset}`,
          [
            {
              text: 'OK',
              onPress: () => {
                setFromAmount('');
                setToAmount('');
                setSimulationResult(null);
                // Refresh balance
                sparkAPI.getSparkBalance({
                  mnemonic: sparkInformation.mnemonicHash,
                });
              },
            },
          ],
        );
      } else {
        // Handle specific error types
        let errorMessage = result.error || 'Swap failed';

        switch (result.errorType) {
          case 'INSUFFICIENT_BALANCE':
            errorMessage = 'Insufficient balance to complete this swap';
            break;
          case 'SLIPPAGE_EXCEEDED':
            errorMessage = 'Price changed too much. Please try again.';
            break;
          case 'POOL_INACTIVE':
            errorMessage =
              'Pool is temporarily unavailable. Please try again later.';
            break;
          case 'BELOW_MINIMUM':
            errorMessage = 'Amount is below the minimum required for this pool';
            break;
        }

        Alert.alert('Swap Failed', errorMessage);
        setError(errorMessage);
      }
    } catch (err) {
      console.error('Execute swap error:', err);
      Alert.alert('Error', 'An unexpected error occurred during the swap');
      setError('Swap execution failed');
    } finally {
      setIsSwapping(false);
    }
  };

  const canSwap =
    fromAmount &&
    parseFloat(fromAmount) > 0 &&
    toAmount &&
    parseFloat(toAmount) > 0 &&
    !isSimulating &&
    !isSwapping &&
    !error;

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.contentWrapper}>
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
                  <ThemeText styles={styles.assetText} content={fromAsset} />
                </View>

                <TextInput
                  style={styles.amountInput}
                  value={fromAmount}
                  onChangeText={handleFromAmountChange}
                  placeholder="0"
                  placeholderTextColor={COLORS.gray2}
                  keyboardType="decimal-pad"
                  editable={!isSwapping}
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
              disabled={isSwapping}
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
              style={[styles.quickButton]}
              onPress={() => setPercentage(0.25)}
              activeOpacity={0.7}
              disabled={isSwapping}
            >
              <ThemeText styles={styles.quickButtonText} content={'MIN'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickButton]}
              onPress={() => setPercentage(0.5)}
              activeOpacity={0.7}
              disabled={isSwapping}
            >
              <ThemeText styles={styles.quickButtonText} content={'HALF'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickButton]}
              onPress={() => setPercentage(1)}
              activeOpacity={0.7}
              disabled={isSwapping}
            >
              <ThemeText styles={styles.quickButtonText} content={'MAX'} />
            </TouchableOpacity>
          </View>

          {/* Swap Details */}
          {simulationResult && (
            <View style={styles.detailsContainer}>
              <ThemeText
                styles={styles.rateInfo}
                content={`Price Impact: ${simulationResult.priceImpact}%`}
              />
              {simulationResult.fee && (
                <ThemeText
                  styles={styles.rateInfo}
                  content={`Fee: ${simulationResult.fee}`}
                />
              )}
            </View>
          )}

          {/* Error Display */}
          {error && (
            <View style={styles.errorContainer}>
              <ThemeText styles={styles.errorText} content={error} />
            </View>
          )}

          {/* Swap Action Button */}
          <CustomButton
            buttonStyles={{
              marginTop: 'auto',
              opacity: canSwap ? 1 : 0.5,
            }}
            textContent={isSwapping ? 'Swapping...' : `Transfer`}
            actionFunction={executeSwap}
            disabled={!canSwap}
          />

          <ThemeText
            styles={styles.disclaimer}
            content={
              'Swap services powered by Flashnet AMM\nBuilt on Spark • Non-custodial'
            }
          />
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
    color: COLORS.lightModeText,
    fontWeight: '500',
    textAlign: 'right',
    minWidth: 100,
  },
  amountDisplay: {
    fontSize: SIZES.xxLarge,
    color: COLORS.lightModeText,
    fontWeight: '500',
  },
  cardContainer: {
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginTop: 24,
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
    color: COLORS.lightModeText,
  },
  detailsContainer: {
    marginTop: 16,
    gap: 8,
  },
  rateInfo: {
    textAlign: 'center',
    fontSize: SIZES.smedium,
    fontFamily: FONT.Descriptoin_Regular,
    color: COLORS.gray,
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  errorText: {
    color: COLORS.cancelRed,
    fontSize: SIZES.small,
    textAlign: 'center',
  },
  disclaimer: {
    textAlign: 'center',
    fontSize: SIZES.xSmall,
    fontFamily: FONT.Descriptoin_Regular,
    color: COLORS.gray,
    marginTop: 20,
    lineHeight: 16,
  },
});
