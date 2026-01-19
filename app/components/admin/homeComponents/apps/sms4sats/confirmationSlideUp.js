import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ThemeText } from '../../../../../functions/CustomElements';
import { SIZES } from '../../../../../constants';
import { parsePhoneNumberWithError } from 'libphonenumber-js';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import GetThemeColors from '../../../../../hooks/themeColors';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import SwipeButtonNew from '../../../../../functions/CustomElements/sliderButton';
import { useCallback, useEffect, useState } from 'react';
import { useSparkWallet } from '../../../../../../context-store/sparkContext';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { sparkPaymenWrapper } from '../../../../../functions/spark/payments';
import StoreErrorPage from '../components/errorScreen';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import { useTranslation } from 'react-i18next';
import { decode } from 'bolt11';
import { useWebView } from '../../../../../../context-store/webViewContext';

export default function ConfirmSMSPayment(props) {
  const { sendWebViewRequest } = useWebView();
  const navigate = useNavigation();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { sparkInformation } = useSparkWallet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { t } = useTranslation();
  const {
    message,
    areaCodeNum,
    phoneNumber,
    page,
    sendTextMessage,
    theme,
    darkModeType,
  } = props;

  const [invoiceInformation, setInvoiceInformation] = useState(null);
  const [error, setError] = useState('');

  console.log(areaCodeNum, phoneNumber, page, sendTextMessage);

  const formattedPhoneNumber = () => {
    try {
      return parsePhoneNumberWithError(
        `${areaCodeNum}${phoneNumber}`,
      ).formatInternational();
    } catch (err) {
      console.log(err);
      return t('apps.sms4sats.confirmationSlideUp.invalidNumer');
    }
  };

  const onSwipeSuccess = useCallback(() => {
    navigate.goBack();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        sendTextMessage(invoiceInformation);
      });
    });
  }, [invoiceInformation]);

  useEffect(() => {
    let mounted = true;
    async function fetchInvoice() {
      try {
        const payload = {
          message: message,
          phone: `${areaCodeNum}${phoneNumber}`,
          ref: process.env.GPT_PAYOUT_LNURL,
        };

        const response = await fetch(
          `https://api2.sms4sats.com/createsendorder`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
        );

        const data = await response.json();

        if (!data.payreq || !data.orderId) throw new Error(data.reason);

        const decodedInvoice = decode(data.payreq);

        const fee = await sparkPaymenWrapper({
          getFee: true,
          address: data.payreq,
          paymentType: 'lightning',
          amountSats: decodedInvoice.satoshis,
          masterInfoObject,
          sparkInformation,
          userBalance: sparkInformation.balance,
          mnemonic: currentWalletMnemoinc,
          sendWebViewRequest,
        });
        if (!fee.didWork) throw new Error(t('errormessages.paymentFeeError'));
        if (
          sparkInformation.balance <
          decodedInvoice.satoshis + fee.supportFee + fee.fee
        ) {
          throw new Error(
            t('errormessages.insufficientBalanceError', { planType: 'SMS' }),
          );
        }
        if (!mounted) return;
        setInvoiceInformation({
          fee: fee.fee,
          supportFee: fee.supportFee,
          payreq: data.payreq,
          orderId: data.orderId,
          amountSat: decodedInvoice.satoshis,
        });
      } catch (err) {
        console.log('Error fetching invoice:', err);
        if (!mounted) return;
        setError(err.message);
      }
    }
    fetchInvoice();
    return () => {
      mounted = false;
    };
  }, []);

  if (error) {
    return <StoreErrorPage error={error} />;
  }

  return (
    <View style={styles.halfModalContainer}>
      {!invoiceInformation ? (
        <FullLoadingScreen />
      ) : (
        <>
          <ThemeText
            styles={{ fontSize: SIZES.xLarge, textAlign: 'center' }}
            content={t('apps.sms4sats.confirmationSlideUp.title')}
          />
          <ThemeText
            styles={{
              fontSize: SIZES.large,
              textAlign: 'center',
            }}
            content={`${formattedPhoneNumber()}`}
          />
          <FormattedSatText
            neverHideBalance={true}
            containerStyles={{ marginTop: 'auto' }}
            styles={{
              fontSize: SIZES.large,
              textAlign: 'center',
            }}
            frontText={t('apps.sms4sats.confirmationSlideUp.price')}
            balance={invoiceInformation.amountSat}
          />
          <FormattedSatText
            neverHideBalance={true}
            containerStyles={{ marginTop: 10, marginBottom: 'auto' }}
            styles={{
              textAlign: 'center',
            }}
            frontText={t('apps.sms4sats.confirmationSlideUp.fee')}
            balance={invoiceInformation.fee + invoiceInformation.supportFee}
          />
          <SwipeButtonNew
            onSwipeSuccess={onSwipeSuccess}
            width={0.95}
            containerStyles={{ marginBottom: 20 }}
            thumbIconStyles={{
              backgroundColor:
                theme && darkModeType ? backgroundOffset : backgroundColor,
              borderColor:
                theme && darkModeType ? backgroundOffset : backgroundColor,
            }}
            railStyles={{
              backgroundColor:
                theme && darkModeType ? backgroundOffset : backgroundColor,
              borderColor:
                theme && darkModeType ? backgroundOffset : backgroundColor,
            }}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  halfModalContainer: {
    flex: 1,
    alignItems: 'center',
  },
});
