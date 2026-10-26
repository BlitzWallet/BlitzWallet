import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import {
  useSavings,
  UNALLOCATED_GOAL_ID,
} from '../../../../../context-store/savingsContext';
import { ThemeText } from '../../../../functions/CustomElements';
import GetThemeColors from '../../../../hooks/themeColors';
import {
  CENTER,
  STARTING_INDEX_FOR_SAVINGS_DERIVE,
  USDB_TOKEN_ID,
} from '../../../../constants';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import { fromMicros } from './utils';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useGlobalContextProvider } from '../../../../../context-store/context';
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
import { FONT, INSET_WINDOW_WIDTH } from '../../../../constants/theme';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../functions/CustomElements/button';
import {
  initializeSparkWallet,
  disposeSparkWallet,
} from '../../../../functions/spark';
import { bulkUpdateSparkTransactions } from '../../../../functions/spark/transactions';
import { subscribeToSparkBalance } from '../../../../functions/spark/awaitBalanceChange';
import {
  getLocalStorageItem,
  setLocalStorageItem,
} from '../../../../functions/localStorage';
import { getDefaultDisplayCurrency } from '../../../../functions/displayCurrency';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import AmountHero from '../../../../functions/CustomElements/redesign/AmountHero';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import StepProgress from '../../../../functions/CustomElements/redesign/StepProgress';
import AnimatedStep, {
  growThenStep,
  useStepSheetHeight,
} from '../../../../functions/CustomElements/redesign/AnimatedStep';
import {
  AssetDisc,
  EmojiDisc,
  SheetEmpty,
  SheetResult,
  SheetTitle,
} from './savingsSheetParts';

// Persists { pollTimestamp: number, balance: number } so the balance poller
// can be skipped when no new interest payment has arrived since the last poll.
const SAVINGS_INTEREST_POLL_CACHE_KEY = 'savings_interest_poll_cache';

const MIN_STEP_MS = 800;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Reveal the balanceType page once the balance has held steady for
// BALANCE_STABILIZE_MS (no further inbound claims), or after
// BALANCE_STABILIZE_MAX_MS as an absolute cap — whichever comes first.
const BALANCE_STABILIZE_MS = 3000;
const BALANCE_STABILIZE_MAX_MS = 30000;

const GENERAL_GOAL_EMOJI = '🏦';
const MAX_SHEET_HEIGHT = 700;
const STEP_HEIGHTS = {
  balanceType: 400,
  amount: 740,
  confirm: 440,
  loading: 440,
  success: 520,
};

export default function WithdrawFromSavingsHalfModal({
  currentBalance,
  setContentHeight,
  handleBackPressFunction,
  selectedGoalUUID,
  setDismissLocked,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats: globalFiatStats } = useNodeContext();
  const { tokens } = GetThemeColors();
  const { swapUSDPriceDollars, poolInfoRef } = useFlashnet();
  const { accountMnemoinc } = useKeysContext();
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
    walletBitcoinBalanceSats,
  } = useSavings();
  const { sparkInformation } = useSparkWallet();
  const [step, setStep] = useState([
    selectedGoalUUID ? 'amount' : 'balanceType',
  ]);
  const [direction, setDirection] = useState(1);
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
  // Display amount captured at Confirm (see shownWithdrawAmount).
  const [sentWithdrawAmount, setSentWithdrawAmount] = useState(null);
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
  const confirmingRef = useRef(false);
  const balanceSubscriptionRef = useRef(null);

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
  // initialising, or it's initialised but the first balance event hasn't landed
  // yet. Drives the full-screen loader below.
  const isLoadingBalances =
    currentPage === 'balanceType' &&
    sparkInitStatus !== 'error' &&
    (sparkInitStatus === 'idle' ||
      sparkInitStatus === 'loading' ||
      !balanceReady);

  // State-driven loader copy: connecting while the wallet initialises, then
  // loading while we wait for the first balance event to settle the balance.
  const loadingBalancesMessage =
    sparkInitStatus === 'ready'
      ? t('savings.withdraw.loadingSteps.loadingBalance')
      : t('savings.withdraw.loadingSteps.connecting');

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

  // Interest balance (BTC sats held in savings wallet from payouts).
  // walletBTCBalance (poller, catches unsettled interest) takes priority;
  // walletBitcoinBalanceSats (context, settled-only but reliable) is the floor
  // so a real balance is never shown as 0 when the poller hasn't settled yet.
  const interestSats =
    walletBTCBalance ?? walletBitcoinBalanceSats ?? cachedBalance ?? 0;

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
  // Fires once when the balanceType page first mounts. A full-screen loader
  // shows until the balance has stabilized, so the user never watches it climb.
  //
  //  1. initializeSparkWallet   — full init needed before any send can execute.
  //  2. subscribeToSparkBalance — immediate read, then live balance:update
  //                               events refine it while the modal is open (no
  //                               polling). The page is revealed only once the
  //                               balance holds steady for BALANCE_STABILIZE_MS
  //                               (no more inbound claims), or after the
  //                               BALANCE_STABILIZE_MAX_MS cap — whichever first.
  //                               Updates that land after reveal still refine the
  //                               balance live without re-blocking the UI.
  // On unmount the subscription is torn down and the savings wallet session is
  // disposed (safe: savingsContext reads via a separate read-only viewer).
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (didInitSparkRef.current) return;
    didInitSparkRef.current = true;

    let cancelled = false;
    // Trailing debounce: reveal the page once the balance holds steady.
    let stabilizeTimer = null;
    // Absolute cap: reveal even if inbound claims never stop (or the first read
    // stalls) — interestSats falls back to cache / 0.
    let hardCapTimer = null;
    // Value-gate so a no-op re-read doesn't defer the reveal.
    let lastSeenBalance = null;
    // Once the page is shown we stop gating the UI; balance keeps updating live.
    let revealed = false;

    const revealPage = () => {
      if (cancelled || revealed) return;
      revealed = true;
      if (stabilizeTimer) clearTimeout(stabilizeTimer);
      if (hardCapTimer) clearTimeout(hardCapTimer);
      setBalanceReady(true);
    };

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

        if (cancelled) return;

        if (!initResponse?.isConnected) {
          setSparkInitStatus('error');
          return;
        }

        setSparkInitStatus('ready');

        hardCapTimer = setTimeout(revealPage, BALANCE_STABILIZE_MAX_MS);

        balanceSubscriptionRef.current = subscribeToSparkBalance({
          mnemonic: savingsMnemonic,
          onUpdate: result => {
            if (cancelled) return;

            // Always apply the balance — live updates continue even after the
            // page is revealed (e.g. a claim that lands past the 30s cap).
            if (result?.didWork) {
              const newBalance = Number(result.balance);
              setWalletBTCBalance(newBalance);
              // Persist so future opens can show a value instantly.
              setLocalStorageItem(
                SAVINGS_INTEREST_POLL_CACHE_KEY,
                JSON.stringify({
                  pollTimestamp: Date.now(),
                  balance: newBalance,
                }),
              );
            }

            // Page already shown → stop gating the UI; balance keeps flowing.
            if (revealed) return;

            // Value-gate: only a real change means claims are still landing.
            if (result?.didWork) {
              const newBalance = Number(result.balance);
              if (newBalance === lastSeenBalance) return;
              lastSeenBalance = newBalance;
            }

            // Trailing debounce: reveal once the balance holds steady for
            // BALANCE_STABILIZE_MS; hardCapTimer bounds the total wait at 30s.
            if (stabilizeTimer) clearTimeout(stabilizeTimer);
            stabilizeTimer = setTimeout(revealPage, BALANCE_STABILIZE_MS);
          },
        });
      } catch {
        if (!cancelled) setSparkInitStatus('error');
      }
    };

    initWallet();
    return () => {
      cancelled = true;
      if (stabilizeTimer) clearTimeout(stabilizeTimer);
      if (hardCapTimer) clearTimeout(hardCapTimer);
      balanceSubscriptionRef.current?.unsubscribe();
      balanceSubscriptionRef.current = null;
      // Close the savings wallet session/listeners on unmount.
      if (savingsWalletMnemonicRef.current) {
        disposeSparkWallet(savingsWalletMnemonicRef.current);
      }
    };
  }, [getSavingsWalletMnemonic]);

  const chooseGoalHeight = Math.min(
    MAX_SHEET_HEIGHT,
    Math.max(460, 200 + (savingsGoals.length + 2) * 65),
  );
  const heightFor = page =>
    page === 'chooseGoal' ? chooseGoalHeight : STEP_HEIGHTS[page];

  useStepSheetHeight(setContentHeight, heightFor(currentPage));

  // The sheet can't be swiped or tapped away while the withdrawal is in flight.
  useEffect(() => {
    setDismissLocked?.(currentPage === 'loading');
  }, [currentPage, setDismissLocked]);

  // A step's exit side is read from its last render while still active, so
  // the direction has to land one render before the step changes.
  const moveStep = useCallback(
    (nextDirection, nextPage, update) => {
      setDirection(nextDirection);
      growThenStep(
        setContentHeight,
        heightFor(currentPage),
        heightFor(nextPage),
        () => setTimeout(() => setStep(update), 0),
      );
    },
    [currentPage, setContentHeight, chooseGoalHeight],
  );

  const pushStep = useCallback(
    page => moveStep(1, page, prev => [...prev, page]),
    [moveStep],
  );

  const goBack = useCallback(() => {
    if (currentPage === 'confirm') {
      // Leaving confirm drops the max/all choice so a later goal pick
      // withdraws only what is typed.
      setIsSendMax(false);
      setIsWithdrawAll(false);
    }
    moveStep(-1, step[step.length - 2], prev => prev.slice(0, -1));
  }, [currentPage, step, moveStep]);

  const handleBackPress = useCallback(() => {
    if (currentPage === 'loading') return true; // block
    // balanceType is the first step (amount when entered from a goal); success
    // still closes.
    if (step.length === 1 || currentPage === 'success') return false; // let parent close
    goBack();
    return true;
  }, [currentPage, step, goBack]);

  useHandleBackPressNew(handleBackPress);

  const parsedAmount = Number(amountValue || 0);

  const handleConfirm = async () => {
    // The confirm step stays tappable while it animates out.
    if (confirmingRef.current) return;
    confirmingRef.current = true;
    setSentWithdrawAmount(liveWithdrawAmount);
    pushStep('loading');
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
        if (!initResponse?.isConnected)
          throw new Error(t('savings.savingsWalletError'));

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

        pushStep('success');
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

      if (!initResponse?.isConnected) {
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

      pushStep('success');
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

  const formatUsd = amount =>
    displayCorrectDenomination({
      amount: Number(amount || 0).toFixed(2),
      masterInfoObject: {
        ...masterInfoObject,
        userBalanceDenomination: 'fiat',
      },
      fiatStats,
      forceCurrency: 'USD',
      convertAmount: false,
    });
  const formatSats = amount =>
    displayCorrectDenomination({
      amount,
      masterInfoObject: {
        ...masterInfoObject,
        userBalanceDenomination: 'sats',
      },
      fiatStats,
    });

  const isInterest = selectedBalanceType === 'interest';
  const selectedGoal = savingsGoals.find(item => item.id === selectedGoalId);
  const sourceLabel = isInterest
    ? t('savings.withdraw.interestOption')
    : isWithdrawAll
    ? t('savings.home.title')
    : selectedGoal
    ? `${selectedGoal.emoji} ${selectedGoal.name}`
    : `${GENERAL_GOAL_EMOJI} ${t('savings.withdraw.generalSavings')}`;
  // Other locales still read `destination` as the old balance name.
  const destination =
    selectedDestination === 'bitcoin'
      ? t('constants.sat_balance')
      : t('constants.usd_balance');
  const destinationLabel =
    selectedDestination === 'bitcoin'
      ? t('savings.bitcoinBalance')
      : t('savings.dollarBalance');

  // Withdraw All uses the full wallet balance; Send Max uses the exact goal
  // balance; normal path uses the user-entered amount.
  const confirmMicros = isWithdrawAll
    ? totalWithdrawMicros
    : isSendMax
    ? availableBalanceMicros
    : fiatMicros;
  const liveWithdrawAmount = isInterest
    ? isSendMax
      ? interestSats
      : localSatAmount
    : (confirmMicros / 1_000_000).toFixed(2);
  // Max/all amounts read the balance, which drops to 0 once the withdrawal
  // lands, so loading and success show the amount frozen at Confirm.
  const shownWithdrawAmount = sentWithdrawAmount ?? liveWithdrawAmount;
  const withdrawAmountProps = isInterest
    ? {
        amount: shownWithdrawAmount,
        fiatStats,
        masterInfoObject: {
          ...masterInfoObject,
          userBalanceDenomination: 'sats',
        },
      }
    : {
        amount: shownWithdrawAmount,
        fiatStats,
        masterInfoObject: {
          ...masterInfoObject,
          userBalanceDenomination: 'fiat',
        },
        forceCurrency: 'USD',
        convertAmount: false,
      };
  const withdrawAmountText = isInterest
    ? formatSats(withdrawAmountProps.amount)
    : formatUsd(withdrawAmountProps.amount);

  const closeOrBack =
    step.length > 1 ? goBack : () => handleBackPressFunction();
  const backBar = (
    <View style={styles.backBar}>
      <TopBar onBack={closeOrBack} />
    </View>
  );

  // ─── balanceType: Bitcoin rewards or goal money ───────────────────────────
  const renderBalanceType = () => {
    // While the wallet connects and the first balance event settles, show a
    // loader with state-driven status copy.
    if (isLoadingBalances) {
      return (
        <View style={styles.loading}>
          <StepProgress title={loadingBalancesMessage} />
        </View>
      );
    }

    // Wallet failed to initialise — prompt the user to retry.
    if (sparkInitStatus === 'error') {
      return (
        <SheetEmpty
          icon="CircleAlert"
          title={t('savings.withdraw.balanceTypeTitle')}
          sub={t('savings.withdraw.balanceLoadError')}
          buttonText={t('constants.back')}
          onPress={() => handleBackPressFunction()}
        />
      );
    }

    // Balances settled but there is nothing to withdraw — show an empty state.
    if (isInterestDisabled && isSavingsDisabled) {
      return (
        <SheetEmpty
          icon="Wallet"
          title={t('savings.withdraw.empty.title')}
          sub={t('savings.withdraw.empty.subtitle')}
          buttonText={t('constants.back')}
          onPress={() => handleBackPressFunction()}
        />
      );
    }

    return (
      <>
        <SheetTitle
          title={t('savings.withdraw.balanceTypeTitle')}
          first={true}
        />
        <View style={styles.list}>
          <ListCard tone="flush">
            {/* Interest option — BTC sats from savings payouts */}
            <View
              key="interest"
              style={isInterestDisabled && styles.disabledRow}
            >
              <ListRow
                lead={<AssetDisc asset="bitcoin" />}
                title={t('savings.withdraw.interestOption')}
                titleStyle={styles.rowTitle}
                sub={
                  isInterestDisabled
                    ? t('savings.withdraw.interestZeroHint')
                    : t('savings.withdraw.interestEarned', {
                        amount: displayCorrectDenomination({
                          amount: interestSats,
                          masterInfoObject,
                          fiatStats,
                        }),
                      })
                }
                subLines={1}
                minHeight={64}
                showChevron={!isInterestDisabled}
                onPress={() => {
                  if (isInterestDisabled || !balanceReady) return;
                  setSelectedBalanceType('interest');
                  setSelectedDestination('bitcoin');
                  setAmountValue('');
                  pushStep('amount');
                }}
              />
            </View>

            {/* Savings option — USDB tokens from user deposits */}
            <View key="savings" style={isSavingsDisabled && styles.disabledRow}>
              <ListRow
                lead={<EmojiDisc emoji={GENERAL_GOAL_EMOJI} />}
                title={t('savings.withdraw.savingsOption')}
                titleStyle={styles.rowTitle}
                sub={
                  isSavingsDisabled
                    ? t('savings.withdraw.savingsZeroHint')
                    : formatUsd(savingsBalanceUsd)
                }
                subLines={1}
                minHeight={64}
                showChevron={!isSavingsDisabled}
                onPress={() => {
                  if (isSavingsDisabled) return;
                  setSelectedBalanceType('savings');
                  setSelectedDestination('dollar');
                  setAmountValue('');
                  if (selectedGoalUUID && !savingsGoals.length) {
                    pushStep('amount');
                  } else {
                    pushStep('chooseGoal');
                  }
                }}
              />
            </View>
          </ListCard>
        </View>
      </>
    );
  };

  // ─── chooseGoal: which goal to withdraw from ──────────────────────────────
  const renderChooseGoal = () => {
    const shouldShowWithdrawlAll =
      fromMicros(totalWithdrawMicros) !== savingsBalance - totalGoalsBalance;

    const goalRow = ({ key, emoji, title, amount, onPress }) => (
      <ListRow
        key={key}
        lead={<EmojiDisc emoji={emoji} />}
        title={title}
        titleStyle={styles.rowTitle}
        trailing={
          <ThemeText
            styles={[styles.rowValue, { color: tokens.muted }]}
            content={amount}
          />
        }
        minHeight={64}
        showChevron={true}
        onPress={onPress}
      />
    );

    return (
      <>
        {backBar}
        <SheetTitle title={t('savings.withdraw.chooseGoalTitle')} />
        <CustomScrollView
          style={styles.list}
          showsVerticalScrollIndicator={false}
        >
          <ListCard tone="flush">
            {/* Withdraw All — drains the entire savings wallet in one action */}
            {shouldShowWithdrawlAll &&
              goalRow({
                key: 'withdrawAll',
                emoji: '💸',
                title: t('savings.withdraw.withdrawAll'),
                amount: formatUsd(fromMicros(totalWithdrawMicros)),
                onPress: () => {
                  setIsWithdrawAll(true);
                  setSelectedGoalId(UNALLOCATED_GOAL_ID);
                  // Withdraw All drains the whole wallet — skip amount entry.
                  pushStep('confirm');
                },
              })}

            {/* General savings — always shown */}
            {goalRow({
              key: UNALLOCATED_GOAL_ID,
              emoji: GENERAL_GOAL_EMOJI,
              title: t('savings.withdraw.generalSavings'),
              amount: formatUsd(
                (savingsBalance - totalGoalsBalance).toFixed(2),
              ),
              onPress: () => {
                setSelectedGoalId(UNALLOCATED_GOAL_ID);
                pushStep('amount');
              },
            })}

            {savingsGoals.map(goal =>
              goalRow({
                key: goal.id,
                emoji: goal.emoji,
                title: goal.name,
                amount: formatUsd(fromMicros(goal.currentAmountMicros)),
                onPress: () => {
                  setSelectedGoalId(goal.id);
                  pushStep('amount');
                },
              }),
            )}
          </ListCard>
        </CustomScrollView>
      </>
    );
  };

  // ─── amount ───────────────────────────────────────────────────────────────
  const renderAmount = () => {
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
        ? formatSats(interestSats)
        : formatUsd(balanceUsd);

    return (
      <>
        {backBar}
        <View style={styles.amountBlock}>
          <AmountHero
            amount={
              primaryDisplay.denomination === 'fiat'
                ? Number(amountValue || 0).toFixed(2)
                : amountValue || 0
            }
            fiatStats={primaryDisplay.forceFiatStats}
            masterInfoObject={{
              ...masterInfoObject,
              userBalanceDenomination: primaryDisplay.denomination,
            }}
            forceCurrency={primaryDisplay.forceCurrency}
            convertAmount={false}
            amountSize={52}
          />
          <ThemeText
            styles={[styles.hint, { color: tokens.muted }]}
            content={t('savings.withdraw.availableFrom', {
              amount: availableHintAmount,
              source: sourceLabel,
            })}
          />
          <TouchableOpacity
            style={[styles.maxPill, { backgroundColor: tokens.disc }]}
            accessibilityRole="button"
            onPress={() => {
              setIsSendMax(true);
              pushStep('confirm');
            }}
          >
            <ThemeText
              styles={styles.maxPillText}
              content={t('savings.withdraw.withdrawAll')}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.keypad}>
          <CustomNumberKeyboard
            showDot={primaryDisplay.denomination === 'fiat'}
            setInputValue={setAmountValue}
            usingForBalance={true}
            fiatStats={conversionFiatStats}
            redesign={true}
          />

          <CustomButton
            buttonStyles={[
              styles.keypadButton,
              !canContinue && localSatAmount !== 0 && styles.dim,
            ]}
            actionFunction={() => {
              if (!amountValue) {
                closeOrBack();
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

              pushStep('confirm');
            }}
            textContent={
              !amountValue ? t('constants.back') : t('constants.continue')
            }
            size={'regular'}
          />
        </View>
      </>
    );
  };

  // ─── confirm ──────────────────────────────────────────────────────────────
  const renderConfirm = () => {
    const isMaxOrAll = isWithdrawAll || isSendMax;
    const confirmDescription = (() => {
      if (selectedBalanceType === 'interest') {
        return isMaxOrAll
          ? t('savings.withdraw.confirmSubtitle_interestAll', {
              destination,
              destinationLabel,
            })
          : t('savings.withdraw.confirmSubtitle_interest', {
              destination,
              destinationLabel,
            });
      }
      if (selectedGoal) {
        return isMaxOrAll
          ? t('savings.withdraw.confirmSubtitle_goalAll', {
              goalName: selectedGoal.name,
              destination,
              destinationLabel,
            })
          : t('savings.withdraw.confirmSubtitle_goal', {
              goalName: selectedGoal.name,
              destination,
              destinationLabel,
            });
      }
      return isMaxOrAll
        ? t('savings.withdraw.confirmSubtitle_generalAll', {
            destination,
            destinationLabel,
          })
        : t('savings.withdraw.confirmSubtitle_general', {
            destination,
            destinationLabel,
          });
    })();

    return (
      <>
        {backBar}
        <SheetTitle
          title={t('savings.withdraw.confirmTitle')}
          sub={confirmDescription}
        />
        <View style={styles.confirmAmount}>
          <AmountHero {...withdrawAmountProps} amountSize={52} />
        </View>
        <CustomButton
          buttonStyles={styles.bottomButton}
          actionFunction={handleConfirm}
          textContent={t('savings.withdraw.confirmButton')}
          size={'regular'}
        />
      </>
    );
  };

  return (
    <View style={styles.container}>
      <AnimatedStep
        active={currentPage === 'balanceType'}
        direction={direction}
        exitsBack={direction === -1}
      >
        {renderBalanceType()}
      </AnimatedStep>

      <AnimatedStep
        active={currentPage === 'chooseGoal'}
        direction={direction}
        exitsBack={direction === -1}
      >
        {renderChooseGoal()}
      </AnimatedStep>

      <AnimatedStep
        active={currentPage === 'amount'}
        direction={direction}
        exitsBack={direction === -1}
      >
        {renderAmount()}
      </AnimatedStep>

      <AnimatedStep
        active={currentPage === 'confirm'}
        direction={direction}
        exitsBack={direction === -1}
      >
        {renderConfirm()}
      </AnimatedStep>

      <AnimatedStep
        active={currentPage === 'loading'}
        direction={direction}
        fadeOnly={true}
      >
        <View style={styles.loading}>
          <StepProgress
            title={t(
              `savings.withdraw.steps.${
                isInterest ? 'withdrawing_rewards' : 'withdrawing_savings'
              }`,
            )}
            subtitle={t('savings.withdraw.loadingSubtitle', {
              amount: withdrawAmountText,
              source: sourceLabel,
            })}
          />
        </View>
      </AnimatedStep>

      <AnimatedStep
        active={currentPage === 'success'}
        direction={direction}
        fadeOnly={true}
      >
        <SheetResult
          label={t('savings.withdraw.successTitle')}
          amountProps={withdrawAmountProps}
          line={t('savings.withdraw.successTo', {
            destinationLabel,
          })}
          buttonText={t('constants.done')}
          onDone={handleDone}
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
  backBar: {
    marginTop: 8,
  },
  list: {
    marginTop: 12,
    flexGrow: 0,
  },
  rowTitle: {
    fontSize: 15,
    lineHeight: 21,
  },
  rowValue: {
    fontSize: 14,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  disabledRow: {
    opacity: 0.45,
  },
  amountBlock: {
    marginTop: 24,
    alignItems: 'center',
  },
  hint: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    includeFontPadding: false,
  },
  maxPill: {
    marginTop: 14,
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  maxPillText: {
    fontFamily: FONT.Title_Regular,
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
  },
  keypad: {
    marginTop: 'auto',
  },
  keypadButton: {
    width: '100%',
    marginTop: 12,
  },
  dim: {
    opacity: 0.45,
  },
  confirmAmount: {
    marginTop: 36,
    alignItems: 'center',
  },
  bottomButton: {
    width: '100%',
    marginTop: 'auto',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
  },
});
