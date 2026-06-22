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
import NoContentSceen from '../../../../functions/CustomElements/noContentScreen';
import GetThemeColors from '../../../../hooks/themeColors';
import {
  CENTER,
  COLORS,
  CONTENT_KEYBOARD_OFFSET,
  SIZES,
  STARTING_INDEX_FOR_SAVINGS_DERIVE,
  USDB_TOKEN_ID,
} from '../../../../constants';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import { fromMicros } from './utils';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import useCurrencyDisplay from '../../../../hooks/useCurrencyDisplay';
import useDisplayCurrencyController from '../../../../hooks/useDisplayCurrencyController';
import {
  dollarsToSats,
  satsToDollars,
} from '../../../../functions/spark/flashnet';
import { sparkPaymenWrapper } from '../../../../functions/spark/payments';
import { useKeysContext } from '../../../../../context-store/keys';
import { deriveSparkGiftMnemonic } from '../../../../functions/gift/deriveGiftWallet';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import {
  FONT,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../constants/theme';
import { updateConfirmAnimation } from '../../../../functions/lottieViewColorTransformer';
import FormattedBalanceInput from '../../../../functions/CustomElements/formattedBalanceInput';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../functions/CustomElements/button';
import LottieView from 'lottie-react-native';
import {
  getSparkBalance,
  initializeSparkWallet,
} from '../../../../functions/spark';
import { bulkUpdateSparkTransactions } from '../../../../functions/spark/transactions';
import { createBalancePoller } from '../../../../functions/pollingManager';
import {
  getLocalStorageItem,
  setLocalStorageItem,
} from '../../../../functions/localStorage';
import SkeletonPlaceholder from '../../../../functions/CustomElements/skeletonView';
import { useAppStatus } from '../../../../../context-store/appStatus';
import { getDefaultDisplayCurrency } from '../../../../functions/displayCurrency';
import CurrencySwitchButton from '../../../../functions/CustomElements/currencySwitchButton';

const confirmTxAnimation = require('../../../../assets/confirmTxAnimation.json');

const SKELETON_STYLES = {
  icon: {
    height: 48,
    width: 48,
    borderRadius: 100,
  },
  content: {
    flex: 1,
    height: 30,
  },
  line: {
    flex: 1,
    marginBottom: 10,
    borderRadius: 100,
  },
  lastLine: {
    flex: 1,
    borderRadius: 100,
  },
};

// Persists { pollTimestamp: number, balance: number } so the balance poller
// can be skipped when no new interest payment has arrived since the last poll.
const SAVINGS_INTEREST_POLL_CACHE_KEY = 'savings_interest_poll_cache';

const MIN_STEP_MS = 800;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Messages cycled on the full-screen loader while the savings wallet connects
// and its Bitcoin balance settles via the poller.
const LOADING_MESSAGE_KEYS = [
  'savings.withdraw.loadingSteps.connecting',
  'savings.withdraw.loadingSteps.updating',
  'savings.withdraw.loadingSteps.finalizing',
];
const LOADING_MESSAGE_INTERVAL_MS = 2500;

const HEIGHT_FOR_PAGE = {
  balanceType: 500,
  chooseGoal: 500,
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
  setBackNav,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats: globalFiatStats } = useNodeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { swapUSDPriceDollars, poolInfoRef } = useFlashnet();
  const { accountMnemoinc } = useKeysContext();
  const { screenDimensions } = useAppStatus();
  const {
    withdrawMoney,
    withdrawlFromRewards,
    refreshSavings,
    refreshBalances,
    savingsGoals,
    getGoalBalanceMicros,
    walletBalanceMicros,
    totalGoalsBalance,
    savingsBalance,
    savingsWallet,
    interestPayouts,
  } = useSavings();
  const { sparkInformation } = useSparkWallet();
  console.log(screenDimensions);
  const [step, setStep] = useState([
    selectedGoalUUID ? 'amount' : 'balanceType',
  ]);
  const [walletBTCBalance, setWalletBTCBalance] = useState(null);
  const [cachedBalance, setCachedBalance] = useState(0);
  // Destination is derived from the balance type: interest → main wallet's
  // Bitcoin balance, savings → main wallet's dollar balance. A preselected goal
  // is always a savings (dollar) withdrawal.
  const [selectedDestination, setSelectedDestination] = useState(
    selectedGoalUUID ? 'dollar' : null,
  );
  const [amountValue, setAmountValue] = useState('');
  // When true the user chose "Withdraw All" — skips amount step and drains
  // every goal + unallocated balance in a single payment.
  const [isWithdrawAll, setIsWithdrawAll] = useState(false);
  // When true the user chose "Send Max" on the amount page — uses the exact
  // availableBalanceMicros so sub-cent balances can still be swept.
  const [isSendMax, setIsSendMax] = useState(false);
  // Which asset type the user wants to withdraw ('savings' | 'interest' | null)
  const [selectedBalanceType, setSelectedBalanceType] = useState(
    selectedGoalUUID || !savingsGoals.length ? 'savings' : null,
  );
  // Tracks savings wallet init progress for the balanceType page
  // 'idle' | 'loading' | 'ready' | 'error' — does NOT trigger FullLoadingScreen
  const [sparkInitStatus, setSparkInitStatus] = useState('idle');
  const [balanceReady, setBalanceReady] = useState(false);
  const [loadingStep, setLoadingStep] = useState('processing');
  const [skeletonLayout, setSkeletonLayout] = useState({
    width: 80,
    height: 23,
  });
  const maxLayoutRef = useRef({
    width: 80,
    height: 23,
  });

  const didInitSparkRef = useRef(false);
  const pollerAbortRef = useRef(null);

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

  const fiatStats = globalFiatStats;
  const [selectedGoalId, setSelectedGoalId] = useState(selectedGoalUUID);

  const currentPage = step[step.length - 1];

  // True while the balanceType page is still resolving balances — the wallet is
  // initialising, or it's initialised but the Bitcoin balance poller hasn't
  // settled yet. Drives the cycling full-screen loader below.
  const isLoadingBalances =
    currentPage === 'balanceType' &&
    sparkInitStatus !== 'error' &&
    (sparkInitStatus === 'idle' ||
      sparkInitStatus === 'loading' ||
      !balanceReady);

  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  useEffect(() => {
    if (!isLoadingBalances) {
      setLoadingMessageIndex(0);
      return;
    }
    const intervalId = setInterval(() => {
      setLoadingMessageIndex(prev =>
        Math.min(prev + 1, LOADING_MESSAGE_KEYS.length - 1),
      );
    }, LOADING_MESSAGE_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [isLoadingBalances]);

  // Dollar destination → user types USD; Bitcoin destination → user types sats/fiat
  const paymentMode = selectedBalanceType !== 'interest' ? 'USD' : 'BTC';
  const usdFiatStats = useMemo(
    () => ({ coin: 'USD', value: swapUSDPriceDollars }),
    [swapUSDPriceDollars],
  );
  const initialDisplayCurrency = useMemo(
    () =>
      getDefaultDisplayCurrency({
        paymentMode,
        masterInfoObject,
        fiatStats,
      }),
    [paymentMode, masterInfoObject, fiatStats],
  );

  // Interest balance (BTC sats held in savings wallet from payouts)
  const interestSats = walletBTCBalance ?? cachedBalance ?? 0;

  // Savings balance in USD (fromMicros of walletBalanceMicros)
  const savingsBalanceUsd = Number(savingsBalance || 0);

  const isInterestDisabled = interestSats <= 0;
  const isSavingsDisabled = savingsBalanceUsd <= 0;

  const { displayCurrency, currencyRates, isLoadingRate, selectCurrency } =
    useDisplayCurrencyController({
      initialCurrency: initialDisplayCurrency,
      fiatStats,
      usdFiatStats,
      masterInfoObject,
    });

  const { primaryDisplay, conversionFiatStats, convertDisplayToSats } =
    useCurrencyDisplay({
      displayCurrency,
      fiatStats,
      usdFiatStats,
      currencyRates,
      masterInfoObject,
    });

  const handleSkeletonLayout = useCallback(event => {
    const { height, width } = event.nativeEvent.layout;
    console.log(height, width);
    const newH = Math.max(maxLayoutRef.current.height, height);
    const newW = Math.max(maxLayoutRef.current.width, width);
    console.log(height, width);
    if (
      newH !== maxLayoutRef.current.height ||
      newW !== maxLayoutRef.current.width
    ) {
      maxLayoutRef.current = { height: newH, width: newW };
      setSkeletonLayout({ height: newH, width: newW });
    }
  }, []);

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

  // ─── BACKGROUND INIT EFFECT ───────────────────────────────────────────────
  // Fires once when the balanceType page first mounts. The page renders
  // immediately — the interest balance shows a skeleton shimmer until the
  // balance poller settles on a confirmed value.
  //
  //  1. initializeSparkWallet — full init needed before any send can execute.
  //  2. createBalancePoller   — polls getSparkBalance until it stabilises,
  //                             then sets walletBTCBalance and balanceReady.
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (didInitSparkRef.current) return;
    didInitSparkRef.current = true;

    const abortController = new AbortController();
    pollerAbortRef.current = abortController;

    const initWallet = async () => {
      setSparkInitStatus('loading');
      try {
        const rawCache = await getLocalStorageItem(
          SAVINGS_INTEREST_POLL_CACHE_KEY,
        );
        if (rawCache) {
          const { balance = 0 } = JSON.parse(rawCache);
          setCachedBalance(balance);
        }
        const savingsMnemonic = await getSavingsWalletMnemonic();
        const initResponse = await initializeSparkWallet(
          savingsMnemonic,
          false,
          { maxRetries: 4 },
        );

        if (abortController.signal.aborted) return;

        if (!initResponse) {
          setSparkInitStatus('error');
          return;
        }

        // const sparkBalance = await getSparkBalance(savingsMnemonic);

        setSparkInitStatus('ready');

        // Now poll until the balance stabilises so we show a confirmed number.
        const mnemonicRef = { current: savingsMnemonic };
        const poller = createBalancePoller(
          savingsMnemonic,
          mnemonicRef,
          abortController,
          async balanceResult => {
            const newBalance = Number(balanceResult.balance);
            setWalletBTCBalance(newBalance);
            setBalanceReady(true);
            // Persist poll result so future opens can skip the poller when
            // no new interest payment has arrived.
            setLocalStorageItem(
              SAVINGS_INTEREST_POLL_CACHE_KEY,
              JSON.stringify({
                pollTimestamp: Date.now(),
                balance: newBalance,
              }),
            );
          },
          null, // no initial balance — let poller establish the baseline
          2,
        );

        await poller.start();
        // Safety net: the poller only fires onBalanceUpdate when the balance
        // settles. If it exhausts its retries (e.g. balance calls keep failing)
        // mark ready anyway so the UI never hangs on the loader — interestSats
        // falls back to the cached value / 0.
        if (!abortController.signal.aborted) setBalanceReady(true);
      } catch {
        if (!abortController.signal.aborted) setSparkInitStatus('error');
      }
    };

    initWallet();
    return () => {
      abortController.abort();
    };
  }, [getSavingsWalletMnemonic]);

  // Adjust modal height on step change
  useEffect(() => {
    if (setContentHeight && HEIGHT_FOR_PAGE[currentPage]) {
      setContentHeight(HEIGHT_FOR_PAGE[currentPage]);
    }
  }, [currentPage, setContentHeight]);

  const handleBackPress = useCallback(() => {
    if (currentPage === 'loading') return true; // block
    // balanceType is the first step (amount when entered from a goal); success
    // still closes.
    if (
      currentPage === 'balanceType' ||
      (currentPage === 'amount' && step.length === 1) ||
      currentPage === 'success'
    )
      return false; // let parent close
    if (currentPage === 'confirm') {
      setIsSendMax(false);
    }
    setStep(prev => prev.slice(0, -1));
    return true;
  }, [currentPage, step]);

  const confirmAnimation = useMemo(() => {
    return updateConfirmAnimation(
      confirmTxAnimation,
      theme ? (darkModeType ? 'lightsOut' : 'dark') : 'light',
    );
  }, [theme, darkModeType]);

  useHandleBackPressNew(handleBackPress);

  // Register the chrome's back arrow whenever a previous step exists, and the
  // currency switch button while the amount step is active.
  useEffect(() => {
    const showBack =
      step.length > 1 && currentPage !== 'loading' && currentPage !== 'success';
    const showCurrency = currentPage === 'amount';
    if (showBack || showCurrency) {
      setBackNav?.({
        onPress: showBack ? handleBackPress : null,
        title: '',
      });
    } else {
      setBackNav?.(null);
    }
    return () => setBackNav?.(null);
  }, [
    step,
    currentPage,
    handleBackPress,
    setBackNav,
    displayCurrency,
    isLoadingRate,
  ]);

  const parsedAmount = Number(amountValue || 0);

  const handleConfirm = async () => {
    setStep(prev => [...prev, 'loading']);
    setLoadingStep('processing');
    try {
      // Step 1: Processing — mnemonic derivation, validation, spark init
      const step1Start = Date.now();

      const savingsMnemonic = await getSavingsWalletMnemonic();
      const mainSparkAddress = sparkInformation?.sparkAddress;
      if (!mainSparkAddress) throw new Error(t('savings.savingsWalletError'));

      // Interest withdrawal path — savings wallet sends BTC sats (not USDB)
      if (selectedBalanceType === 'interest') {
        // initializeSparkWallet already called on balanceType page; returns fast
        const initResponse = await initializeSparkWallet(
          savingsMnemonic,
          false,
          {
            maxRetries: 4,
          },
        );
        if (!initResponse) throw new Error(t('savings.savingsWalletError'));

        const amountSats = isSendMax ? interestSats : localSatAmount;

        const elapsed1 = Date.now() - step1Start;
        if (elapsed1 < MIN_STEP_MS) await sleep(MIN_STEP_MS - elapsed1);

        // Step 2: Withdrawing from Savings account — send BTC from savings to main wallet
        setLoadingStep('withdrawing_rewards');
        const step2Start = Date.now();

        const sendResponse = await sparkPaymenWrapper({
          address: mainSparkAddress,
          paymentType: 'spark',
          amountSats,
          masterInfoObject,
          memo: t('savings.withdraw.interestPaymentLabel'),
          userBalance: 0,
          sparkInformation: {
            identityPubKey: savingsWallet?.identityPublicKeyHex || '',
          },
          mnemonic: savingsMnemonic,
          usablePaymentMethod: 'BTC',
          paymentInfo: {
            data: {
              expectedReceive: 'sats',
            },
          },
          poolInfoRef,
        });

        if (!sendResponse?.didWork) throw new Error(sendResponse?.error);

        // Invalidate the balance cache so the next modal open reflects the
        // post-withdrawal balance without needing to re-poll.
        const remainingBalance = Math.max(
          0,
          (walletBTCBalance ?? 0) - amountSats,
        );
        setLocalStorageItem(
          SAVINGS_INTEREST_POLL_CACHE_KEY,
          JSON.stringify({
            pollTimestamp: Date.now(),
            balance: remainingBalance,
          }),
        );

        await bulkUpdateSparkTransactions(
          [
            {
              id: sendResponse.response.id,
              paymentStatus: 'completed',
              paymentType: 'spark',
              accountId: sparkInformation.identityPubKey,
              details: {
                fee: 0,
                totalFee: 0,
                supportFee: 0,
                amount: amountSats,
                description: t('savings.withdraw.interestPaymentLabel'),
                address: sparkInformation.sparkAddress,
                time: Date.now(),
                createdAt: Date.now(),
                direction: 'INCOMING',
                isSavings: true,
              },
            },
          ],
          'fullUpdate',
        );
        await withdrawlFromRewards(amountSats);

        const elapsed2 = Date.now() - step2Start;
        if (elapsed2 < MIN_STEP_MS) await sleep(MIN_STEP_MS - elapsed2);

        setStep(prev => [...prev, 'success']);
        return;
      }

      // For Withdraw All we send the full wallet balance; for Send Max the full
      // available goal balance; otherwise the user-entered amount.
      const confirmMicros = isWithdrawAll
        ? totalWithdrawMicros
        : isSendMax
        ? availableBalanceMicros
        : Math.min(fiatMicros, availableBalanceMicros);
      const confirmSats = Math.round(
        dollarsToSats(confirmMicros / 1_000_000, poolInfoRef.currentPriceAInB),
      );

      const initResponse = await initializeSparkWallet(savingsMnemonic, false, {
        maxRetries: 4,
      });

      if (!initResponse) {
        throw new Error(t('savings.savingsWalletError'));
      }

      const elapsed1 = Date.now() - step1Start;
      if (elapsed1 < MIN_STEP_MS) await sleep(MIN_STEP_MS - elapsed1);

      // Step 2: Withdrawing from Savings account — send USDB tokens to main wallet
      setLoadingStep('withdrawing_savings');
      const step2Start = Date.now();

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

      const elapsed2 = Date.now() - step2Start;
      if (elapsed2 < MIN_STEP_MS) await sleep(MIN_STEP_MS - elapsed2);

      // Record the incoming USDB token in the main wallet's dollar balance.
      await bulkUpdateSparkTransactions(
        [
          {
            id: sendResponse.response.id,
            paymentStatus: 'completed',
            paymentType: 'spark',
            accountId: sparkInformation.identityPubKey,
            details: {
              fee: 0,
              totalFee: 0,
              supportFee: 0,
              amount: confirmMicros,
              description: t('savings.withdraw.paymentLabel', {
                context: selectedGoalId,
                savingsGoal: savingsGoals.find(
                  item => item.id === selectedGoalId,
                )?.name,
              }),
              address: sparkInformation.sparkAddress,
              time: Date.now(),
              createdAt: Date.now(),
              direction: 'INCOMING',
              isSavings: true,
              isLRC20Payment: true,
              LRC20Token: USDB_TOKEN_ID,
            },
          },
        ],
        'fullUpdate',
      );

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
      setLoadingStep('processing');
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
    refreshSavings();
    if (refreshBalances) refreshBalances({ force: true });
    handleBackPressFunction();
  };

  // Choose between Interest or Savings balance
  if (currentPage === 'balanceType') {
    // While the wallet connects and the Bitcoin balance settles, cycle through
    // status messages on a full-screen loader.
    if (isLoadingBalances) {
      return (
        <FullLoadingScreen
          text={t(LOADING_MESSAGE_KEYS[loadingMessageIndex])}
        />
      );
    }

    // Wallet failed to initialise — prompt the user to retry.
    if (sparkInitStatus === 'error') {
      return (
        <View style={styles.container}>
          <ThemeText
            styles={styles.title}
            content={t('savings.withdraw.balanceTypeTitle')}
          />
          <ThemeText
            styles={styles.balanceLoadErrorText}
            content={t('savings.withdraw.balanceLoadError')}
          />
        </View>
      );
    }

    // Balances settled but there is nothing to withdraw — show an empty state.
    if (isInterestDisabled && isSavingsDisabled) {
      return (
        <NoContentSceen
          iconName="PiggyBank"
          titleText={t('savings.withdraw.empty.title')}
          subTitleText={t('savings.withdraw.empty.subtitle')}
        />
      );
    }

    return (
      <View style={styles.container}>
        <ThemeText
          styles={styles.title}
          content={t('savings.withdraw.balanceTypeTitle')}
        />

        <View style={styles.optionsList}>
          {/* Interest option — BTC sats from savings payouts */}
          <View>
            <TouchableOpacity
              activeOpacity={
                isInterestDisabled && balanceReady ? HIDDEN_OPACITY : 0.7
              }
              style={[
                styles.optionRow,
                {
                  backgroundColor:
                    theme && darkModeType ? backgroundColor : backgroundOffset,
                  opacity:
                    isInterestDisabled && balanceReady ? HIDDEN_OPACITY : 1,
                },
              ]}
              onPress={() => {
                if (isInterestDisabled || !balanceReady) return;
                setSelectedBalanceType('interest');
                setSelectedDestination('bitcoin');
                setAmountValue('');
                setStep(prev => [...prev, 'amount']);
              }}
            >
              {balanceReady ? (
                <View style={styles.optionLeft}>
                  <View
                    style={[
                      styles.iconContainer,
                      {
                        backgroundColor:
                          theme && darkModeType
                            ? backgroundOffset
                            : COLORS.primary,
                      },
                    ]}
                  >
                    <ThemeIcon
                      iconName="TrendingUp"
                      size={22}
                      colorOverride={COLORS.white}
                    />
                  </View>
                  <View style={{ flexShrink: 1 }}>
                    <ThemeText
                      styles={styles.optionTitle}
                      content={t('savings.withdraw.interestOption')}
                    />

                    {isInterestDisabled ? (
                      <ThemeText
                        styles={styles.optionSubtitle}
                        content={t('savings.withdraw.interestZeroHint')}
                      />
                    ) : (
                      <ThemeText
                        styles={styles.optionSubtitle}
                        content={
                          isInterestDisabled
                            ? t('savings.withdraw.interestZeroHint')
                            : displayCorrectDenomination({
                                amount: interestSats,
                                masterInfoObject: {
                                  ...masterInfoObject,
                                  userBalanceDenomination: 'sats',
                                },
                                fiatStats,
                              })
                        }
                      />
                    )}
                  </View>
                </View>
              ) : (
                <SkeletonPlaceholder
                  enabled={true}
                  backgroundColor={COLORS.opaicityGray}
                  highlightColor={
                    theme
                      ? darkModeType
                        ? COLORS.lightsOutBackground
                        : COLORS.darkModeBackground
                      : COLORS.lightModeBackground
                  }
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      width: screenDimensions.width * 0.9 - 48,
                      gap: 10,
                    }}
                  >
                    <View style={SKELETON_STYLES.icon} />
                    <View style={SKELETON_STYLES.content}>
                      <View style={SKELETON_STYLES.line} />
                      <View style={SKELETON_STYLES.lastLine} />
                    </View>
                  </View>
                </SkeletonPlaceholder>
              )}
              {!isInterestDisabled && balanceReady && (
                <ThemeIcon iconName="ChevronRight" size={16} />
              )}
            </TouchableOpacity>
          </View>

          {/* Savings option — USDB tokens from user deposits */}
          <TouchableOpacity
            activeOpacity={isSavingsDisabled ? HIDDEN_OPACITY : 0.7}
            style={[
              styles.optionRow,
              {
                backgroundColor:
                  theme && darkModeType ? backgroundColor : backgroundOffset,
                opacity: isSavingsDisabled ? HIDDEN_OPACITY : 1,
              },
            ]}
            onPress={() => {
              if (isSavingsDisabled) return;
              setSelectedBalanceType('savings');
              setSelectedDestination('dollar');
              setAmountValue('');
              if (selectedGoalUUID && !savingsGoals.length) {
                setStep(prev => [...prev, 'amount']);
              } else {
                setStep(prev => [...prev, 'chooseGoal']);
              }
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
              <View style={{ flexShrink: 1 }}>
                <ThemeText
                  styles={styles.optionTitle}
                  content={t('savings.withdraw.savingsOption')}
                />
                <ThemeText
                  styles={styles.optionSubtitle}
                  content={
                    isSavingsDisabled
                      ? t('savings.withdraw.savingsZeroHint')
                      : displayCorrectDenomination({
                          amount: savingsBalanceUsd,
                          masterInfoObject: {
                            ...masterInfoObject,
                            userBalanceDenomination: 'fiat',
                          },
                          fiatStats,
                          forceCurrency: 'USD',
                          convertAmount: false,
                        })
                  }
                />
              </View>
            </View>
            {!isSavingsDisabled && (
              <ThemeIcon iconName="ChevronRight" size={16} />
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (currentPage === 'chooseGoal') {
    const shouldShowWithdrawlAll =
      fromMicros(totalWithdrawMicros) !== savingsBalance - totalGoalsBalance;

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
          {shouldShowWithdrawlAll && (
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
                // Withdraw All drains the whole wallet — skip amount entry.
                setStep(prev => [...prev, 'confirm']);
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
                          : COLORS.primary,
                    },
                  ]}
                >
                  <ThemeIcon
                    iconName="ArrowDownToLine"
                    size={22}
                    colorOverride={COLORS.white}
                  />
                </View>
                <View style={{ flexShrink: 1 }}>
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
          )}

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
                        ? backgroundOffset
                        : backgroundColor,
                  },
                ]}
              >
                <ThemeText styles={styles.emojiText} content="🏦" />
              </View>
              <View style={{ flexShrink: 1 }}>
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
                            ? backgroundOffset
                            : backgroundColor,
                      },
                    ]}
                  >
                    <ThemeText styles={styles.emojiText} content={goal.emoji} />
                  </View>
                  <View style={{ flexShrink: 1 }}>
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
        <CustomButton
          buttonStyles={{ ...CENTER, marginTop: CONTENT_KEYBOARD_OFFSET }}
          actionFunction={() => {
            setStep(prev => prev.slice(0, -1));
          }}
          textContent={t('constants.back')}
        />
      </View>
    );
  }

  if (currentPage === 'amount') {
    // Interest → direct BTC send (validate sats); savings → direct USDB send
    // (validate USD micros). Neither path swaps, so there's no swap minimum.
    const canContinue = (() => {
      if (!amountValue || parsedAmount <= 0) return false;

      if (selectedBalanceType === 'interest') {
        return localSatAmount <= interestSats;
      }

      return fiatMicros <= availableBalanceMicros;
    })();

    // available hint — show sats for interest, USD for savings
    const availableHintAmount =
      selectedBalanceType === 'interest'
        ? displayCorrectDenomination({
            amount: interestSats,
            masterInfoObject: {
              ...masterInfoObject,
              userBalanceDenomination: 'sats',
            },
            fiatStats,
          })
        : displayCorrectDenomination({
            amount: balanceUsd,
            masterInfoObject: {
              ...masterInfoObject,
              userBalanceDenomination: 'fiat',
            },
            fiatStats,
            forceCurrency: 'USD',
            convertAmount: false,
          });

    return (
      <View style={styles.amountContainer}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.amountScrollContainer}
        >
          <FormattedBalanceInput
            maxWidth={0.9}
            amountValue={amountValue}
            inputDenomination={primaryDisplay.denomination}
            forceCurrency={primaryDisplay.forceCurrency}
            forceFiatStats={primaryDisplay.forceFiatStats}
          />

          <ThemeText
            styles={styles.availableHintText}
            content={t('savings.withdraw.availableHint', {
              amount: availableHintAmount,
            })}
          />
        </ScrollView>
        <TouchableOpacity
          style={styles.sendMaxButton}
          onPress={() => {
            setIsSendMax(true);
            setStep(prev => [...prev, 'confirm']);
          }}
        >
          <ThemeText
            styles={styles.sendMaxText}
            content={t('savings.withdraw.withdrawlAll')}
          />
        </TouchableOpacity>
        <CustomNumberKeyboard
          showDot={primaryDisplay.denomination === 'fiat'}
          setInputValue={setAmountValue}
          usingForBalance={true}
          fiatStats={conversionFiatStats}
        />

        <CustomButton
          buttonStyles={{
            ...CENTER,
            opacity: !canContinue && localSatAmount !== 0 ? HIDDEN_OPACITY : 1,
          }}
          actionFunction={() => {
            if (!amountValue) {
              setStep(prev => prev.slice(0, -1));
              return;
            }

            if (selectedBalanceType === 'interest') {
              // balance is in Bitcoin
              if (localSatAmount > interestSats) {
                navigate.navigate('ErrorScreen', {
                  errorMessage: t(
                    'screens.inAccount.swapsPage.insufficientBalance',
                  ),
                });
                return;
              }
            } else {
              // balance is in dollars
              if (fiatMicros > availableBalanceMicros) {
                navigate.navigate('ErrorScreen', {
                  errorMessage: t(
                    'screens.inAccount.swapsPage.insufficientBalance',
                  ),
                });
                return;
              }
            }

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
    // Withdraw All uses the full wallet balance; Send Max uses the exact goal
    // balance; normal path uses the user-entered amount.
    const confirmMicros = isWithdrawAll
      ? totalWithdrawMicros
      : isSendMax
      ? availableBalanceMicros
      : fiatMicros;

    // MODIFIED: for interest, display the sats amount directly (no USD micros)
    const withdrawAmountDisplay =
      selectedBalanceType === 'interest'
        ? displayCorrectDenomination({
            amount: isSendMax ? interestSats : localSatAmount,
            masterInfoObject: {
              ...masterInfoObject,
              userBalanceDenomination: 'sats',
            },
            fiatStats,
          })
        : displayCorrectDenomination({
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

    const selectedGoal = savingsGoals.find(item => item.id === selectedGoalId);
    const isMaxOrAll = isWithdrawAll || isSendMax;
    const confirmDescription = (() => {
      const dest = destinationLabel;
      if (selectedBalanceType === 'interest') {
        return isMaxOrAll
          ? t('savings.withdraw.confirmSubtitle_interestAll', {
              destination: dest,
            })
          : t('savings.withdraw.confirmSubtitle_interest', {
              destination: dest,
            });
      }
      if (selectedGoal) {
        return isMaxOrAll
          ? t('savings.withdraw.confirmSubtitle_goalAll', {
              goalName: selectedGoal.name,
              destination: dest,
            })
          : t('savings.withdraw.confirmSubtitle_goal', {
              goalName: selectedGoal.name,
              destination: dest,
            });
      }
      return isMaxOrAll
        ? t('savings.withdraw.confirmSubtitle_generalAll', {
            destination: dest,
          })
        : t('savings.withdraw.confirmSubtitle_general', {
            destination: dest,
          });
    })();

    return (
      <View style={styles.confirmContainer}>
        <ThemeText
          styles={[styles.title, { marginBottom: 8 }]}
          content={t('savings.withdraw.confirmTitle')}
        />
        <ThemeText
          styles={styles.confirmDescription}
          content={confirmDescription}
        />
        <ThemeText
          styles={[
            styles.summaryAmount,
            { textAlign: 'center', marginBottom: 'auto' },
          ]}
          content={withdrawAmountDisplay}
        />
        <CustomButton
          buttonStyles={styles.primaryButton}
          actionFunction={handleConfirm}
          textContent={t('savings.withdraw.confirmButton')}
        />
      </View>
    );
  }

  if (currentPage === 'loading') {
    return (
      <FullLoadingScreen
        containerStyles={{ width: INSET_WINDOW_WIDTH, ...CENTER }}
        textStyles={{ textAlign: 'center' }}
        text={t(`savings.withdraw.steps.${loadingStep}`)}
      />
    );
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
  confirmContainer: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  title: {
    fontSize: SIZES.large,
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
    flexShrink: 1,
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
    includeFontPadding: false,
    flexShrink: 1,
  },
  optionSubtitle: {
    width: '100%',
    opacity: 0.7,
    includeFontPadding: false,
    fontSize: SIZES.medium,
    fontFamily: FONT.Title_Regular,
    flexShrink: 1,
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
  sendMaxButton: {
    alignSelf: 'center',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  sendMaxText: {
    fontSize: SIZES.small,
    textAlign: 'center',
    textDecorationLine: 'underline',
    includeFontPadding: false,
  },
  confirmDescription: {
    opacity: 0.7,
    includeFontPadding: false,
    fontSize: SIZES.smedium,
    marginBottom: 45,
  },
  summaryLabel: {
    opacity: 0.7,
    includeFontPadding: false,
    fontSize: SIZES.smedium,
    textAlign: 'center',
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
  // NEW: error message displayed on the balanceType page when Spark init fails
  balanceLoadErrorText: {
    textAlign: 'center',
    opacity: 0.7,
    fontSize: SIZES.smedium,
    includeFontPadding: false,
    paddingHorizontal: 16,
  },
});
