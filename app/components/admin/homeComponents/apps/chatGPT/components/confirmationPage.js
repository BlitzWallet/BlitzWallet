import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ThemeText } from '../../../../../../functions/CustomElements';
import { CENTER } from '../../../../../../constants';
import { INSET_WINDOW_WIDTH } from '../../../../../../constants/theme';
import CustomNumberKeyboard from '../../../../../../functions/CustomElements/customNumberKeyboard';
import GetThemeColors from '../../../../../../hooks/themeColors';
import SwipeButtonNew from '../../../../../../functions/CustomElements/sliderButton';
import CustomButton from '../../../../../../functions/CustomElements/button';
import { useCallback, useEffect, useState } from 'react';
import { getLNAddressForLiquidPayment } from '../../../sendBitcoin/functions/payments';
import { sparkPaymenWrapper } from '../../../../../../functions/spark/payments';
import { useGlobalContextProvider } from '../../../../../../../context-store/context';
import { useSparkWallet } from '../../../../../../../context-store/sparkContext';
import { useActiveCustodyAccount } from '../../../../../../../context-store/activeAccount';
import { useGlobalAppData } from '../../../../../../../context-store/appData';
import { useTranslation } from 'react-i18next';
import getLNURLDetails from '../../../../../../functions/lnurl/getLNURLDetails';
import { InputTypes } from 'bitcoin-address-parser';
import { useWebView } from '../../../../../../../context-store/webViewContext';
import useHandleBackPressNew from '../../../../../../hooks/useHandleBackPressNew';
import displayCorrectDenomination from '../../../../../../functions/displayCorrectDenomination';
import { useNodeContext } from '../../../../../../../context-store/nodeContext';
import ThemeIcon from '../../../../../../functions/CustomElements/themeIcon';
import TopBar from '../../../../../../functions/CustomElements/redesign/TopBar';
import AmountHero from '../../../../../../functions/CustomElements/redesign/AmountHero';
import Note from '../../../../../../functions/CustomElements/redesign/Note';
import StepProgress from '../../../../../../functions/CustomElements/redesign/StepProgress';
import EmptyState from '../../../../../../functions/CustomElements/redesign/EmptyState';
import AnimatedStep, {
  growThenStep,
  useStepSheetHeight,
} from '../../../../../../functions/CustomElements/redesign/AnimatedStep';

const PRESET_AMOUNTS = [2000, 5000, 10000, 25000, 50000];
const MIN_AMOUNT = 2000;
const MAX_AMOUNT = 100000;

const STEP_HEIGHTS = {
  select: 470,
  custom: 700,
  confirm: 470,
  loading: 470,
  error: 470,
};

function SlideThumbIcon() {
  const { tokens } = GetThemeColors();
  return (
    <ThemeIcon
      redesign
      iconName="ChevronsRight"
      size={22}
      colorOverride={tokens.onAccent}
    />
  );
}

export default function ConfirmChatGPTPage({
  setContentHeight,
  handleBackPressFunction,
  setDismissLocked,
}) {
  const { sendWebViewRequest } = useWebView();
  const navigate = useNavigation();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { sparkInformation } = useSparkWallet();
  const {
    decodedChatGPT,
    toggleGlobalAppDataInformation,
    globalAppDataInformation,
  } = useGlobalAppData();
  const { tokens } = GetThemeColors();
  const { t } = useTranslation();

  // Page history; back pops to where the user came from.
  const [step, setStep] = useState(['select']);
  const [direction, setDirection] = useState(1);
  const [selectedAmountSats, setSelectedAmountSats] = useState(0);
  const [amountValue, setAmountValue] = useState('');
  const [invoiceInformation, setInvoiceInformation] = useState(null);
  const [error, setError] = useState('');

  const currentPage = step[step.length - 1];
  const satsMasterInfoObject = {
    ...masterInfoObject,
    userBalanceDenomination: 'sats',
    satDisplay: 'text',
  };
  const formatSats = amount =>
    displayCorrectDenomination({
      amount,
      masterInfoObject: satsMasterInfoObject,
      fiatStats,
    });

  useStepSheetHeight(setContentHeight, STEP_HEIGHTS[currentPage]);

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
        STEP_HEIGHTS[currentPage],
        STEP_HEIGHTS[nextPage],
        () => setTimeout(() => setStep(update), 0),
      );
    },
    [currentPage, setContentHeight],
  );

  const pushStep = useCallback(
    page => moveStep(1, page, prev => [...prev, page]),
    [moveStep],
  );

  const goBack = useCallback(() => {
    const previous = step[step.length - 2];
    if (previous === 'select' && currentPage === 'custom') {
      setSelectedAmountSats(0);
    }
    moveStep(-1, previous, prev => prev.slice(0, -1));
  }, [step, currentPage, moveStep]);

  const handleBackPress = useCallback(() => {
    if (currentPage === 'loading') return true;
    if (step.length === 1) return false;
    goBack();
    return true;
  }, [currentPage, step, goBack]);

  useHandleBackPressNew(handleBackPress);

  useEffect(() => {
    if (currentPage !== 'confirm') return;
    let mounted = true;
    setInvoiceInformation(null);

    async function generateInvoiceAndFee() {
      try {
        let creditPrice = selectedAmountSats;
        creditPrice += 150;
        creditPrice += Math.ceil(creditPrice * 0.005);
        const lnPayoutLNURL = process.env.GPT_PAYOUT_LNURL;
        const didGetData = await getLNURLDetails(lnPayoutLNURL).catch(
          () => null,
        );
        if (!didGetData)
          throw new Error(t('errormessages.invoiceRetrivalError'));
        const input = { type: InputTypes.LNURL_PAY, data: didGetData };
        const lnInvoice = await getLNAddressForLiquidPayment(
          input,
          creditPrice,
          'Store - chatGPT',
        );
        const fee = await sparkPaymenWrapper({
          getFee: true,
          address: lnInvoice.pr,
          paymentType: 'lightning',
          amountSats: creditPrice,
          masterInfoObject,
          sparkInformation,
          userBalance: sparkInformation.balance,
          mnemonic: currentWalletMnemoinc,
          sendWebViewRequest,
        });
        if (!fee.didWork) throw new Error(t('errormessages.paymentFeeError'));
        if (!mounted) return;
        if (sparkInformation.balance < creditPrice + fee.supportFee + fee.fee) {
          handleBackPressFunction(() => {
            navigate.replace('ErrorScreen', {
              errorMessage: t('errormessages.insufficientBalanceError', {
                planType: t('apps.appList.AI'),
              }),
            });
          });
          return;
        }
        setInvoiceInformation({
          fee: fee.fee,
          supportFee: fee.supportFee,
          invoice: lnInvoice.pr,
          creditPrice,
        });
      } catch (err) {
        console.log('Error generating invoice for chatGPT:', err);
        if (!mounted) return;
        setError(err.message || t('errormessages.invoiceRetrivalError'));
        pushStep('error');
      }
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        generateInvoiceAndFee();
      });
    });

    return () => {
      mounted = false;
    };
    // Balance updates must not swap the invoice out from under the slider;
    // the purchase re-checks the balance itself.
  }, [currentPage, selectedAmountSats]);

  const payForCredits = useCallback(async () => {
    try {
      pushStep('loading');
      const { creditPrice, invoice } = invoiceInformation;
      const fee = invoiceInformation.fee + invoiceInformation.supportFee;
      if (sparkInformation.balance < creditPrice + fee)
        throw new Error('Insufficient balance');
      const paymentResponse = await sparkPaymenWrapper({
        getFee: false,
        address: invoice,
        paymentType: 'lightning',
        amountSats: creditPrice,
        fee,
        memo: t('apps.chatGPT.addCreditsPage.paymentMemo'),
        masterInfoObject,
        sparkInformation,
        userBalance: sparkInformation.balance,
        mnemonic: currentWalletMnemoinc,
        sendWebViewRequest,
      });
      if (!paymentResponse.didWork) throw new Error(paymentResponse.error);
      toggleGlobalAppDataInformation(
        {
          chatGPT: {
            conversation: globalAppDataInformation.chatGPT.conversation || [],
            credits: decodedChatGPT.credits + selectedAmountSats,
          },
        },
        true,
      );
      // The page behind swaps to the chat once the credits land.
      handleBackPressFunction();
    } catch (err) {
      console.log('Error paying for chatGPT credits:', err);
      handleBackPressFunction(() => {
        navigate.replace('ErrorScreen', {
          errorMessage: t('errormessages.paymentError'),
        });
      });
    }
  }, [
    invoiceInformation,
    selectedAmountSats,
    sparkInformation,
    masterInfoObject,
    currentWalletMnemoinc,
    sendWebViewRequest,
    decodedChatGPT,
    globalAppDataInformation,
    toggleGlobalAppDataInformation,
    handleBackPressFunction,
    pushStep,
    navigate,
    t,
  ]);

  const isCustomSelected =
    !!selectedAmountSats && !PRESET_AMOUNTS.includes(selectedAmountSats);
  const customSats = Number(amountValue) || 0;
  const customError = !customSats
    ? ''
    : customSats < MIN_AMOUNT
    ? t('apps.chatGPT.confirmationPage.minimumAmountError', {
        amount: formatSats(MIN_AMOUNT),
      })
    : customSats > MAX_AMOUNT
    ? t('apps.chatGPT.confirmationPage.maximumAmountError', {
        amount: formatSats(MAX_AMOUNT),
      })
    : '';

  const renderOption = (key, label, selected, onPress) => (
    <TouchableOpacity
      key={key}
      activeOpacity={0.7}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[
        styles.option,
        {
          backgroundColor: selected ? tokens.surface : tokens.ground,
          borderColor: selected ? tokens.accent : 'transparent',
        },
      ]}
    >
      <ThemeText
        styles={[styles.optionText, selected && { color: tokens.link }]}
        content={label}
      />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <AnimatedStep
        active={currentPage === 'select'}
        direction={direction}
        exitsBack={direction === -1}
      >
        <ThemeText
          styles={styles.selectTitle}
          content={t('apps.chatGPT.confirmationPage.chooseAmount')}
        />
        <ThemeText
          variant="body"
          styles={{ color: tokens.muted }}
          content={t('apps.chatGPT.confirmationPage.chooseAmountSub')}
        />

        <View style={styles.grid}>
          {PRESET_AMOUNTS.map(sats =>
            renderOption(
              sats,
              formatSats(sats),
              selectedAmountSats === sats,
              () => setSelectedAmountSats(sats),
            ),
          )}
          {renderOption(
            'custom',
            t('apps.chatGPT.confirmationPage.custom'),
            isCustomSelected,
            () => {
              setAmountValue('');
              pushStep('custom');
            },
          )}
        </View>

        <CustomButton
          buttonStyles={styles.bottomButton}
          textContent={t('constants.continue')}
          actionFunction={() => pushStep('confirm')}
          disabled={!selectedAmountSats}
          size="regular"
        />
      </AnimatedStep>

      <AnimatedStep
        active={currentPage === 'custom'}
        direction={direction}
        exitsBack={direction === -1}
      >
        <TopBar onBack={goBack} />
        <View style={styles.customAmount}>
          <AmountHero
            amount={customSats}
            masterInfoObject={satsMasterInfoObject}
            fiatStats={fiatStats}
            amountSize={52}
            mutedValue={!customSats}
          />
          {!!customError && (
            <ThemeText
              styles={[styles.customError, { color: tokens.muted }]}
              content={customError}
            />
          )}
        </View>
        <View style={styles.keypad}>
          <CustomNumberKeyboard
            showDot={false}
            setInputValue={setAmountValue}
            usingForBalance={true}
            redesign={true}
            bottomLeftEmpty={true}
          />
          <CustomButton
            buttonStyles={styles.keypadButton}
            textContent={t('constants.continue')}
            disabled={!customSats || !!customError}
            actionFunction={() => {
              setSelectedAmountSats(customSats);
              pushStep('confirm');
            }}
            size="regular"
          />
        </View>
      </AnimatedStep>

      <AnimatedStep
        active={currentPage === 'confirm'}
        direction={direction}
        exitsBack={direction === -1}
      >
        <TopBar onBack={goBack} />
        <View style={styles.confirmAmount}>
          <ThemeText
            variant="body"
            styles={{ color: tokens.muted }}
            content={t('apps.chatGPT.confirmationPage.buyCredits')}
          />
          <AmountHero
            amount={selectedAmountSats}
            masterInfoObject={satsMasterInfoObject}
            fiatStats={fiatStats}
            amountSize={48}
          />
        </View>

        <View style={styles.confirmBottom}>
          <Note
            tone="warn"
            text={t('apps.chatGPT.confirmationPage.contributionWarning')}
          />
          <SwipeButtonNew
            onSwipeSuccess={payForCredits}
            disabled={!invoiceInformation}
            title={t('apps.chatGPT.confirmationPage.slideToPay')}
            width={0.9}
            height={64}
            containerStyles={{
              backgroundColor: tokens.ground,
              borderColor: tokens.ground,
              opacity: invoiceInformation ? 1 : 0.5,
            }}
            railStyles={{
              backgroundColor: tokens.accent,
              borderColor: tokens.accent,
            }}
            thumbIconStyles={{
              backgroundColor: tokens.accent,
              borderColor: tokens.accent,
            }}
            thumbIconComponent={SlideThumbIcon}
            titleStyles={{ color: tokens.muted }}
          />
        </View>
      </AnimatedStep>

      <AnimatedStep
        active={currentPage === 'loading'}
        direction={direction}
        exitsBack={direction === -1}
      >
        <View style={styles.loading}>
          <StepProgress
            title={`${t('constants.processing')}…`}
            subtitle={t('apps.chatGPT.confirmationPage.buying', {
              amount: formatSats(selectedAmountSats),
            })}
          />
        </View>
      </AnimatedStep>

      <AnimatedStep
        active={currentPage === 'error'}
        direction={direction}
        exitsBack={direction === -1}
      >
        <View style={styles.error}>
          <EmptyState
            icon="TriangleAlert"
            iconTone="danger"
            size="large"
            title={t('apps.chatGPT.confirmationPage.errorTitle')}
            sub={error}
          />
        </View>
        <View style={styles.errorButtons}>
          <CustomButton
            buttonStyles={styles.fullWidth}
            textContent={t('constants.tryAgain')}
            actionFunction={goBack}
            size="regular"
          />
          <CustomButton
            buttonStyles={styles.fullWidth}
            textContent={t('constants.back')}
            actionFunction={() =>
              moveStep(-1, step[step.length - 3], prev => prev.slice(0, -2))
            }
            size="regular"
            tone="secondary"
          />
        </View>
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
  selectTitle: {
    fontSize: 20,
    lineHeight: 26,
    marginTop: 20,
    marginBottom: 4,
    includeFontPadding: false,
  },
  grid: {
    marginTop: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  option: {
    width: '47%',
    flexGrow: 1,
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  optionText: {
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  bottomButton: {
    width: '100%',
    marginTop: 'auto',
  },
  customAmount: {
    marginTop: 24,
    alignItems: 'center',
  },
  customError: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 4,
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
  confirmAmount: {
    marginTop: 4,
    alignItems: 'center',
  },
  confirmBottom: {
    marginTop: 'auto',
    gap: 16,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
  },
  error: {
    marginTop: 40,
  },
  errorButtons: {
    marginTop: 'auto',
    gap: 10,
  },
  fullWidth: {
    width: '100%',
  },
});
