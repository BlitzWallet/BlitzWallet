import {StyleSheet, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {ThemeText} from '../../../../../functions/CustomElements';
import {SIZES} from '../../../../../constants';
import {parsePhoneNumberWithError} from 'libphonenumber-js';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import GetThemeColors from '../../../../../hooks/themeColors';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import SwipeButtonNew from '../../../../../functions/CustomElements/sliderButton';
import {useCallback, useEffect, useState} from 'react';
import {useSparkWallet} from '../../../../../../context-store/sparkContext';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import {sparkPaymenWrapper} from '../../../../../functions/spark/payments';

export default function ConfirmSMSPayment(props) {
  const navigate = useNavigation();
  const {sparkInformation} = useSparkWallet();
  const {masterInfoObject} = useGlobalContextProvider();
  const {backgroundOffset, backgroundColor} = GetThemeColors();
  const {
    message,
    areaCodeNum,
    phoneNumber,
    prices,
    page,
    sendTextMessage,
    theme,
    darkModeType,
  } = props;

  const [invoiceInformation, setInvoiceInformation] = useState(null);

  const price = page === 'sendSMS' ? 1000 : prices[page];

  console.log(areaCodeNum, phoneNumber, prices, page, sendTextMessage);

  const formattedPhoneNumber = () => {
    try {
      return parsePhoneNumberWithError(
        `${areaCodeNum}${phoneNumber}`,
      ).formatInternational();
    } catch (err) {
      console.log(err);
      return 'Not a valid phone number';
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
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload),
          },
        );

        const data = await response.json();

        if (!data.payreq || !data.orderId) throw new Error(data.reason);

        const fee = await sparkPaymenWrapper({
          getFee: true,
          address: data.payreq,
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
          fee: fee.fee,
          supportFee: fee.supportFee,
          payreq: data.payreq,
          orderId: data.orderId,
        });
      } catch (err) {
        console.log('Error fetching invoice:', err);
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

  return (
    <View style={styles.halfModalContainer}>
      {!invoiceInformation ? (
        <FullLoadingScreen />
      ) : (
        <>
          <ThemeText
            styles={{fontSize: SIZES.xLarge, textAlign: 'center'}}
            content={'Confirm number'}
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
  halfModalContainer: {
    flex: 1,
    alignItems: 'center',
  },
});
