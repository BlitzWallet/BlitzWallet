import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  useSavings,
  UNALLOCATED_GOAL_ID,
} from '../../../../../context-store/savingsContext';
import { useUserBalanceContext } from '../../../../../context-store/userBalanceContext';
import { ThemeText } from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import GetThemeColors from '../../../../hooks/themeColors';
import { CENTER, COLORS, ICONS, SIZES } from '../../../../constants';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import { fromMicros } from './utils';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import FormattedBalanceInput from '../../../../functions/CustomElements/formattedBalanceInput';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../functions/CustomElements/button';
import convertTextInputValue from '../../../../functions/textInputConvertValue';
import usePaymentInputDisplay from '../../../../hooks/usePaymentInputDisplay';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../constants/theme';
import { updateConfirmAnimation } from '../../../../functions/lottieViewColorTransformer';
import LottieView from 'lottie-react-native';
import {
  BTC_ASSET_ADDRESS,
  dollarsToSats,
  INTEGRATOR_FEE,
  satsToDollars,
  simulateSwap,
  USD_ASSET_ADDRESS,
} from '../../../../functions/spark/flashnet';
import { sparkPaymenWrapper } from '../../../../functions/spark/payments';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { useActiveCustodyAccount } from '../../../../../context-store/activeAccount';
const confirmTxAnimation = require('../../../../assets/confirmTxAnimation.json');

const HEIGHT_FOR_PAGE = {
  chooseGoal: 500,
  source: 500,
  amount: 600,
  confirm: 500,
  loading: 500,
  success: 500,
};

export default function AddMoneyToSavingsHalfModal({
  setContentHeight,
  handleBackPressFunction,
  selectedGoalUUID,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats: globalFiatStats } = useNodeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { swapUSDPriceDollars, poolInfoRef, swapLimits } = useFlashnet();
  const {
    addMoney,
    refreshSavings,
    refreshBalances,
    savingsGoals,
    savingsWallet,
  } = useSavings();

  const { bitcoinBalance, dollarBalanceToken, dollarBalanceSat } =
    useUserBalanceContext();
  const { sparkInformation } = useSparkWallet();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();

  const [step, setStep] = useState([
    selectedGoalUUID || !savingsGoals.length ? 'source' : 'chooseGoal',
  ]);
  const [selectedSource, setSelectedSource] = useState(null);
  const [amountValue, setAmountValue] = useState('');

  const [inputDenomination, setInputDenomination] = useState(
    selectedSource === 'dollar'
      ? 'fiat'
      : masterInfoObject.userBalanceDenomination != 'fiat'
      ? 'sats'
      : 'fiat',
  );
  const fiatStats = globalFiatStats;
  const [selectedGoalId, setSelectedGoalId] = useState(selectedGoalUUID);

  const currentPage = step[step.length - 1];

  const paymentMode = selectedSource === 'dollar' ? 'USD' : 'BTC';

  const availableBalance =
    paymentMode === 'USD' ? dollarBalanceToken.toFixed(2) : bitcoinBalance;

  const {
    primaryDisplay,
    secondaryDisplay,
    conversionFiatStats,
    convertDisplayToSats,
    getNextDenomination,
    convertForToggle,
  } = usePaymentInputDisplay({
    paymentMode,
    inputDenomination,
    fiatStats,
    usdFiatStats: { coin: 'USD', value: swapUSDPriceDollars },
    masterInfoObject,
  });

  const localSatAmount = convertDisplayToSats(amountValue);

  // When paying from BTC: sats entered directly; fiat micros derived from price.
  // When paying from USD: fiat entered directly; convert to sats for sparkPaymenWrapper.
  const fiatMicros =
    (satsToDollars(localSatAmount, swapUSDPriceDollars) / 100).toFixed(2) *
    1_000_000;

  // BTC-paying path needs a swap (BTC→USDB). Simulate upfront so fees are ready.
  const simulationPromiseRef = useRef(null);
  const [simulationResult, setSimulationResult] = useState(null);

  useEffect(() => {
    if (selectedSource !== 'bitcoin' || !localSatAmount) {
      simulationPromiseRef.current = null;
      setSimulationResult(null);
      return;
    }
    const promise = simulateSwap(currentWalletMnemoinc, {
      poolId: poolInfoRef.lpPublicKey,
      assetInAddress: BTC_ASSET_ADDRESS,
      assetOutAddress: USD_ASSET_ADDRESS,
      amountIn: localSatAmount,
    });
    simulationPromiseRef.current = promise;
    promise
      .then(swap => {
        if (swap?.didWork) setSimulationResult(swap.simulation);
        else setSimulationResult(null);
      })
      .catch(() => setSimulationResult(null));
  }, [
    selectedSource,
    localSatAmount,
    currentWalletMnemoinc,
    poolInfoRef.lpPublicKey,
  ]);

  const handleDenominationToggle = () => {
    const nextDenom = getNextDenomination();
    setInputDenomination(nextDenom);
    setAmountValue(convertForToggle(amountValue, convertTextInputValue));
  };

  const canContinue = Number(amountValue || 0) > 0;

  // Adjust modal height on step change
  useEffect(() => {
    if (setContentHeight && HEIGHT_FOR_PAGE[currentPage]) {
      setContentHeight(HEIGHT_FOR_PAGE[currentPage]);
    }
  }, [currentPage, setContentHeight]);

  const handleBackPress = useCallback(() => {
    if (currentPage === 'loading') return true; // block
    if (currentPage === 'source' || currentPage === 'success') return false; // let parent close
    setStep(prev => prev.slice(0, -1));
    return true;
  }, [currentPage]);

  const confirmAnimation = useMemo(() => {
    return updateConfirmAnimation(
      confirmTxAnimation,
      theme ? (darkModeType ? 'lightsOut' : 'dark') : 'light',
    );
  }, [theme, darkModeType]);

  useHandleBackPressNew(handleBackPress);

  const handleConfirm = async () => {
    setStep(prev => [...prev, 'loading']);

    try {
      const savingsAddress = savingsWallet?.sparkAddress;
      if (!savingsAddress) throw new Error(t('savings.savingsWalletError'));

      // USD source → direct USDB token send, no swap needed.
      // BTC source → swap BTC→USDB first, then send tokens.
      const needsSwap = selectedSource === 'bitcoin';

      let swapPaymentQuote;
      if (needsSwap) {
        // Wait for any in-flight simulation to settle before reading the result.
        if (simulationPromiseRef.current) {
          await simulationPromiseRef.current;
        }
        if (!simulationResult)
          throw new Error(t('savings.swapSimulationError'));

        const btcFee = Math.round(
          dollarsToSats(
            Number(simulationResult.feePaidAssetIn) / 1_000_000,
            poolInfoRef.currentPriceAInB,
          ) +
            localSatAmount * INTEGRATOR_FEE,
        );

        swapPaymentQuote = {
          poolId: poolInfoRef.lpPublicKey,
          assetInAddress: BTC_ASSET_ADDRESS,
          assetOutAddress: USD_ASSET_ADDRESS,
          amountIn: Math.min(
            Math.round(localSatAmount + btcFee),
            bitcoinBalance,
          ),
          dollarBalanceSat,
          bitcoinBalance,
          satFee: btcFee,
        };
      }

      const paymentResponse = await sparkPaymenWrapper({
        address: savingsAddress,
        paymentType: 'spark',
        amountSats: localSatAmount,
        masterInfoObject,
        memo: t('savings.addMoney.paymentLabel', {
          context: selectedGoalId,
          savingsGoal: savingsGoals.find(item => item.id === selectedGoalId)
            ?.name,
        }),
        userBalance: sparkInformation?.userBalance,
        sparkInformation,
        mnemonic: currentWalletMnemoinc,
        usablePaymentMethod: selectedSource === 'dollar' ? 'USD' : 'BTC',
        swapPaymentQuote,
        paymentInfo: {
          data: {
            // Savings wallet always holds USDB tokens.
            expectedReceive: 'tokens',
          },
        },
        fiatValueConvertedSendAmount: Math.min(
          fiatMicros,
          dollarBalanceToken * 1_000_000,
        ),
        poolInfoRef,
      });

      if (!paymentResponse?.didWork) {
        throw new Error(paymentResponse?.error);
      }

      // Record the deposit against the chosen goal (or unallocated).
      const dollarValue = fiatMicros / 1_000_000;
      await addMoney({ amount: dollarValue, goalId: selectedGoalId });

      setStep(prev => [...prev, 'success']);
    } catch (err) {
      handleBackPressFunction(() =>
        navigate.replace('ErrorScreen', {
          errorMessage:
            err?.message ||
            t('savings.addMoney.errors.unableToCompleteTransfer'),
        }),
      );
    }
  };

  const handleDone = async () => {
    await refreshSavings();
    if (refreshBalances) await refreshBalances();
    handleBackPressFunction();
  };

  const sourceOptions = [
    {
      key: 'bitcoin',
      title: t('constants.sat_balance'),
      subtitle: displayCorrectDenomination({
        amount: bitcoinBalance,
        masterInfoObject: {
          ...masterInfoObject,
          userBalanceDenomination: 'sats',
        },
        fiatStats,
      }),
      icon: 'Bitcoin',
    },
    {
      key: 'dollar',
      title: t('constants.usd_balance'),
      subtitle: displayCorrectDenomination({
        amount: dollarBalanceToken.toFixed(2),
        masterInfoObject: {
          ...masterInfoObject,
          userBalanceDenomination: 'fiat',
        },
        fiatStats,
        forceCurrency: 'USD',
        convertAmount: false,
      }),
      icon: 'CircleDollarSign',
    },
  ];

  if (currentPage === 'chooseGoal') {
    return (
      <View style={styles.container}>
        <ThemeText
          styles={styles.title}
          content={t('savings.addMoney.chooseGoalTitle')}
        />
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            gap: 15,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* General savings — always shown so users can deposit without a goal */}
          <TouchableOpacity
            activeOpacity={0.7}
            style={[
              styles.optionRow,
              {
                backgroundColor:
                  theme && darkModeType ? backgroundColor : backgroundOffset,
              },
            ]}
            onPress={() => {
              setSelectedGoalId(UNALLOCATED_GOAL_ID);
              setStep(prev => [...prev, 'source']);
            }}
          >
            <View style={styles.optionLeft}>
              <View
                style={[
                  styles.iconContainer,
                  {
                    backgroundColor:
                      theme && darkModeType
                        ? backgroundOffset
                        : backgroundColor,
                  },
                ]}
              >
                <ThemeText styles={styles.emojiText} content="🏦" />
              </View>
              <View>
                <ThemeText
                  styles={styles.optionTitle}
                  content={t('savings.addMoney.generalSavings')}
                />
                <ThemeText
                  styles={styles.optionSubtitle}
                  content={t('savings.addMoney.noSpecificGoal')}
                />
              </View>
            </View>
            <ThemeIcon iconName="ChevronRight" size={16} />
          </TouchableOpacity>

          {savingsGoals.map(goal => {
            return (
              <TouchableOpacity
                key={goal.id}
                activeOpacity={0.7}
                style={[
                  styles.optionRow,
                  {
                    backgroundColor:
                      theme && darkModeType
                        ? backgroundColor
                        : backgroundOffset,
                  },
                ]}
                onPress={() => {
                  setSelectedGoalId(goal.id);
                  setStep(prev => [...prev, 'source']);
                }}
              >
                <View style={styles.optionLeft}>
                  <View
                    style={[
                      styles.iconContainer,
                      {
                        backgroundColor:
                          theme && darkModeType
                            ? backgroundOffset
                            : backgroundColor,
                      },
                    ]}
                  >
                    <ThemeText styles={styles.emojiText} content={goal.emoji} />
                  </View>
                  <View>
                    <ThemeText
                      styles={styles.optionTitle}
                      content={goal.name}
                    />
                    <ThemeText
                      styles={styles.optionSubtitle}
                      content={displayCorrectDenomination({
                        amount: fromMicros(goal.currentAmountMicros),
                        masterInfoObject: {
                          ...masterInfoObject,
                          userBalanceDenomination: 'fiat',
                        },
                        fiatStats,
                        forceCurrency: 'USD',
                        convertAmount: false,
                      })}
                    />
                  </View>
                </View>
                <ThemeIcon iconName="ChevronRight" size={16} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  if (currentPage === 'source') {
    return (
      <View style={styles.container}>
        <ThemeText
          styles={styles.title}
          content={t('savings.addMoney.sourceTitle')}
        />

        <View style={styles.optionsList}>
          {sourceOptions.map(option => (
            <TouchableOpacity
              key={option.key}
              activeOpacity={0.7}
              style={[
                styles.optionRow,
                {
                  backgroundColor:
                    theme && darkModeType ? backgroundColor : backgroundOffset,
                },
              ]}
              onPress={() => {
                setSelectedSource(option.key);
                setInputDenomination(
                  option.key === 'dollar'
                    ? 'fiat'
                    : masterInfoObject.userBalanceDenomination != 'fiat'
                    ? 'sats'
                    : 'fiat',
                );
                setStep(prev => [...prev, 'amount']);
              }}
            >
              <View style={styles.optionLeft}>
                <View
                  style={[
                    styles.iconContainer,
                    {
                      backgroundColor:
                        theme && darkModeType
                          ? darkModeType
                            ? backgroundOffset
                            : backgroundColor
                          : option.key === 'dollar'
                          ? COLORS.dollarGreen
                          : COLORS.bitcoinOrange,
                    },
                  ]}
                >
                  <ThemeImage
                    styles={{ width: 25, height: 25 }}
                    lightModeIcon={
                      option.key === 'dollar'
                        ? ICONS.dollarIcon
                        : ICONS.bitcoinIcon
                    }
                    darkModeIcon={
                      option.key === 'dollar'
                        ? ICONS.dollarIcon
                        : ICONS.bitcoinIcon
                    }
                    lightsOutIcon={
                      option.key === 'dollar'
                        ? ICONS.dollarIcon
                        : ICONS.bitcoinIcon
                    }
                  />
                </View>
                <View>
                  <ThemeText
                    styles={styles.optionTitle}
                    content={option.title}
                  />
                  <ThemeText
                    styles={styles.optionSubtitle}
                    content={option.subtitle}
                  />
                </View>
              </View>
              <ThemeIcon iconName="ChevronRight" size={16} />
            </TouchableOpacity>
          ))}
        </View>
        {step.length > 1 && (
          <CustomButton
            buttonStyles={{ ...CENTER }}
            actionFunction={() => {
              setStep(prev => prev.slice(0, -1));
            }}
            textContent={t('constants.back')}
          />
        )}
      </View>
    );
  }

  if (currentPage === 'amount') {
    return (
      <View style={styles.amountContainer}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.amountScrollContainer}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={handleDenominationToggle}
          >
            <FormattedBalanceInput
              maxWidth={0.9}
              amountValue={amountValue}
              inputDenomination={primaryDisplay.denomination}
              forceCurrency={primaryDisplay.forceCurrency}
              forceFiatStats={primaryDisplay.forceFiatStats}
            />
            <FormattedSatText
              containerStyles={{
                opacity: !amountValue ? HIDDEN_OPACITY : 1,
              }}
              neverHideBalance={true}
              styles={{ includeFontPadding: false, textAlign: 'center' }}
              globalBalanceDenomination={secondaryDisplay.denomination}
              forceCurrency={secondaryDisplay.forceCurrency}
              forceFiatStats={secondaryDisplay.forceFiatStats}
              balance={localSatAmount}
            />
          </TouchableOpacity>
          <ThemeText
            styles={styles.availableHintText}
            content={t('savings.withdraw.availableHint', {
              amount: displayCorrectDenomination({
                amount: availableBalance,
                masterInfoObject: {
                  ...masterInfoObject,
                  userBalanceDenomination:
                    paymentMode === 'USD' ? 'fiat' : 'sats',
                },
                fiatStats,
                forceCurrency: 'USD',
                convertAmount: paymentMode === 'USD' ? false : true,
              }),
            })}
          />

          {selectedSource === 'bitcoin' && (
            <ThemeText
              styles={styles.minHintText}
              content={t('savings.addMoney.minHint', {
                amount: displayCorrectDenomination({
                  amount: swapLimits.bitcoin,
                  masterInfoObject: {
                    ...masterInfoObject,
                    userBalanceDenomination: 'sats',
                  },
                  fiatStats,
                }),
              })}
            />
          )}
        </ScrollView>

        <CustomNumberKeyboard
          showDot={primaryDisplay.denomination === 'fiat'}
          setInputValue={setAmountValue}
          usingForBalance={true}
          fiatStats={conversionFiatStats}
        />

        <CustomButton
          buttonStyles={{ ...CENTER }}
          actionFunction={() => {
            if (!canContinue) {
              setStep(prev => prev.slice(0, -1));
              return;
            }
            if (paymentMode === 'BTC' && localSatAmount >= bitcoinBalance)
              return;
            if (
              paymentMode === 'USD' &&
              fiatMicros >= dollarBalanceToken * Math.pow(10, 6)
            )
              return;
            if (paymentMode === 'BTC' && localSatAmount <= swapLimits.bitcoin) {
              return;
            }
            setStep(prev => [...prev, 'confirm']);
          }}
          textContent={
            !canContinue ? t('constants.back') : t('constants.continue')
          }
        />
      </View>
    );
  }

  if (currentPage === 'confirm') {
    return (
      <View style={styles.container}>
        <ThemeText
          styles={styles.title}
          content={t('savings.addMoney.confirmTitle')}
        />
        <View
          style={[
            styles.summaryCard,
            {
              backgroundColor:
                theme && darkModeType ? backgroundColor : backgroundOffset,
            },
          ]}
        >
          <ThemeText
            styles={styles.summaryLabel}
            content={t('savings.addMoney.youAreAdding')}
          />
          <ThemeText
            styles={styles.summaryAmount}
            content={displayCorrectDenomination({
              amount: fiatMicros / Math.pow(10, 6),
              masterInfoObject: {
                ...masterInfoObject,
                userBalanceDenomination: 'fiat',
              },
              fiatStats,
              forceCurrency: 'USD',
              convertAmount: false,
            })}
          />
          <ThemeText
            styles={styles.summaryLabel}
            content={t('savings.addMoney.fromBalance', {
              source: selectedSource || 'wallet',
            })}
          />
        </View>
        <CustomButton
          buttonStyles={styles.primaryButton}
          actionFunction={handleConfirm}
          textContent={t('savings.addMoney.confirmButton')}
        />
      </View>
    );
  }

  if (currentPage === 'loading') {
    return <FullLoadingScreen text={t('savings.addMoney.processing')} />;
  }

  // success
  return (
    <View style={styles.successContainer}>
      <LottieView
        source={confirmAnimation}
        loop={false}
        autoPlay={true}
        style={styles.animation}
      />
      <ThemeText
        styles={styles.successText}
        content={t('savings.addMoney.successTitle')}
      />
      <CustomButton
        actionFunction={handleDone}
        textContent={t('constants.done')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: SIZES.xLarge,
    fontWeight: 500,
    includeFontPadding: false,
    marginBottom: 16,
  },
  optionsList: {
    gap: 10,
    flex: 1,
  },
  goalSection: {
    marginBottom: 14,
    gap: 8,
  },
  goalSectionTitle: {
    fontSize: SIZES.small,
    opacity: 0.7,
    includeFontPadding: false,
  },
  goalChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  goalChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  goalChipSelected: {
    borderColor: COLORS.primary,
  },
  goalChipText: {
    fontSize: SIZES.small,
    includeFontPadding: false,
  },
  optionRow: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionLeft: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionTitle: {
    fontWeight: 500,
    flexShrink: 1,
    fontSize: SIZES.large,
    includeFontPadding: false,
  },
  optionSubtitle: {
    opacity: 0.7,
    includeFontPadding: false,
  },
  amountContainer: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  amountScrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  availableHintText: {
    textAlign: 'center',
    opacity: 0.6,
    fontSize: SIZES.small,
    marginTop: 10,
    includeFontPadding: false,
  },
  minHintText: {
    textAlign: 'center',
    opacity: 0.6,
    fontSize: SIZES.small,
    marginTop: 2,
    includeFontPadding: false,
  },
  summaryCard: {
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryLabel: {
    opacity: 0.7,
    includeFontPadding: false,
    fontSize: SIZES.smedium,
  },
  summaryAmount: {
    fontSize: 40,
    includeFontPadding: false,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  disabledButton: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: COLORS.white,
    includeFontPadding: false,
  },
  successContainer: {
    flex: 1,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  animation: {
    width: 125,
    height: 125,
  },
  successText: {
    fontSize: SIZES.large,
    includeFontPadding: false,
    marginBottom: 'auto',
  },
});
