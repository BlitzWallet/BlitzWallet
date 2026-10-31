import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import { useNavigation } from '@react-navigation/native';
import {
  useSavings,
  UNALLOCATED_GOAL_ID,
} from '../../../../../context-store/savingsContext';
import { useUserBalanceContext } from '../../../../../context-store/userBalanceContext';
import { ThemeText } from '../../../../functions/CustomElements';
import GetThemeColors from '../../../../hooks/themeColors';
import { APPROXIMATE_SYMBOL, CENTER } from '../../../../constants';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import { fromMicros } from './utils';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import CustomNumberKeyboard from '../../../../functions/CustomElements/customNumberKeyboard';
import CustomButton from '../../../../functions/CustomElements/button';
import usePaymentInputDisplay from '../../../../hooks/usePaymentInputDisplay';
import { INSET_WINDOW_WIDTH } from '../../../../constants/theme';
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
import truncateToTwoDecimals from '../../../../functions/truncateNumber';
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

const MIN_STEP_MS = 800;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const GENERAL_GOAL_EMOJI = '🏦';
const MAX_SHEET_HEIGHT = 700;
const STEP_HEIGHTS = {
  source: 400,
  amount: 700,
  confirm: 480,
  loading: 480,
  success: 520,
};

export default function AddMoneyToSavingsHalfModal({
  setContentHeight,
  handleBackPressFunction,
  selectedGoalUUID,
  hasGoals,
  setDismissLocked,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats: globalFiatStats } = useNodeContext();
  const { tokens } = GetThemeColors();
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
    selectedGoalUUID || !(hasGoals ?? savingsGoals.length > 0)
      ? 'source'
      : 'chooseGoal',
  ]);
  const [direction, setDirection] = useState(1);
  const [loadingStep, setLoadingStep] = useState('processing');
  const [selectedSource, setSelectedSource] = useState(null);
  const [amountValue, setAmountValue] = useState('');
  const [addedDollars, setAddedDollars] = useState(0);

  const [inputDenomination, setInputDenomination] = useState(
    selectedSource === 'dollar'
      ? 'fiat'
      : masterInfoObject.userBalanceDenomination != 'fiat'
      ? 'sats'
      : 'fiat',
  );
  const fiatStats = globalFiatStats;
  const [selectedGoalId, setSelectedGoalId] = useState(
    selectedGoalUUID || UNALLOCATED_GOAL_ID,
  );

  const currentPage = step[step.length - 1];

  const paymentMode = selectedSource === 'dollar' ? 'USD' : 'BTC';

  const availableBalance =
    paymentMode === 'USD' ? dollarBalanceToken.toFixed(3) : bitcoinBalance;

  const { primaryDisplay, conversionFiatStats, convertDisplayToSats } =
    usePaymentInputDisplay({
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
  const confirmingRef = useRef(false);
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

  const canContinue = Number(amountValue || 0) > 0;

  const chooseGoalHeight = Math.min(
    MAX_SHEET_HEIGHT,
    Math.max(420, 160 + (savingsGoals.length + 1) * 65),
  );
  const heightFor = page =>
    page === 'chooseGoal' ? chooseGoalHeight : STEP_HEIGHTS[page];

  useStepSheetHeight(setContentHeight, heightFor(currentPage));

  // The sheet can't be swiped or tapped away while the payment is in flight.
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
    moveStep(-1, step[step.length - 2], prev => prev.slice(0, -1));
  }, [step, moveStep]);

  const handleBackPress = useCallback(() => {
    if (currentPage === 'loading') return true; // block
    if (step.length === 1 || currentPage === 'success') return false; // let parent close
    goBack();
    return true;
  }, [currentPage, step, goBack]);

  useHandleBackPressNew(handleBackPress);

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

  const isGeneralGoal =
    !selectedGoalId || selectedGoalId === UNALLOCATED_GOAL_ID;
  const selectedGoal = savingsGoals.find(g => g.id === selectedGoalId);
  const destinationName =
    isGeneralGoal || !selectedGoal
      ? t('savings.addMoney.generalSavings')
      : selectedGoal.name;
  const destinationLabel = `${
    isGeneralGoal || !selectedGoal ? GENERAL_GOAL_EMOJI : selectedGoal.emoji
  } ${destinationName}`;

  const handleConfirm = async () => {
    // The confirm step stays tappable while it animates out.
    if (confirmingRef.current) return;
    confirmingRef.current = true;
    pushStep('loading');
    setLoadingStep('processing');

    try {
      // Step 1: Processing — validation and simulation wait
      const step1Start = Date.now();

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
          amountIn: localSatAmount,
          dollarBalanceSat,
          bitcoinBalance,
          satFee: btcFee,
        };
      }

      const elapsed1 = Date.now() - step1Start;
      if (elapsed1 < MIN_STEP_MS) await sleep(MIN_STEP_MS - elapsed1);

      // Step 2: Swapping funds to dollar — spark payment (includes BTC→USDB swap for BTC source)
      setLoadingStep(selectedSource === 'dollar' ? 'adding' : 'swapping');
      const step2Start = Date.now();

      const paymentResponse = await sparkPaymenWrapper({
        address: savingsAddress,
        paymentType: 'spark',
        amountSats: localSatAmount,
        masterInfoObject,
        extraDetails: { isSavings: true },
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

      const elapsed2 = Date.now() - step2Start;
      if (elapsed2 < MIN_STEP_MS) await sleep(MIN_STEP_MS - elapsed2);

      setLoadingStep('adding');
      const dollarValue =
        (paymentResponse.amountOutMicrodollars ?? fiatMicros) / 1_000_000;
      await addMoney({ amount: dollarValue, goalId: selectedGoalId });

      setAddedDollars(dollarValue);
      pushStep('success');
    } catch (err) {
      setLoadingStep('processing');
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
    refreshSavings();
    if (refreshBalances) refreshBalances();
    handleBackPressFunction();
  };

  const backBar = (
    <View style={styles.backBar}>
      <TopBar onBack={goBack} />
    </View>
  );

  // ─── chooseGoal ───────────────────────────────────────────────────────────
  const renderChooseGoal = () => (
    <>
      <SheetTitle title={t('savings.addMoney.chooseGoalTitle')} first={true} />
      <CustomScrollView
        style={styles.list}
        showsVerticalScrollIndicator={false}
      >
        <ListCard tone="flush">
          {/* General savings — always shown so users can deposit without a goal */}
          <ListRow
            key={UNALLOCATED_GOAL_ID}
            lead={<EmojiDisc emoji={GENERAL_GOAL_EMOJI} />}
            title={t('savings.addMoney.generalSavings')}
            titleStyle={styles.rowTitle}
            sub={t('savings.addMoney.noSpecificGoal')}
            subLines={1}
            minHeight={64}
            showChevron={true}
            onPress={() => {
              setSelectedGoalId(UNALLOCATED_GOAL_ID);
              pushStep('source');
            }}
          />
          {savingsGoals.map(goal => (
            <ListRow
              key={goal.id}
              lead={<EmojiDisc emoji={goal.emoji} />}
              title={goal.name}
              titleStyle={styles.rowTitle}
              sub={`${formatUsd(fromMicros(goal.currentAmountMicros))} ${t(
                'wallet.pools.ofAmount',
                { amount: formatUsd(fromMicros(goal.amountMicros)) },
              )}`}
              subLines={1}
              minHeight={64}
              showChevron={true}
              onPress={() => {
                setSelectedGoalId(goal.id);
                pushStep('source');
              }}
            />
          ))}
        </ListCard>
      </CustomScrollView>
    </>
  );

  // ─── source ───────────────────────────────────────────────────────────────
  const renderSource = () => {
    const isBitcoinDisabled = bitcoinBalance < swapLimits.bitcoin;
    const isDollarDisabled = dollarBalanceToken < 0.01;

    if (isBitcoinDisabled && isDollarDisabled) {
      return (
        <SheetEmpty
          icon="Wallet"
          title={t('savings.addMoney.noSourceTitle')}
          sub={t('savings.addMoney.noSourceSubtitle', {
            amount: formatSats(swapLimits.bitcoin),
          })}
          buttonText={t('constants.back')}
          onPress={step.length > 1 ? goBack : () => handleBackPressFunction()}
        />
      );
    }

    const sourceOptions = [
      {
        key: 'bitcoin',
        title: t('savings.bitcoinBalance'),
        subtitle: formatSats(bitcoinBalance),
        isDisabled: isBitcoinDisabled,
      },
      {
        key: 'dollar',
        title: t('savings.dollarBalance'),
        subtitle: formatUsd(truncateToTwoDecimals(dollarBalanceToken)),
        isDisabled: isDollarDisabled,
      },
    ];

    return (
      <>
        {step.length > 1 && backBar}
        <SheetTitle
          title={t('savings.addMoney.sourceTitle')}
          sub={t('savings.addMoney.addingTo', {
            destination: destinationLabel,
          })}
          first={step.length === 1}
        />
        <View style={styles.list}>
          <ListCard tone="flush">
            {sourceOptions.map(option => (
              <View
                key={option.key}
                style={option.isDisabled && styles.disabledRow}
              >
                <ListRow
                  lead={<AssetDisc asset={option.key} />}
                  title={option.title}
                  titleStyle={styles.rowTitle}
                  sub={option.subtitle}
                  subLines={1}
                  minHeight={64}
                  showChevron={true}
                  onPress={() => {
                    if (option.key === 'dollar' && isDollarDisabled) {
                      navigate.navigate('InformationPopup', {
                        textContent: t('savings.addMoney.noUSDInfoMessage', {
                          amount: formatUsd(0.01),
                        }),
                        buttonText: t('constants.iunderstand'),
                      });
                      return;
                    }
                    if (option.key === 'bitcoin' && isBitcoinDisabled) {
                      navigate.navigate('InformationPopup', {
                        textContent: t('savings.addMoney.noBTCInfoMessage', {
                          amount: formatSats(swapLimits.bitcoin),
                        }),
                        buttonText: t('constants.iunderstand'),
                      });
                      return;
                    }
                    setSelectedSource(option.key);
                    setAmountValue('');
                    setInputDenomination(
                      option.key === 'dollar'
                        ? 'fiat'
                        : masterInfoObject.userBalanceDenomination != 'fiat'
                        ? 'sats'
                        : 'fiat',
                    );
                    pushStep('amount');
                  }}
                />
              </View>
            ))}
          </ListCard>
        </View>
      </>
    );
  };

  // ─── amount ───────────────────────────────────────────────────────────────
  const renderAmount = () => {
    const deactivateButton =
      ((paymentMode === 'BTC' && localSatAmount > bitcoinBalance) ||
        (paymentMode === 'USD' &&
          fiatMicros >= dollarBalanceToken * Math.pow(10, 6)) ||
        (paymentMode === 'BTC' && localSatAmount < swapLimits.bitcoin)) &&
      localSatAmount !== 0;

    const availableText = t('savings.withdraw.availableHint', {
      amount: displayCorrectDenomination({
        amount: availableBalance,
        masterInfoObject: {
          ...masterInfoObject,
          userBalanceDenomination: paymentMode === 'USD' ? 'fiat' : 'sats',
        },
        fiatStats,
        forceCurrency: 'USD',
        convertAmount: paymentMode === 'USD' ? false : true,
      }),
    });
    const hintText =
      selectedSource === 'bitcoin'
        ? `${availableText} · ${t('savings.addMoney.minHint', {
            amount: formatSats(swapLimits.bitcoin),
          })}`
        : availableText;

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
            content={hintText}
          />
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
            buttonStyles={[styles.keypadButton, deactivateButton && styles.dim]}
            actionFunction={() => {
              if (!canContinue) {
                goBack();
                return;
              }

              if (
                (paymentMode === 'BTC' && localSatAmount > bitcoinBalance) ||
                (paymentMode === 'USD' &&
                  fiatMicros > dollarBalanceToken * Math.pow(10, 6))
              ) {
                navigate.navigate('ErrorScreen', {
                  errorMessage: t(
                    'screens.inAccount.swapsPage.insufficientBalance',
                  ),
                });
                return;
              }

              if (
                paymentMode === 'BTC' &&
                localSatAmount < swapLimits.bitcoin
              ) {
                navigate.navigate('ErrorScreen', {
                  errorMessage: t('screens.inAccount.swapsPage.minBTCError', {
                    min: formatSats(swapLimits.bitcoin),
                  }),
                });
                return;
              }
              pushStep('confirm');
            }}
            textContent={
              !canContinue ? t('constants.back') : t('constants.continue')
            }
            size={'regular'}
          />
        </View>
      </>
    );
  };

  // ─── confirm ──────────────────────────────────────────────────────────────
  const renderConfirm = () => {
    // Other locales still read `fromBalance` as the bare asset word.
    const fromBalance =
      selectedSource === 'bitcoin'
        ? t('constants.bitcoin_upper')
        : t('constants.dollars_upper');
    const fromBalanceLabel =
      selectedSource === 'bitcoin'
        ? t('savings.bitcoinBalance')
        : t('savings.dollarBalance');

    return (
      <>
        {backBar}
        <SheetTitle
          title={t('savings.addMoney.confirmTitle')}
          sub={t('savings.addMoney.pageDescription', {
            context: isGeneralGoal ? 'general' : undefined,
            fromBalance,
            fromBalanceLabel,
            destination: destinationName,
          })}
        />
        <View style={styles.confirmAmount}>
          <AmountHero
            amount={(fiatMicros / Math.pow(10, 6)).toFixed(2)}
            fiatStats={fiatStats}
            masterInfoObject={{
              ...masterInfoObject,
              userBalanceDenomination: 'fiat',
            }}
            forceCurrency="USD"
            convertAmount={false}
            amountSize={52}
          />
          {selectedSource !== 'dollar' && (
            <ThemeText
              variant={'body'}
              styles={[styles.estimate, { color: tokens.muted }]}
              content={`${APPROXIMATE_SYMBOL} ${formatSats(localSatAmount)}`}
            />
          )}
        </View>
        <CustomButton
          buttonStyles={styles.bottomButton}
          actionFunction={handleConfirm}
          textContent={t('savings.addMoney.confirmButton')}
          size={'regular'}
        />
      </>
    );
  };

  // ─── loading ──────────────────────────────────────────────────────────────
  const swapDone = loadingStep === 'adding';
  const progressSteps =
    selectedSource === 'bitcoin'
      ? [
          {
            key: 'swapping',
            label: t('savings.addMoney.steps.swapping'),
            state: swapDone ? 'done' : 'active',
          },
          {
            key: 'adding',
            label: t('savings.addMoney.steps.adding'),
            state: swapDone ? 'active' : 'pending',
          },
        ]
      : [
          {
            key: 'adding',
            label: t('savings.addMoney.steps.adding'),
            state: 'active',
          },
        ];

  return (
    <View style={styles.container}>
      <AnimatedStep
        active={currentPage === 'chooseGoal'}
        direction={direction}
        exitsBack={direction === -1}
      >
        {renderChooseGoal()}
      </AnimatedStep>

      <AnimatedStep
        active={currentPage === 'source'}
        direction={direction}
        exitsBack={direction === -1}
      >
        {renderSource()}
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
            title={t('savings.addMoney.loadingTitle')}
            subtitle={t('savings.addMoney.loadingSubtitle', {
              amount: formatUsd((fiatMicros / Math.pow(10, 6)).toFixed(2)),
              destination: destinationLabel,
            })}
            steps={progressSteps}
          />
        </View>
      </AnimatedStep>

      <AnimatedStep
        active={currentPage === 'success'}
        direction={direction}
        fadeOnly={true}
      >
        <SheetResult
          label={t('savings.addMoney.successTitle')}
          amountProps={{
            amount: Number(addedDollars).toFixed(2),
            fiatStats,
            masterInfoObject: {
              ...masterInfoObject,
              userBalanceDenomination: 'fiat',
            },
            forceCurrency: 'USD',
            convertAmount: false,
          }}
          line={t('savings.addMoney.successTo', {
            destination: destinationLabel,
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
  disabledRow: {
    opacity: 0.45,
  },
  amountBlock: {
    marginTop: 28,
    alignItems: 'center',
  },
  hint: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
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
  estimate: {
    marginTop: 4,
    textAlign: 'center',
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
