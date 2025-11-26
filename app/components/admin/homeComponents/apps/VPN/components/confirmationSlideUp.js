import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { ThemeText } from '../../../../../../functions/CustomElements';
import { SIZES } from '../../../../../../constants';
import FormattedSatText from '../../../../../../functions/CustomElements/satTextDisplay';
import GetThemeColors from '../../../../../../hooks/themeColors';
import FullLoadingScreen from '../../../../../../functions/CustomElements/loadingScreen';
import SwipeButtonNew from '../../../../../../functions/CustomElements/sliderButton';
import { sparkPaymenWrapper } from '../../../../../../functions/spark/payments';
import { useGlobalContextProvider } from '../../../../../../../context-store/context';
import { useSparkWallet } from '../../../../../../../context-store/sparkContext';
import StoreErrorPage from '../../components/errorScreen';
import { useActiveCustodyAccount } from '../../../../../../../context-store/activeAccount';
import { useTranslation } from 'react-i18next';
import { decode } from 'bolt11';
import { useWebView } from '../../../../../../../context-store/webViewContext';

export default function ConfirmVPNPage(props) {
  const { sendWebViewRequest } = useWebView();
  const navigate = useNavigation();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { masterInfoObject } = useGlobalContextProvider();
  const { sparkInformation } = useSparkWallet();
  const { duration, country, createVPN, slideHeight, theme, darkModeType } =
    props;
  const { textColor, backgroundOffset, backgroundColor } = GetThemeColors();
  const { t } = useTranslation();

  const [invoiceInformation, setInvoiceInformation] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchInvoice() {
      try {
        const response = await fetch(process.env.LNVPN_PURCHASE_REQUEST, {
          method: 'POST',
          body: JSON.stringify({
            duration: duration,
            paymentMethod: 'lightning',
            refCode: 'BlitzWallet',
          }),
          headers: {
            Accept: '*/*',
            'Content-Type': 'application/json',
          },
        });
        const invoice = await response.json();

        if (!invoice.success)
          throw new Error(t('apps.VPN.confirmationSlideUp.invoiceInfoError'));
        const { data } = invoice;
        if (!data.payment_hash || !data.payment_request)
          throw new Error(t('apps.VPN.confirmationSlideUp.invoiceInfoError'));

        const parsedInvoice = decode(data.payment_request);

        const fee = await sparkPaymenWrapper({
          getFee: true,
          address: data.payment_request,
          paymentType: 'lightning',
          amountSats: parsedInvoice.satoshis,
          masterInfoObject,
          sparkInformation,
          userBalance: sparkInformation.balance,
          mnemonic: currentWalletMnemoinc,
          sendWebViewRequest,
        });
        if (!fee.didWork) throw new Error(t('errormessages.paymentFeeError'));
        if (
          sparkInformation.balance <
          parsedInvoice.satoshis + fee.supportFee + fee.fee
        ) {
          throw new Error(
            t('errormessages.insufficientBalanceError', { planType: 'VPN' }),
          );
        }

        setInvoiceInformation({
          payment_hash: data.payment_hash,
          payment_request: data.payment_request,
          paymentIdentifier: data.paymentIdentifier,
          supportFee: fee.supportFee,
          fee: fee.fee,
          price: parsedInvoice.satoshis,
        });
      } catch (err) {
        console.log('Error fetching invoice information:', err);
        setError(err.message);
      }
    }
    fetchInvoice();
  }, []);

  const onSwipeSuccess = useCallback(() => {
    navigate.goBack();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        createVPN(invoiceInformation);
      });
    });
  }, [invoiceInformation]);

  if (error) {
    return <StoreErrorPage error={error} />;
  }

  return (
    <View style={styles.container}>
      {!invoiceInformation ? (
        <FullLoadingScreen />
      ) : (
        <>
          <ThemeText
            styles={{
              fontSize: SIZES.xLarge,
              marginBottom: 5,
            }}
            content={t('apps.VPN.confirmationSlideUp.title')}
          />
          <ThemeText
            content={country
              .replace(/[\u{1F1E6}-\u{1F1FF}]{2}\s*/gu, '')
              .replace(/-/g, ' ')}
          />
          <ThemeText
            styles={{ marginTop: 5 }}
            content={'1 ' + t(`apps.VPN.durationSlider.${duration}`)}
          />
          <FormattedSatText
            neverHideBalance={true}
            containerStyles={{ marginTop: 'auto' }}
            styles={{
              fontSize: SIZES.large,
              textAlign: 'center',
            }}
            frontText={t('apps.VPN.confirmationSlideUp.price')}
            balance={invoiceInformation.price}
          />
          <FormattedSatText
            neverHideBalance={true}
            containerStyles={{ marginTop: 10, marginBottom: 'auto' }}
            styles={{
              textAlign: 'center',
            }}
            frontText={t('apps.VPN.confirmationSlideUp.fee')}
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
  container: {
    flex: 1,
    alignItems: 'center',
  },
});
