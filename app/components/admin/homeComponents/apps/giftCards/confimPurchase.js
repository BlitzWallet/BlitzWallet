import {Platform, StyleSheet, useWindowDimensions, View} from 'react-native';
import {ThemeText} from '../../../../../functions/CustomElements';
import GetThemeColors from '../../../../../hooks/themeColors';
import {LIQUID_DEFAULT_FEE, SIZES} from '../../../../../constants';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import {useNavigation} from '@react-navigation/native';
import {useCallback, useEffect, useState} from 'react';
import {useGlobalAppData} from '../../../../../../context-store/appData';
import {calculateBoltzFeeNew} from '../../../../../functions/boltz/boltzFeeNew';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import {getCountryInfoAsync} from 'react-native-country-picker-modal/lib/CountryService';
import {LIGHTNINGAMOUNTBUFFER} from '../../../../../constants/math';
import fetchBackend from '../../../../../../db/handleBackend';
import {useNodeContext} from '../../../../../../context-store/nodeContext';
import {useAppStatus} from '../../../../../../context-store/appStatus';
import {useKeysContext} from '../../../../../../context-store/keys';
import SwipeButtonNew from '../../../../../functions/CustomElements/sliderButton';

export default function ConfirmGiftCardPurchase(props) {
  const {contactsPrivateKey, publicKey} = useKeysContext();
  const {nodeInformation} = useNodeContext();
  const {textColor, backgroundOffset, backgroundColor} = GetThemeColors();
  const {minMaxLiquidSwapAmounts} = useAppStatus();
  const {decodedGiftCards} = useGlobalAppData();
  const navigate = useNavigation();
  const liquidTxFee =
    process.env.BOLTZ_ENVIRONMENT === 'testnet' ? 30 : LIQUID_DEFAULT_FEE;
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

        if (!response) {
          navigate.goBack();
          navigate.navigate('ErrorScreen', {
            errorMessage:
              'Not able to generate invoice for gift card. Please try again later.',
          });
          return;
        }

        setRetrivedInformation({
          countryInfo: countryInfo,
          productInfo: response.result || {},
        });
      } catch (err) {
        console.log(err);
        navigate.goBack();
        navigate.navigate('ErrorScreen', {
          errorMessage: 'Error getting payment detials',
        });
      }
    }
    getGiftCardInfo();
  }, []);

  const fee =
    nodeInformation.userBalance >
    retrivedInformation?.productInfo?.amount + LIGHTNINGAMOUNTBUFFER
      ? Math.round(retrivedInformation?.productInfo?.amount * 0.01)
      : liquidTxFee +
        calculateBoltzFeeNew(
          retrivedInformation?.productInfo?.amount,
          'liquid-ln',
          minMaxLiquidSwapAmounts.submarineSwapStats,
        );
  const onSwipeSuccess = useCallback(() => {
    navigate.goBack();
    setTimeout(() => {
      props.purchaseGiftCard(retrivedInformation.productInfo);
    }, 200);
  }, [retrivedInformation]);
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
            content={`Quantity: ${props.quantity}`}
          />
          <ThemeText
            styles={{fontSize: SIZES.large, marginTop: 10}}
            content={`Card amount: ${props.price} ${retrivedInformation.countryInfo.currency}`}
          />

          <FormattedSatText
            neverHideBalance={true}
            containerStyles={{marginTop: 'auto'}}
            styles={{
              fontSize: SIZES.large,
              textAlign: 'center',
            }}
            frontText={'Price: '}
            balance={retrivedInformation.productInfo.amount}
          />

          <FormattedSatText
            neverHideBalance={true}
            containerStyles={{marginTop: 5, marginBottom: 'auto'}}
            styles={{
              textAlign: 'center',
            }}
            frontText={'Fee: '}
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
