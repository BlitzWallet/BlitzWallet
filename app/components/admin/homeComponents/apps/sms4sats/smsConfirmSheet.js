import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../../../functions/CustomElements';
import { FONT } from '../../../../../constants';
import GetThemeColors from '../../../../../hooks/themeColors';
import SwipeButtonNew from '../../../../../functions/CustomElements/sliderButton';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import CustomButton from '../../../../../functions/CustomElements/button';
import ListCard from '../../../../../functions/CustomElements/redesign/ListCard';
import KeyValueRow from '../../../../../functions/CustomElements/redesign/KeyValueRow';
import Note from '../../../../../functions/CustomElements/redesign/Note';
import EmptyState from '../../../../../functions/CustomElements/redesign/EmptyState';
import StepProgress from '../../../../../functions/CustomElements/redesign/StepProgress';
import AnimatedStep from '../../../../../functions/CustomElements/redesign/AnimatedStep';
import { sparkPaymenWrapper } from '../../../../../functions/spark/payments';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import { useSparkWallet } from '../../../../../../context-store/sparkContext';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import { useWebView } from '../../../../../../context-store/webViewContext';
import { useNodeContext } from '../../../../../../context-store/nodeContext';

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

// Confirm sheet shared by Send (text) and Receive (number): creates the
// order, estimates the fee, then slide to pay. All steps share one height so
// the sheet never resizes under a sliding step.
// createOrder() resolves to { payreq, amountSat, ...extra }; onConfirm gets
// that object plus fee and supportFee once the user slides.
export default function SMSConfirmSheet({
  label,
  headline,
  rows = [],
  note,
  planType,
  sheetHeight,
  createOrder,
  onConfirm,
  setContentHeight,
  handleBackPressFunction,
}) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { tokens } = GetThemeColors();
  const { sendWebViewRequest } = useWebView();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { sparkInformation } = useSparkWallet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const [invoiceInformation, setInvoiceInformation] = useState(null);
  const [error, setError] = useState('');

  const page = error ? 'error' : invoiceInformation ? 'confirm' : 'loading';

  useEffect(() => {
    setContentHeight(sheetHeight);
  }, [setContentHeight, sheetHeight]);

  const formatSats = amount =>
    displayCorrectDenomination({
      amount,
      masterInfoObject: {
        ...masterInfoObject,
        userBalanceDenomination: 'sats',
        satDisplay: 'word',
      },
      fiatStats,
    });

  useEffect(() => {
    let mounted = true;
    async function fetchInvoice() {
      try {
        const order = await createOrder();
        const fee = await sparkPaymenWrapper({
          getFee: true,
          address: order.payreq,
          paymentType: 'lightning',
          amountSats: order.amountSat,
          masterInfoObject,
          sparkInformation,
          userBalance: sparkInformation.balance,
          mnemonic: currentWalletMnemoinc,
          sendWebViewRequest,
        });
        if (!fee.didWork) throw new Error(t('errormessages.paymentFeeError'));
        if (
          sparkInformation.balance <
          order.amountSat + fee.supportFee + fee.fee
        ) {
          throw new Error(
            t('errormessages.insufficientBalanceError', { planType }),
          );
        }
        if (!mounted) return;
        setInvoiceInformation({
          ...order,
          fee: fee.fee,
          supportFee: fee.supportFee,
        });
      } catch (err) {
        console.log('Error fetching sms invoice:', err);
        if (!mounted) return;
        setError(err.message || t('errormessages.invoiceRetrivalError'));
      }
    }
    // Let the sheet finish sliding in before the network work starts.
    requestAnimationFrame(() => requestAnimationFrame(fetchInvoice));
    return () => {
      mounted = false;
    };
  }, []);

  const onSwipeSuccess = useCallback(() => {
    handleBackPressFunction(() => {
      navigate.goBack();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          onConfirm(invoiceInformation);
        });
      });
    });
  }, [handleBackPressFunction, invoiceInformation, navigate, onConfirm]);

  return (
    <View style={styles.container}>
      <AnimatedStep active={page === 'loading'} direction={1} fadeOnly>
        <View style={styles.centered}>
          <StepProgress title={`${t('constants.loading')}…`} />
        </View>
      </AnimatedStep>

      <AnimatedStep active={page === 'confirm'} direction={1} fadeOnly>
        <View style={styles.header}>
          <ThemeText
            styles={[styles.label, { color: tokens.muted }]}
            content={label}
          />
          <ThemeText
            styles={styles.headline}
            CustomNumberOfLines={2}
            content={headline}
          />
        </View>

        {!!invoiceInformation && (
          <ListCard>
            {rows.map(row => (
              <KeyValueRow
                key={row.label}
                label={row.label}
                value={row.value}
                mono={false}
              />
            ))}
            <KeyValueRow
              label={t('apps.sms4sats.confirmationSlideUp.price')}
              value={formatSats(invoiceInformation.amountSat)}
              mono={false}
            />
            <KeyValueRow
              label={t('apps.sms4sats.confirmationSlideUp.fee')}
              value={formatSats(
                invoiceInformation.fee + invoiceInformation.supportFee,
              )}
              mono={false}
            />
          </ListCard>
        )}

        <View style={styles.bottom}>
          {!!note && <Note text={note} />}
          <SwipeButtonNew
            onSwipeSuccess={onSwipeSuccess}
            title={t('apps.sms4sats.confirmationSlideUp.slideToPay')}
            width={0.9}
            height={64}
            containerStyles={{
              backgroundColor: tokens.ground,
              borderColor: tokens.ground,
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

      <AnimatedStep active={page === 'error'} direction={1} fadeOnly>
        <View style={styles.centered}>
          <EmptyState
            icon="TriangleAlert"
            iconTone="danger"
            size="large"
            title={t('errormessages.genericError')}
            sub={error}
          />
        </View>
        <CustomButton
          buttonStyles={styles.fullWidth}
          textContent={t('constants.close')}
          actionFunction={handleBackPressFunction}
          size="regular"
        />
      </AnimatedStep>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginHorizontal: 20,
    overflow: 'hidden',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
  },
  headline: {
    fontFamily: FONT.Title_Medium,
    fontSize: 24,
    lineHeight: 32,
    marginTop: 4,
    textAlign: 'center',
    includeFontPadding: false,
  },
  bottom: {
    marginTop: 'auto',
    gap: 16,
  },
  fullWidth: {
    width: '100%',
  },
});
