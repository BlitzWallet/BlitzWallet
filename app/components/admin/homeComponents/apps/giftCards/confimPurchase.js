import {Platform, StyleSheet, useWindowDimensions, View} from 'react-native';
import {ThemeText} from '../../../../../functions/CustomElements';
import GetThemeColors from '../../../../../hooks/themeColors';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  CENTER,
  COLORS,
  LIQUID_DEFAULT_FEE,
  SIZES,
} from '../../../../../constants';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import SwipeButton from 'rn-swipe-button';
import {useNavigation} from '@react-navigation/native';
import {useEffect, useState} from 'react';
import {useGlobalAppData} from '../../../../../../context-store/appData';
import {calculateBoltzFeeNew} from '../../../../../functions/boltz/boltzFeeNew';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import {ANDROIDSAFEAREA} from '../../../../../constants/styles';
import {getCountryInfoAsync} from 'react-native-country-picker-modal/lib/CountryService';
import {LIGHTNINGAMOUNTBUFFER} from '../../../../../constants/math';
import fetchBackend from '../../../../../../db/handleBackend';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import {useNodeContext} from '../../../../../../context-store/nodeContext';
import {useAppStatus} from '../../../../../../context-store/appStatus';
import {useKeysContext} from '../../../../../../context-store/keys';
export default function ConfirmGiftCardPurchase(props) {
  const {contactsPrivateKey, publicKey} = useKeysContext();
  const {nodeInformation} = useNodeContext();
  const {minMaxLiquidSwapAmounts} = useAppStatus();
  const {theme} = useGlobalThemeContext();
  const {decodedGiftCards} = useGlobalAppData();
  const {backgroundColor, backgroundOffset, textColor} = GetThemeColors();
  const navigate = useNavigation();
  const insets = useSafeAreaInsets();
  // const [liquidTxFee, setLiquidTxFee] = useState(null);
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

  const bottomPadding = Platform.select({
    ios: insets.bottom,
    android: ANDROIDSAFEAREA,
  });

  return (
    <View
      style={{
        ...styles.halfModalContainer,
        height: useWindowDimensions().height * 0.5,
        backgroundColor: backgroundColor,
        paddingBottom: bottomPadding,
      }}>
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: backgroundOffset,
          },
        ]}
      />

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

          <SwipeButton
            containerStyles={{
              ...styles.confirmSlider,
              borderColor: textColor,
            }}
            titleStyles={{fontWeight: 'bold', fontSize: SIZES.large}}
            swipeSuccessThreshold={100}
            onSwipeSuccess={() => {
              navigate.goBack();

              setTimeout(() => {
                props.purchaseGiftCard(retrivedInformation.productInfo);
              }, 200);
            }}
            railBackgroundColor={theme ? COLORS.darkModeText : COLORS.primary}
            railBorderColor={
              theme ? backgroundColor : COLORS.lightModeBackground
            }
            height={55}
            railStyles={{
              backgroundColor: theme ? backgroundColor : COLORS.darkModeText,
              borderColor: theme ? backgroundColor : COLORS.darkModeText,
            }}
            thumbIconBackgroundColor={
              theme ? backgroundColor : COLORS.darkModeText
            }
            thumbIconBorderColor={theme ? backgroundColor : COLORS.darkModeText}
            titleColor={theme ? backgroundColor : COLORS.darkModeText}
            title="Slide to confirm"
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  halfModalContainer: {
    width: '100%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 10,
    alignItems: 'center',
    position: 'relative',
    zIndex: 1,
  },
  topBar: {
    width: 120,
    height: 8,
    marginTop: 10,
    borderRadius: 8,
    marginBottom: 20,
  },
  borderTop: {
    width: '100%',
    height: 60,
    position: 'absolute',
    top: -5,
    zIndex: -1,

    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },

  confirmSlider: {
    width: '90%',
    maxWidth: 350,
    ...CENTER,
    marginBottom: 20,
  },
});
