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
  CONTENT_KEYBOARD_OFFSET,
  ICONS,
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
import usePaymentInputDisplay from '../../../../hooks/usePaymentInputDisplay';
import {
  BTC_ASSET_ADDRESS,
  dollarsToSats,
  getUserSwapHistory,
  satsToDollars,
  simulateSwap,
  swapBitcoinToToken,
  swapTokenToBitcoin,
  USD_ASSET_ADDRESS,
} from '../../../../functions/spark/flashnet';
import { sparkPaymenWrapper } from '../../../../functions/spark/payments';
import { useKeysContext } from '../../../../../context-store/keys';
import { useActiveCustodyAccount } from '../../../../../context-store/activeAccount';
import { deriveSparkGiftMnemonic } from '../../../../functions/gift/deriveGiftWallet';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import {
  FONT,
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
import {
  getSparkBalance,
  initializeSparkWallet,
} from '../../../../functions/spark';
import {
  addSingleUnpaidSparkTransaction,
  bulkUpdateSparkTransactions,
} from '../../../../functions/spark/transactions';
import { setFlashnetTransfer } from '../../../../functions/spark/handleFlashnetTransferIds';
import SkeletonTextPlaceholder from '../../../../functions/CustomElements/skeletonTextView';
import { createBalancePoller } from '../../../../functions/pollingManager';
import {
  getLocalStorageItem,
  setLocalStorageItem,
} from '../../../../functions/localStorage';

const confirmTxAnimation = require('../../../../assets/confirmTxAnimation.json');

// Persists { pollTimestamp: number, balance: number } so the balance poller
// can be skipped when no new interest payment has arrived since the last poll.
const SAVINGS_INTEREST_POLL_CACHE_KEY = 'savings_interest_poll_cache';

const MIN_STEP_MS = 800;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const HEIGHT_FOR_PAGE = {
  balanceType: 500,
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
    withdrawlFromRewards,
    refreshSavings,
    refreshBalances,
    savingsGoals,
    getGoalBalanceMicros,
    walletBalanceMicros,
    totalGoalsBalance,
    savingsBalance,
    savingsWallet,
    totalIntrestEarned,
    interestPayouts,
  } = useSavings();
  const { sparkInformation } = useSparkWallet();

  const [step, setStep] = useState([
    selectedGoalUUID ? 'destination' : 'balanceType',
  ]);
  const [walletBTCBalance, setWalletBTCBalance] = useState(null);
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [amountValue, setAmountValue] = useState('');
  // When true the user chose "Withdraw All" — skips amount step and drains
  // every goal + unallocated balance in a single payment.
  const [isWithdrawAll, setIsWithdrawAll] = useState(false);
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

  const [inputDenomination, setInputDenomination] = useState(
    selectedBalanceType !== 'interest'
      ? 'fiat'
      : masterInfoObject.userBalanceDenomination != 'fiat'
      ? 'sats'
      : 'fiat',
  );

  const fiatStats = globalFiatStats;
  const [selectedGoalId, setSelectedGoalId] = useState(selectedGoalUUID);

  const currentPage = step[step.length - 1];

  // Dollar destination → user types USD; Bitcoin destination → user types sats/fiat
  const paymentMode = selectedBalanceType !== 'interest' ? 'USD' : 'BTC';

  // Interest balance (BTC sats held in savings wallet from payouts)
  const interestSats = walletBTCBalance ?? totalIntrestEarned ?? 0;

  // Savings balance in USD (fromMicros of walletBalanceMicros)
  const savingsBalanceUsd = Number(savingsBalance || 0);

  const isInterestDisabled = interestSats <= 0;
  const isSavingsDisabled = savingsBalanceUsd <= 0;
  // Interest exists but below flashnet swap minimum → can only send to bitcoin
  const interestBelowSwapMin =
    interestSats > 0 && interestSats <= swapLimits.bitcoin;

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

  // NEW: for interest below swap minimum, restrict to bitcoin-only destination
  const visibleDestinationOptions = useMemo(() => {
    return destinationOptions;
    if (selectedBalanceType !== 'interest') return destinationOptions;
    if (interestSats > 0 && interestSats < swapLimits.bitcoin) {
      return destinationOptions.filter(opt => opt.key === 'bitcoin');
    }

    return destinationOptions;
  }, [
    selectedBalanceType,
    interestSats,
    swapLimits.bitcoin,
    destinationOptions,
  ]);

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
    // NEW: Interest→bitcoin is a direct BTC send from savings wallet; no USDB→BTC swap needed
    if (selectedBalanceType === 'interest') {
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
    selectedBalanceType,
    simulationAmountMicros,
    poolInfoRef.lpPublicKey,
    getSavingsWalletMnemonic,
  ]);

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

        // Savings balance only changes on interest payment receipt — skip poll
        // if no new interest payment has arrived since the last successful poll.
        // let shouldPoll = true;
        // try {
        //   const rawCache = await getLocalStorageItem(
        //     SAVINGS_INTEREST_POLL_CACHE_KEY,
        //   );
        //   if (rawCache) {
        //     const { pollTimestamp = 0, balance = null } = JSON.parse(rawCache);
        //     const mostRecentPayoutPaidAt = interestPayouts[0]?.paidAt ?? 0;
        //     const hasNewInterestPayment =
        //       mostRecentPayoutPaidAt > pollTimestamp;

        //     if (
        //       !hasNewInterestPayment &&
        //       balance !== null &&
        //       sparkBalance.didWork &&
        //       Number(sparkBalance.balance) === balance
        //     ) {
        //       shouldPoll = false;
        //       setWalletBTCBalance(balance);
        //       setBalanceReady(true);
        //     }
        //   }
        // } catch {
        //   // Parse failure — fall through to poll conservatively
        // }

        // if (!shouldPoll) return;

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
          1,
        );

        await poller.start();
      } catch {
        if (!abortController.signal.aborted) setSparkInitStatus('error');
      }
    };

    initWallet();
    return () => {
      abortController.abort();
    };
  }, [getSavingsWalletMnemonic]);

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
    // balanceType is now the first step; success still closes
    if (
      currentPage === 'balanceType' ||
      (currentPage === 'destination' && step.length === 1) ||
      currentPage === 'success'
    )
      return false; // let parent close
    // reset balance type selection when going back past destination
    if (currentPage === 'destination') {
      setSelectedBalanceType(null);
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

        const amountSats = localSatAmount;

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
        if (selectedDestination === 'dollar') {
          // Hide the intermediate BTC transfer from the activity feed
          // Run before sleep to prevent race conditions
          setFlashnetTransfer(sendResponse.response.id);
        }

        await withdrawlFromRewards(amountSats);

        const elapsed2 = Date.now() - step2Start;
        if (elapsed2 < MIN_STEP_MS) await sleep(MIN_STEP_MS - elapsed2);

        if (selectedDestination === 'dollar') {
          setLoadingStep('swapping');

          const swapResult = await swapBitcoinToToken(currentWalletMnemoinc, {
            tokenAddress: USD_ASSET_ADDRESS,
            amountSats,
            poolId: poolInfoRef.lpPublicKey,
          });

          if (swapResult?.didWork && swapResult?.swap) {
            const userSwaps = await getUserSwapHistory(
              currentWalletMnemoinc,
              5,
            );
            const swap = userSwaps.swaps?.find(
              s => s.outboundTransferId === swapResult.swap.outboundTransferId,
            );
            if (swap) {
              setFlashnetTransfer(swap.inboundTransferId);

              const realFeeAmount = Math.round(
                dollarsToSats(
                  parseFloat(swapResult.swap.feeAmount) / Math.pow(10, 6),
                  swapResult.swap.executionPrice,
                ),
              );

              bulkUpdateSparkTransactions(
                [
                  {
                    id: swap.outboundTransferId,
                    paymentStatus: 'completed',
                    paymentType: 'spark',
                    accountId: sparkInformation.identityPubKey,
                    details: {
                      fee: realFeeAmount,
                      totalFee: realFeeAmount,
                      supportFee: 0,
                      amount: parseFloat(swap.amountOut),
                      description: t('savings.withdraw.interestPaymentLabel'),
                      address: sparkInformation.sparkAddress,
                      time: Date.now(),
                      createdAt: Date.now(),
                      direction: 'INCOMING',
                      showSwapLabel: true,
                      currentPriceAInB: swapResult.swap.executionPrice,
                      isSavings: true,
                      isLRC20Payment: true,
                      LRC20Token: USDB_TOKEN_ID,
                    },
                  },
                ],
                'fullUpdate',
              );
            }
          }
        }

        setStep(prev => [...prev, 'success']);
        return;
      }

      // For Withdraw All we send the full wallet balance; otherwise the user-
      // entered amount. confirmMicros drives both the payment and the DB record.
      const confirmMicros = isWithdrawAll
        ? totalWithdrawMicros
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

      // Step 3: Swapping to Bitcoin — optional USDB→BTC swap + DB record

      if (selectedDestination === 'bitcoin') {
        setLoadingStep('swapping');

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
            details: { isSavings: true },
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
            paymentStatus: 'pending',
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
              time: Date.now(),
              createdAt: Date.now(),
              direction: 'INCOMING',
              showSwapLabel: true,
              currentPriceAInB: result.swap.executionPrice,
              isSavings: true,
            },
          };
          bulkUpdateSparkTransactions([incomingTransfer], 'fullUpdate');
        }
      } else {
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
    // While wallet is initialising, show a full-screen spinner
    if (sparkInitStatus === 'idle' || sparkInitStatus === 'loading') {
      return <FullLoadingScreen text={t('savings.withdraw.loadingBalances')} />;
    }

    return (
      <View style={styles.container}>
        <ThemeText
          styles={styles.title}
          content={t('savings.withdraw.balanceTypeTitle')}
        />

        {sparkInitStatus === 'error' ? (
          <ThemeText
            styles={styles.balanceLoadErrorText}
            content={t('savings.withdraw.balanceLoadError')}
          />
        ) : (
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
                      theme && darkModeType
                        ? backgroundColor
                        : backgroundOffset,
                    opacity:
                      isInterestDisabled && balanceReady ? HIDDEN_OPACITY : 1,
                  },
                ]}
                onPress={() => {
                  if (isInterestDisabled) return;
                  setSelectedBalanceType('interest');
                  setInputDenomination('sats');
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

                    {isInterestDisabled && balanceReady ? (
                      <ThemeText
                        content={t('savings.withdraw.interestZeroHint')}
                      />
                    ) : (
                      <>
                        {/* Hidden component for layout measurement */}
                        <View
                          style={{
                            position: 'absolute',
                            opacity: 0,
                            pointerEvents: 'none',
                          }}
                          onLayout={handleSkeletonLayout}
                        >
                          <FormattedSatText
                            styles={styles.optionSubtitle}
                            balance={displayCorrectDenomination({
                              amount: interestSats,
                              masterInfoObject: {
                                ...masterInfoObject,
                                userBalanceDenomination: 'sats',
                              },
                              fiatStats,
                            })}
                            useSizing={true}
                          />
                        </View>

                        {/* Show skeleton shimmer until poller settles */}
                        <View
                          style={{
                            height: skeletonLayout.height,
                            justifyContent: 'center',
                            alignItems: 'center',
                            flexShrink: 1,
                          }}
                        >
                          <SkeletonTextPlaceholder
                            enabled={!balanceReady}
                            layout={skeletonLayout}
                          >
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
                          </SkeletonTextPlaceholder>
                        </View>
                      </>
                    )}
                  </View>
                </View>
                {!isInterestDisabled && (
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
                setInputDenomination('fiat');
                if (selectedGoalUUID && !savingsGoals.length) {
                  setStep(prev => [...prev, 'destination']);
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
        )}
      </View>
    );
  }

  if (currentPage === 'chooseGoal') {
    const shouldShowWithdrawlAll =
      fromMicros(totalWithdrawMicros) != savingsBalance - totalGoalsBalance;

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

  if (currentPage === 'destination') {
    return (
      <View style={styles.container}>
        <ThemeText
          styles={styles.title}
          content={t('savings.withdraw.destinationTitle')}
        />

        <View style={styles.optionsList}>
          {visibleDestinationOptions.map(option => {
            const disabledForIntrest =
              selectedBalanceType === 'interest' &&
              option.key === 'dollar' &&
              interestSats > 0 &&
              interestSats < swapLimits.bitcoin;

            const disableForBalance =
              selectedBalanceType === 'savings' &&
              ((option.key === 'dollar' && balanceUsd < 0.01) ||
                (option.key === 'bitcoin' && balanceUsd < swapLimits.usd));

            return (
              <TouchableOpacity
                key={option.key}
                activeOpacity={0.7}
                style={[
                  styles.optionRow,
                  {
                    backgroundColor:
                      theme && darkModeType
                        ? backgroundColor
                        : backgroundOffset,
                    opacity: disabledForIntrest || disableForBalance ? 0.5 : 1,
                  },
                ]}
                disabled={disableForBalance}
                onPress={() => {
                  if (disabledForIntrest && option.key === 'dollar') {
                    navigate.navigate('ErrorScreen', {
                      errorMessage: t('savings.withdraw.interestBelowMinHint'),
                    });
                    return;
                  }
                  setSelectedDestination(option.key);
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
                  <View style={{ flexShrink: 1 }}>
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
            );
          })}
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
    // MODIFIED: canContinue branches on selectedBalanceType
    const canContinue = (() => {
      if (!amountValue || parsedAmount <= 0) return false;

      if (selectedBalanceType === 'interest') {
        // Interest is BTC sats — validate directly in sats
        if (localSatAmount > interestSats) return false;
        if (selectedDestination === 'dollar') {
          // BTC→USDB swap requires meeting the swap minimum
          if (localSatAmount < swapLimits.bitcoin) return false;
        }
        // interest→bitcoin: direct BTC send, no swap minimum
        return true;
      }

      // Savings path — unchanged
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

    // MODIFIED: available hint — show sats for interest, USD for savings
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

    // MODIFIED: show min hint for savings→bitcoin OR interest→dollar (both need a swap)
    const showMinHint =
      (selectedBalanceType !== 'interest' &&
        selectedDestination === 'bitcoin') ||
      (selectedBalanceType === 'interest' && selectedDestination === 'dollar');

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
              amount: availableHintAmount,
            })}
          />

          {showMinHint && (
            <ThemeText
              styles={styles.minHintText}
              content={t('savings.withdraw.minHint', {
                amount: displayCorrectDenomination({
                  // MODIFIED: for interest→dollar use bitcoin swap min (sats);
                  // for savings→bitcoin use USD-converted swap min
                  amount:
                    selectedBalanceType === 'interest'
                      ? swapLimits.bitcoin
                      : swapLimits.usd,
                  masterInfoObject: {
                    ...masterInfoObject,
                    userBalanceDenomination:
                      selectedBalanceType === 'interest' ? 'sats' : 'fiat',
                  },
                  fiatStats,
                  convertAmount: selectedBalanceType === 'interest',
                  forceCurrency: 'USD',
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

              // if amount is less than the swap amount
              if (
                selectedDestination === 'dollar' &&
                localSatAmount < swapLimits.bitcoin
              ) {
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
            } else {
              // balance is in dollars
              if (
                selectedDestination === 'bitcoin' &&
                localSatAmount <=
                  dollarsToSats(swapLimits.usd, poolInfoRef.currentPriceAInB)
              ) {
                navigate.navigate('ErrorScreen', {
                  errorMessage: t('screens.inAccount.swapsPage.minUSDError', {
                    min: displayCorrectDenomination({
                      amount: swapLimits.usd,
                      masterInfoObject: {
                        ...masterInfoObject,
                        userBalanceDenomination: 'fiat',
                      },
                      fiatStats,
                      convertAmount: false,
                      forceCurrency: 'USD',
                    }),
                  }),
                });
                return;
              }

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
    // Withdraw All uses the full wallet balance; normal path uses user-entered amount.
    const confirmMicros = isWithdrawAll ? totalWithdrawMicros : fiatMicros;

    // MODIFIED: for interest, display the sats amount directly (no USD micros)
    const withdrawAmountDisplay =
      selectedBalanceType === 'interest'
        ? displayCorrectDenomination({
            amount: localSatAmount,
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

    // MODIFIED: suppress simulation output for interest→bitcoin (no swap occurs)
    const estimatedBtcOut =
      selectedBalanceType !== 'interest' &&
      selectedDestination === 'bitcoin' &&
      simulationResult
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
          {/* NEW: balance type label so user knows which asset they're withdrawing */}
          <ThemeText
            styles={styles.summaryLabel}
            content={
              selectedBalanceType === 'interest'
                ? t('savings.withdraw.fromInterest')
                : t('savings.withdraw.fromSavings')
            }
          />
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
    fontSize: SIZES.large,
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
  // NEW: error message displayed on the balanceType page when Spark init fails
  balanceLoadErrorText: {
    textAlign: 'center',
    opacity: 0.7,
    fontSize: SIZES.smedium,
    includeFontPadding: false,
    paddingHorizontal: 16,
  },
});
