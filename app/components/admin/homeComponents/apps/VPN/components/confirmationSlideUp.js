import {StyleSheet, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useCallback, useEffect, useState} from 'react';
import {ThemeText} from '../../../../../../functions/CustomElements';
import {SIZES} from '../../../../../../constants';
import FormattedSatText from '../../../../../../functions/CustomElements/satTextDisplay';
import GetThemeColors from '../../../../../../hooks/themeColors';
import FullLoadingScreen from '../../../../../../functions/CustomElements/loadingScreen';
import SwipeButtonNew from '../../../../../../functions/CustomElements/sliderButton';
import {sparkPaymenWrapper} from '../../../../../../functions/spark/payments';
import {useGlobalContextProvider} from '../../../../../../../context-store/context';
import {useSparkWallet} from '../../../../../../../context-store/sparkContext';

export default function ConfirmVPNPage(props) {
  const navigate = useNavigation();
  const {masterInfoObject} = useGlobalContextProvider();
  const {sparkInformation} = useSparkWallet();
  const {
    duration,
    country,
    createVPN,
    price,
    slideHeight,
    theme,
    darkModeType,
  } = props;
  const {textColor, backgroundOffset, backgroundColor} = GetThemeColors();

  const [invoiceInformation, setInvoiceInformation] = useState(null);

  useEffect(() => {
    async function fetchInvoice() {
      try {
        const response = await fetch('https://lnvpn.net/api/v1/getInvoice', {
          method: 'POST',
          body: new URLSearchParams({
            duration: duration === 'week' ? 1.5 : duration === 'month' ? 4 : 9,
          }).toString(),
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });
        const invoice = await response.json();
        if (!invoice || !invoice.payment_hash || !invoice.payment_request)
          throw new Error('Not able to fetch invoice information');

        const fee = await sparkPaymenWrapper({
          getFee: true,
          address: invoice.payment_request,
          paymentType: 'lightning',
          amountSats: price,
          masterInfoObject,
          sparkInformation,
          userBalance: sparkInformation.balance,
        });
        if (!fee.didWork) throw new Error(fee.error);
        if (sparkInformation.balance < fee.supportFee + fee.fee) {
          throw new Error('Insufficient balance to purchase credits');
        }

        setInvoiceInformation({
          payment_hash: invoice.payment_hash,
          payment_request: invoice.payment_request,
          supportFee: fee.supportFee,
          fee: fee.fee,
        });
      } catch (err) {
        console.log('Error fetching invoice information:', err);
        navigate.goBack();
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            navigate.navigate('ErrorScreen', {
              errorMessage: err.message,
            });
          });
        });
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

  return (
    <View style={styles.container}>
      {!invoiceInformation ? (
        <FullLoadingScreen />
      ) : (
        <>
          <ThemeText
            styles={{
              fontSize: SIZES.large,
              textAlign: 'center',
              marginBottom: 5,
            }}
            content={'Confirm Country'}
          />
          <ThemeText
            styles={{
              fontSize: SIZES.large,
              textAlign: 'center',
            }}
            content={`${country}`}
          />
          <ThemeText
            styles={{fontSize: SIZES.large, marginTop: 10}}
            content={`Duration: 1 ${duration}`}
          />
          <FormattedSatText
            neverHideBalance={true}
            containerStyles={{marginTop: 'auto'}}
            styles={{
              fontSize: SIZES.large,
              textAlign: 'center',
            }}
            frontText={'Price: '}
            balance={price}
          />
          <FormattedSatText
            neverHideBalance={true}
            containerStyles={{marginTop: 10, marginBottom: 'auto'}}
            styles={{
              textAlign: 'center',
            }}
            frontText={'Fee: '}
            balance={invoiceInformation.fee + invoiceInformation.supportFee}
          />

          <SwipeButtonNew
            onSwipeSuccess={onSwipeSuccess}
            width={0.95}
            containerStyles={{marginBottom: 20}}
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
