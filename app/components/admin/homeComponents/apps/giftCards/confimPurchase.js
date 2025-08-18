import {StyleSheet, View} from 'react-native';
import {ThemeText} from '../../../../../functions/CustomElements';
import GetThemeColors from '../../../../../hooks/themeColors';
import {SIZES} from '../../../../../constants';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import {useNavigation} from '@react-navigation/native';
import {useCallback, useEffect, useState} from 'react';
import {useGlobalAppData} from '../../../../../../context-store/appData';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import {getCountryInfoAsync} from 'react-native-country-picker-modal/lib/CountryService';
import fetchBackend from '../../../../../../db/handleBackend';
import {useKeysContext} from '../../../../../../context-store/keys';
import SwipeButtonNew from '../../../../../functions/CustomElements/sliderButton';
import {sparkPaymenWrapper} from '../../../../../functions/spark/payments';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import {parse} from '@breeztech/react-native-breez-sdk-liquid';
import StoreErrorPage from '../components/errorScreen';
import {useSparkWallet} from '../../../../../../context-store/sparkContext';
import {useActiveCustodyAccount} from '../../../../../../context-store/activeAccount';
import {useTranslation} from 'react-i18next';

export default function ConfirmGiftCardPurchase(props) {
  const {contactsPrivateKey, publicKey} = useKeysContext();
  const {currentWalletMnemoinc} = useActiveCustodyAccount();
  const {masterInfoObject} = useGlobalContextProvider();
  const {sparkInformation} = useSparkWallet();
  const {textColor, backgroundOffset, backgroundColor} = GetThemeColors();
  const {decodedGiftCards} = useGlobalAppData();
  const navigate = useNavigation();
  const [error, setError] = useState('');
  const {t} = useTranslation();

  const [retrivedInformation, setRetrivedInformation] = useState({
    countryInfo: {},
    productInfo: {},
  });

  const ISOCode = decodedGiftCards.profile?.isoCode;
  const productID = props?.productId;
  const productPrice = props?.price;
  const productQantity = props?.quantity;
  const email = props?.email;
  const blitzUsername = props.blitzUsername;
  const theme = props?.theme;
  const darkModeType = props?.darkModeTyoe;

  useEffect(() => {
    async function getGiftCardInfo() {
      try {
        const postData = {
          type: 'buyGiftCard',
          productId: productID, //string
          cardValue: Number(productPrice), //number
          quantity: Number(productQantity), //number
          email: email,
          blitzUsername: blitzUsername,
        };
        const [response, countryInfo] = await Promise.all([
          fetchBackend(
            'theBitcoinCompanyV3',
            postData,
            contactsPrivateKey,
            publicKey,
          ),
          getCountryInfoAsync({
            countryCode: ISOCode || 'US',
          }),
        ]);

        if (!response) throw new Error(t('errormessages.invoiceRetrivalError'));

        const parsedInput = await parse(response.result?.invoice);

        const fee = await sparkPaymenWrapper({
          getFee: true,
          address: response.result?.invoice,
          paymentType: 'lightning',
          amountSats: Number(parsedInput.invoice.amountMsat / 1000),
          masterInfoObject,
          mnemonic: currentWalletMnemoinc,
        });

        if (!fee.didWork) throw new Error(fee.error);
        if (sparkInformation.balance < fee.supportFee + fee.fee) {
          throw new Error(
            t('errormessages.insufficientBalanceError', {
              planType: 'gift card',
            }),
          );
        }

        setRetrivedInformation({
          countryInfo: countryInfo,
          productInfo:
            {
              ...response.result,
              paymentFee: fee.fee,
              supportFee: fee.supportFee,
              parsedInput,
            } || {},
        });
      } catch (err) {
        console.log(err);
        setError(err.message);
      }
    }
    getGiftCardInfo();
  }, []);

  const fee =
    (retrivedInformation?.productInfo?.paymentFee || 0) +
    (retrivedInformation?.productInfo?.supportFee || 0);

  const onSwipeSuccess = useCallback(() => {
    navigate.goBack();
    setTimeout(() => {
      props.purchaseGiftCard(retrivedInformation.productInfo);
    }, 200);
  }, [retrivedInformation]);

  if (error) {
    return <StoreErrorPage error={error} />;
  }

  return (
    <View style={styles.halfModalContainer}>
      {Object.keys(retrivedInformation.productInfo).length === 0 ? (
        <FullLoadingScreen />
      ) : (
        <>
          <ThemeText
            styles={{
              fontSize: SIZES.large,
              textAlign: 'center',
            }}
            content={t('apps.giftCards.confimPurchase.quantity', {
              quantity: props.quantity,
            })}
          />
          <ThemeText
            styles={{fontSize: SIZES.large, marginTop: 10}}
            content={t('apps.giftCards.confimPurchase.cardAmount', {
              amount: props.price,
              currency: retrivedInformation.countryInfo.currency,
            })}
          />

          <FormattedSatText
            neverHideBalance={true}
            containerStyles={{marginTop: 'auto'}}
            styles={{
              fontSize: SIZES.large,
              textAlign: 'center',
            }}
            frontText={t('apps.giftCards.confimPurchase.price')}
            balance={retrivedInformation.productInfo.amount}
          />

          <FormattedSatText
            neverHideBalance={true}
            containerStyles={{marginTop: 5, marginBottom: 'auto'}}
            styles={{
              textAlign: 'center',
            }}
            frontText={t('apps.giftCards.confimPurchase.fee')}
            balance={fee}
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
