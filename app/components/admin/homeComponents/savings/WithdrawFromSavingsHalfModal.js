import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import {
  useSavings,
  UNALLOCATED_GOAL_ID,
} from '../../../../../context-store/savingsContext';
import { ThemeText } from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import GetThemeColors from '../../../../hooks/themeColors';
import {
  CENTER,
  COLORS,
  ICONS,
  SIZES,
  STARTING_INDEX_FOR_SAVINGS_DERIVE,
} from '../../../../constants';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import { fromMicros } from './utils';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import usePaymentInputDisplay from '../../../../hooks/usePaymentInputDisplay';
import {
  BTC_ASSET_ADDRESS,
  dollarsToSats,
  getUserSwapHistory,
  satsToDollars,
  simulateSwap,
  swapTokenToBitcoin,
  USD_ASSET_ADDRESS,
} from '../../../../functions/spark/flashnet';
import { sparkPaymenWrapper } from '../../../../functions/spark/payments';
import { useKeysContext } from '../../../../../context-store/keys';
import { useActiveCustodyAccount } from '../../../../../context-store/activeAccount';
import { deriveSparkGiftMnemonic } from '../../../../functions/gift/deriveGiftWallet';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../constants/theme';
import { useUserBalanceContext } from '../../../../../context-store/userBalanceContext';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import convertTextInputValue from '../../../../functions/textInputConvertValue';
import { updateConfirmAnimation } from '../../../../functions/lottieViewColorTransformer';
import FormattedBalanceInput from '../../../../functions/CustomElements/formattedBalanceInput';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../functions/CustomElements/button';
import LottieView from 'lottie-react-native';
import { initializeSparkWallet } from '../../../../functions/spark';
import {
  addSingleUnpaidSparkTransaction,
  bulkUpdateSparkTransactions,
} from '../../../../functions/spark/transactions';
import { setFlashnetTransfer } from '../../../../functions/spark/handleFlashnetTransferIds';

const confirmTxAnimation = require('../../../../assets/confirmTxAnimation.json');

const HEIGHT_FOR_PAGE = {
  chooseGoal: 500,
  destination: 500,
  amount: 600,
  confirm: 500,
  loading: 500,
  success: 500,
};

export default function WithdrawFromSavingsHalfModal({
  currentBalance,
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
  const { accountMnemoinc } = useKeysContext();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { bitcoinBalance, dollarBalanceToken, dollarBalanceSat } =
    useUserBalanceContext();
  const {
    withdrawMoney,
    refreshSavings,
    refreshBalances,
    savingsGoals,
    getGoalBalanceMicros,
    walletBalanceMicros,
    totalGoalsBalance,
    savingsBalance,
    savingsWallet,
  } = useSavings();
  const { sparkInformation } = useSparkWallet();

  const [step, setStep] = useState([
    selectedGoalUUID || !savingsGoals.length ? 'destination' : 'chooseGoal',
  ]);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [amountValue, setAmountValue] = useState('');
  // When true the user chose "Withdraw All" — skips amount step and drains
  // every goal + unallocated balance in a single payment.
  const [isWithdrawAll, setIsWithdrawAll] = useState(false);

  // Cached savings wallet mnemonic — derived lazily on first use
  const savingsWalletMnemonicRef = useRef(null);

  const getSavingsWalletMnemonic = useCallback(async () => {
    if (savingsWalletMnemonicRef.current)
      return savingsWalletMnemonicRef.current;
    const result = await deriveSparkGiftMnemonic(
      accountMnemoinc,
      STARTING_INDEX_FOR_SAVINGS_DERIVE,
    );
    if (!result?.success)
      throw new Error('Unable to derive savings wallet mnemonic');
    savingsWalletMnemonicRef.current = result.derivedMnemonic;
    return result.derivedMnemonic;
  }, [accountMnemoinc]);

  const [inputDenomination, setInputDenomination] = useState(
    selectedDestination === 'dollar'
      ? 'fiat'
      : masterInfoObject.userBalanceDenomination != 'fiat'
      ? 'sats'
      : 'fiat',
  );

  const fiatStats = globalFiatStats;
  const [selectedGoalId, setSelectedGoalId] = useState(selectedGoalUUID);

  const currentPage = step[step.length - 1];

  // Dollar destination → user types USD; Bitcoin destination → user types sats/fiat
  const paymentMode = selectedDestination === 'dollar' ? 'USD' : 'BTC';

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

  const destinationOptions = [
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

  const localSatAmount = convertDisplayToSats(amountValue);

  // USD value of what the user wants to withdraw (in micros)
  const fiatMicros =
    (satsToDollars(localSatAmount, swapUSDPriceDollars) / 100).toFixed(2) *
    1_000_000;

  // Full savings wallet balance (all goals + unallocated) — used for Withdraw All.
  const totalWithdrawMicros =
    walletBalanceMicros ?? (currentBalance || 0) * 1_000_000;

  // Available balance for the selected goal.
  // For UNALLOCATED we subtract goal-allocated micros so the hint and
  // validation reflect only the truly unallocated portion.
  const availableBalanceMicros =
    !selectedGoalId || selectedGoalId === UNALLOCATED_GOAL_ID
      ? totalWithdrawMicros -
        Math.round(Number(totalGoalsBalance || 0) * 1_000_000)
      : getGoalBalanceMicros(selectedGoalId);

  const balanceUsd = availableBalanceMicros / 1_000_000;

  // Simulate USDB→BTC swap upfront so fee info is ready for BTC withdrawals.
  // For Withdraw All, simulate the full wallet balance. For normal path,
  // simulate the user-entered fiatMicros amount.
  // The simulation uses the savings wallet mnemonic but swaps execute in the
  // main wallet after USDB arrives there.
  const simulationPromiseRef = useRef(null);
  const [simulationResult, setSimulationResult] = useState(null);
  const simulationAmountMicros = isWithdrawAll
    ? totalWithdrawMicros
    : fiatMicros;

  useEffect(() => {
    if (selectedDestination !== 'bitcoin' || !simulationAmountMicros) {
      simulationPromiseRef.current = null;
      setSimulationResult(null);
      return;
    }
    const promise = simulateSwap(currentWalletMnemoinc, {
      poolId: poolInfoRef.lpPublicKey,
      assetInAddress: USD_ASSET_ADDRESS,
      assetOutAddress: BTC_ASSET_ADDRESS,
      amountIn: Math.round(simulationAmountMicros),
    });
    simulationPromiseRef.current = promise;
    promise
      .then(swap => {
        if (swap?.didWork) setSimulationResult(swap.simulation);
        else setSimulationResult(null);
      })
      .catch(() => setSimulationResult(null));
  }, [
    selectedDestination,
    simulationAmountMicros,
    poolInfoRef.lpPublicKey,
    getSavingsWalletMnemonic,
  ]);

  const handleDenominationToggle = () => {
    const nextDenom = getNextDenomination();
    setInputDenomination(nextDenom);
    setAmountValue(convertForToggle(amountValue, convertTextInputValue));
  };

  // Adjust modal height on step change
  useEffect(() => {
    if (setContentHeight && HEIGHT_FOR_PAGE[currentPage]) {
      setContentHeight(HEIGHT_FOR_PAGE[currentPage]);
    }
  }, [currentPage, setContentHeight]);

  const handleBackPress = useCallback(() => {
    if (currentPage === 'loading') return true; // block
    if (currentPage === 'destination' || currentPage === 'success')
      return false; // let parent close
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

  const parsedAmount = Number(amountValue || 0);

  const handleConfirm = async () => {
    setStep(prev => [...prev, 'loading']);
    try {
      const savingsMnemonic = await getSavingsWalletMnemonic();
      const mainSparkAddress = sparkInformation?.sparkAddress;
      if (!mainSparkAddress) throw new Error(t('savings.savingsWalletError'));

      // For Withdraw All we send the full wallet balance; otherwise the user-
      // entered amount. confirmMicros drives both the payment and the DB record.
      const confirmMicros = isWithdrawAll
        ? totalWithdrawMicros
        : Math.min(fiatMicros, availableBalanceMicros);
      const confirmSats = Math.round(
        dollarsToSats(confirmMicros / 1_000_000, poolInfoRef.currentPriceAInB),
      );

      const initResponse = await await initializeSparkWallet(
        savingsMnemonic,
        false,
        {
          maxRetries: 4,
        },
      );

      if (!initResponse) {
        throw new Error(t('savings.savingsWalletError'));
      }

      // Step 1: Savings wallet sends USDB tokens to the main wallet's Spark address.
      // This works for both destinations — for BTC we then swap in the main wallet.
      const sendResponse = await sparkPaymenWrapper({
        address: mainSparkAddress,
        paymentType: 'spark',
        amountSats: confirmSats,
        masterInfoObject,
        memo: t('savings.withdraw.paymentLabel', {
          context: selectedGoalId,
          savingsGoal: savingsGoals.find(item => item.id === selectedGoalId)
            ?.name,
        }),
        userBalance: 0,
        sparkInformation: {
          identityPubKey: savingsWallet?.identityPublicKeyHex || '',
        },
        mnemonic: savingsMnemonic,
        usablePaymentMethod: 'USD', // savings always holds USDB
        paymentInfo: {
          data: {
            expectedReceive: 'tokens',
          },
        },
        fiatValueConvertedSendAmount: confirmMicros,
        poolInfoRef,
      });

      if (!sendResponse?.didWork) {
        throw new Error(sendResponse?.error);
      }

      // Step 2 (Bitcoin destination only): Main wallet swaps received USDB → BTC.
      if (selectedDestination === 'bitcoin') {
        if (simulationPromiseRef.current) {
          await simulationPromiseRef.current;
        }
        if (!simulationResult) {
          addSingleUnpaidSparkTransaction({
            id: sendResponse.response.id,
            description: t('savings.withdraw.paymentLabel', {
              context: selectedGoalId,
              savingsGoal: savingsGoals.find(item => item.id === selectedGoalId)
                ?.name,
            }),
            sendersPubkey: '',
            details: {},
          });
          throw new Error(t('savings.swapSimulationError'));
        }
        // set incoming tx as hidden
        setFlashnetTransfer(sendResponse.response.id);

        // start swap
        const result = await swapTokenToBitcoin(currentWalletMnemoinc, {
          tokenAddress: USD_ASSET_ADDRESS,
          tokenAmount: Math.round(simulationAmountMicros),
          poolId: poolInfoRef.lpPublicKey,
        });

        if (result.didWork && result.swap) {
          const userSwaps = await getUserSwapHistory(currentWalletMnemoinc, 5);
          const swap = userSwaps.swaps.find(
            savedSwap =>
              savedSwap.outboundTransferId === result.swap.outboundTransferId,
          );
          // set incoming tx to swap as hidden
          setFlashnetTransfer(swap.inboundTransferId);

          const realFeeAmount = Math.round(
            dollarsToSats(
              parseFloat(result.swap.feeAmount) / Math.pow(10, 6),
              result.swap.executionPrice,
            ),
          );

          const incomingTransfer = {
            id: swap.outboundTransferId,
            paymentStatus: 'completed',
            paymentType: 'spark',
            accountId: sparkInformation.identityPubKey,
            details: {
              fee: realFeeAmount,
              totalFee: realFeeAmount,
              supportFee: 0,
              amount: parseFloat(swap.amountOut),
              description: t('savings.withdraw.paymentLabel', {
                context: selectedGoalId,
                savingsGoal: savingsGoals.find(
                  item => item.id === selectedGoalId,
                )?.name,
              }),
              address: sparkInformation.sparkAddress,
              time: Date.now() + 1000,
              createdAt: Date.now() + 1000,
              direction: 'INCOMING',
              showSwapLabel: true,
              currentPriceAInB: result.swap.executionPrice,
            },
          };
          bulkUpdateSparkTransactions([incomingTransfer], 'fullUpdate');
        }
      } else {
        addSingleUnpaidSparkTransaction({
          id: sendResponse.response.id,
          description: t('savings.withdraw.paymentLabel', {
            context: selectedGoalId,
            savingsGoal: savingsGoals.find(item => item.id === selectedGoalId)
              ?.name,
          }),
          sendersPubkey: '',
          details: {},
        });
      }

      // Record withdrawal(s) in savings database.
      if (isWithdrawAll) {
        // Record a withdrawal for each named goal that has a non-zero balance.
        for (const goal of savingsGoals) {
          const goalMicros = getGoalBalanceMicros(goal.id);
          if (goalMicros > 0) {
            await withdrawMoney({
              amount: goalMicros / 1_000_000,
              goalId: goal.id,
            });
          }
        }
        // Record the unallocated portion if any remains.
        const unallocatedMicros =
          totalWithdrawMicros -
          Math.round(Number(totalGoalsBalance || 0) * 1_000_000);
        if (unallocatedMicros > 0) {
          await withdrawMoney({
            amount: unallocatedMicros / 1_000_000,
            goalId: UNALLOCATED_GOAL_ID,
          });
        }
      } else {
        await withdrawMoney({
          amount: confirmMicros / 1_000_000,
          goalId: selectedGoalId,
        });
      }

      setStep(prev => [...prev, 'success']);
    } catch (err) {
      handleBackPressFunction(() =>
        navigate.replace('ErrorScreen', {
          errorMessage:
            err?.message ||
            t('savings.withdraw.errors.unableToCompleteWithdrawal'),
        }),
      );
    }
  };

  const handleDone = async () => {
    await refreshSavings();
    if (refreshBalances) await refreshBalances({ force: true });
    handleBackPressFunction();
  };

  if (currentPage === 'chooseGoal') {
    return (
      <View style={styles.container}>
        <ThemeText
          styles={styles.title}
          content={t('savings.withdraw.chooseGoalTitle')}
        />
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            gap: 15,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Withdraw All — drains the entire savings wallet in one action */}
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
              setIsWithdrawAll(true);
              setSelectedGoalId(UNALLOCATED_GOAL_ID);
              setStep(prev => [...prev, 'destination']);
            }}
          >
            <View style={styles.optionLeft}>
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: COLORS.primary },
                ]}
              >
                <ThemeIcon
                  iconName="ArrowDownToLine"
                  size={22}
                  colorOverride={COLORS.white}
                />
              </View>
              <View>
                <ThemeText
                  styles={styles.optionTitle}
                  content={t('savings.withdraw.withdrawAll')}
                />
                <ThemeText
                  styles={styles.optionSubtitle}
                  content={displayCorrectDenomination({
                    amount: fromMicros(totalWithdrawMicros),
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

          {/* General savings — always shown */}
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
              setStep(prev => [...prev, 'destination']);
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
                  content={t('savings.withdraw.generalSavings')}
                />
                <ThemeText
                  styles={styles.optionSubtitle}
                  content={displayCorrectDenomination({
                    amount: (savingsBalance - totalGoalsBalance).toFixed(2),
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
                  setStep(prev => [...prev, 'destination']);
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

  if (currentPage === 'destination') {
    return (
      <View style={styles.container}>
        <ThemeText
          styles={styles.title}
          content={t('savings.withdraw.destinationTitle')}
        />

        <View style={styles.optionsList}>
          {destinationOptions.map(option => (
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
                setSelectedDestination(option.key);
                setInputDenomination(
                  option.key === 'dollar'
                    ? 'fiat'
                    : masterInfoObject.userBalanceDenomination != 'fiat'
                    ? 'sats'
                    : 'fiat',
                );
                // Withdraw All skips the amount step — amount is the full balance.
                setStep(prev => [
                  ...prev,
                  isWithdrawAll ? 'confirm' : 'amount',
                ]);
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
      </View>
    );
  }

  if (currentPage === 'amount') {
    const canContinue = (() => {
      if (!amountValue || parsedAmount <= 0) return false;
      if (selectedDestination === 'bitcoin') {
        if (
          localSatAmount <=
          dollarsToSats(swapLimits.usd, poolInfoRef.currentPriceAInB)
        )
          return false;
        if (fiatMicros > availableBalanceMicros) return false;
      } else {
        if (fiatMicros > availableBalanceMicros) return false;
      }
      return true;
    })();

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
                amount: balanceUsd,
                masterInfoObject: {
                  ...masterInfoObject,
                  userBalanceDenomination: 'fiat',
                },
                fiatStats,
                forceCurrency: 'USD',
                convertAmount: false,
              }),
            })}
          />

          {selectedDestination === 'bitcoin' && (
            <ThemeText
              styles={styles.minHintText}
              content={t('savings.withdraw.minHint', {
                amount: displayCorrectDenomination({
                  amount: dollarsToSats(
                    swapLimits.usd,
                    poolInfoRef.currentPriceAInB,
                  ),
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
            if (!amountValue) {
              setStep(prev => prev.slice(0, -1));
              return;
            }
            if (!canContinue) return;
            setStep(prev => [...prev, 'confirm']);
          }}
          textContent={
            !amountValue ? t('constants.back') : t('constants.continue')
          }
        />
      </View>
    );
  }

  if (currentPage === 'confirm') {
    // Withdraw All uses the full wallet balance; normal path uses user-entered amount.
    const confirmMicros = isWithdrawAll ? totalWithdrawMicros : fiatMicros;

    const withdrawAmountDisplay = displayCorrectDenomination({
      amount: (confirmMicros / 1_000_000).toFixed(2),
      masterInfoObject: {
        ...masterInfoObject,
        userBalanceDenomination: 'fiat',
      },
      fiatStats,
      forceCurrency: 'USD',
      convertAmount: false,
    });

    const destinationLabel =
      selectedDestination === 'bitcoin'
        ? t('constants.sat_balance')
        : t('constants.usd_balance');

    const estimatedBtcOut =
      selectedDestination === 'bitcoin' && simulationResult
        ? Math.round(
            Number(simulationResult.expectedOutput || 0),
          ).toLocaleString()
        : null;

    return (
      <View style={styles.container}>
        <ThemeText
          styles={styles.title}
          content={t('savings.withdraw.confirmTitle')}
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
            content={
              isWithdrawAll
                ? t('savings.withdraw.youAreWithdrawingAll')
                : t('savings.withdraw.youAreWithdrawing')
            }
          />
          <ThemeText
            styles={styles.summaryAmount}
            content={withdrawAmountDisplay}
          />
          <ThemeText
            styles={styles.summaryLabel}
            content={t('savings.withdraw.toYourBalance', {
              destination: destinationLabel,
            })}
          />
          {estimatedBtcOut && (
            <ThemeText
              styles={[styles.summaryLabel, { marginTop: 8 }]}
              content={t('savings.withdraw.estimatedSats', {
                sats: estimatedBtcOut,
              })}
            />
          )}
        </View>
        <CustomButton
          buttonStyles={styles.primaryButton}
          actionFunction={handleConfirm}
          textContent={t('savings.withdraw.confirmButton')}
        />
      </View>
    );
  }

  if (currentPage === 'loading') {
    return <FullLoadingScreen text={t('savings.withdraw.processing')} />;
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
        content={t('savings.withdraw.successTitle')}
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
  emojiText: {
    fontSize: 24,
    includeFontPadding: false,
  },
  optionTitle: {
    fontWeight: 500,
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
    marginTop: 6,
    includeFontPadding: false,
  },
  minHintText: {
    textAlign: 'center',
    opacity: 0.5,
    fontSize: SIZES.small,
    marginTop: 4,
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
