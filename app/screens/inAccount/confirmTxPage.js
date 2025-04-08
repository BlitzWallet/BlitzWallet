import {
  StyleSheet,
  View,
  TouchableOpacity,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import {COLORS, FONT, SIZES} from '../../constants';
import {useNavigation} from '@react-navigation/native';
import {useCallback, useEffect, useMemo, useRef} from 'react';
import {GlobalThemeView, ThemeText} from '../../functions/CustomElements';
import CustomButton from '../../functions/CustomElements/button';
import LottieView from 'lottie-react-native';
import FormattedSatText from '../../functions/CustomElements/satTextDisplay';
import {copyToClipboard} from '../../functions';
import GetThemeColors from '../../hooks/themeColors';
import {openComposer} from 'react-native-email-link';
import {useGlobalThemeContext} from '../../../context-store/theme';
import useHandleBackPressNew from '../../hooks/useHandleBackPressNew';
import {
  applyErrorAnimationTheme,
  updateConfirmAnimation,
} from '../../functions/lottieViewColorTransformer';
const confirmTxAnimation = require('../../assets/confirmTxAnimation.json');
const errorTxAnimation = require('../../assets/errorTxAnimation.json');
export default function ConfirmTxPage(props) {
  const navigate = useNavigation();
  const handleBackPressFunction = useCallback(() => {
    navigate.popToTop();
  }, []);

  useHandleBackPressNew(handleBackPressFunction);
  const {backgroundOffset} = GetThemeColors();
  const {theme, darkModeType} = useGlobalThemeContext();
  const animationRef = useRef(null);
  const paymentType = props.route.params?.for;
  const paymentInformation = props.route.params?.information;
  const formmatingType = props.route.params?.formattingType;

  console.log(props.route.params);
  console.log(props.route.params?.information);

  const didSucceed =
    paymentInformation == undefined
      ? false
      : formmatingType === 'liquidNode'
      ? paymentInformation?.status === 'pending'
      : formmatingType === 'lightningNode'
      ? paymentInformation?.payment?.status === 'complete'
      : paymentInformation?.status === 'complete';

  const showPendingMessage =
    paymentInformation?.details?.type === 'liquid' ||
    !!paymentInformation?.details?.swapId ||
    paymentInformation?.details?.type === 'Bitcoin';

  const paymentFee =
    paymentInformation == undefined
      ? 0
      : formmatingType === 'liquidNode'
      ? paymentInformation?.feesSat
      : formmatingType === 'lightningNode'
      ? Math.round(paymentInformation?.payment?.feeMsat / 1000)
      : paymentInformation?.feeSat;
  const paymentNetwork =
    formmatingType === 'liquidNode'
      ? paymentInformation?.details?.type
      : formmatingType === 'lightningNode'
      ? 'Lightning'
      : 'eCash';
  const errorMessage =
    paymentInformation == undefined
      ? 'Error sending payment, no information about the error provided'
      : !didSucceed && formmatingType === 'liquidNode'
      ? JSON.stringify(paymentInformation?.details?.error)
      : formmatingType === 'lightningNode'
      ? JSON.stringify(
          paymentInformation?.reason || paymentInformation?.payment?.error,
        )
      : JSON.stringify(paymentInformation?.details?.error);

  const amount =
    paymentInformation == undefined
      ? 0
      : formmatingType === 'liquidNode'
      ? paymentInformation?.amountSat
      : formmatingType === 'lightningNode'
      ? Math.round(paymentInformation?.payment?.amountMsat / 1000)
      : paymentInformation?.amountSat;
  ``;
  const confirmAnimation = useMemo(() => {
    return updateConfirmAnimation(
      confirmTxAnimation,
      theme ? (darkModeType ? 'lightsOut' : 'dark') : 'light',
    );
  }, [theme, darkModeType]);

  const errorAnimation = useMemo(() => {
    return applyErrorAnimationTheme(
      errorTxAnimation,
      theme ? (darkModeType ? 'lightsOut' : 'dark') : 'light',
    );
  }, [theme, darkModeType]);

  useEffect(() => {
    animationRef.current?.play();
  }, []);

  return (
    <GlobalThemeView
      useStandardWidth={true}
      styles={{
        flex: 1,
        alignItems: 'center',
      }}>
      <LottieView
        ref={animationRef}
        source={didSucceed ? confirmAnimation : errorAnimation}
        loop={false}
        style={{
          width: useWindowDimensions().width / 1.5,
          height: useWindowDimensions().width / 1.5,
        }}
      />
      <ThemeText
        styles={{fontWeight: 400, fontSize: SIZES.large, marginBottom: 10}}
        content={
          !didSucceed
            ? 'Failed to send'
            : `${
                paymentType?.toLowerCase() === 'paymentsucceed'
                  ? 'Sent'
                  : 'Received'
              } succesfully`
        }
      />

      {didSucceed && (
        <View style={{marginBottom: 10}}>
          <FormattedSatText
            styles={{
              fontSize: SIZES.huge,

              includeFontPadding: false,
            }}
            neverHideBalance={true}
            balance={amount}
          />
        </View>
      )}

      <ThemeText
        styles={{
          opacity: 0.6,
          width: '95%',
          maxWidth: 300,
          textAlign: 'center',
          marginBottom: 40,
        }}
        content={
          didSucceed
            ? showPendingMessage
              ? 'Your balance will be updated shortly'
              : ''
            : 'There was an issue sending this payment, please try again.'
        }
      />

      {didSucceed && (
        <View style={styles.paymentTable}>
          <View style={styles.paymentTableRow}>
            <ThemeText content={'Fee'} />
            <FormattedSatText neverHideBalance={true} balance={paymentFee} />
          </View>
          <View style={styles.paymentTableRow}>
            <ThemeText content={'Type'} />
            <ThemeText content={paymentNetwork} />
          </View>
        </View>
      )}
      {!didSucceed && (
        <View
          style={{
            flex: 1,
            backgroundColor: backgroundOffset,
            borderRadius: 8,
            width: '95%',
            maxWidth: 300,
            minHeight: 100,

            color: 'red',
          }}>
          <ScrollView contentContainerStyle={{padding: 10}}>
            <ThemeText content={errorMessage} />
          </ScrollView>
        </View>
      )}
      {!didSucceed && (
        <TouchableOpacity
          onPress={async () => {
            try {
              await openComposer({
                to: 'blake@blitz-wallet.com',
                subject: 'Payment Failed',
                body: errorMessage,
              });
            } catch (err) {
              copyToClipboard('blake@blitz-wallet.com', navigate);
            }
          }}>
          <ThemeText
            styles={{marginTop: 10, marginBottom: 20}}
            content={'Send report to developer'}
          />
        </TouchableOpacity>
      )}

      <CustomButton
        buttonStyles={{
          width: 'auto',
          backgroundColor:
            didSucceed && !theme ? COLORS.primary : COLORS.darkModeText,
          marginTop: 'auto',
          paddingHorizontal: 15,
        }}
        textStyles={{
          ...styles.buttonText,
          color:
            didSucceed && !theme ? COLORS.darkModeText : COLORS.lightModeText,
        }}
        actionFunction={() => {
          console.log('POPPING TO TOP');
          // This will go to whatever the base homsecreen is set to
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              navigate.popToTop();
            });
          });
        }}
        textContent={'Continue'}
      />
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  buttonText: {
    fontFamily: FONT.Descriptoin_Regular,
  },
  paymentConfirmedMessage: {
    width: '90%',
    fontSize: SIZES.medium,

    fontFamily: FONT.Title_Regular,
    textAlign: 'center',
    marginTop: 20,
  },
  lottie: {
    width: 300, // adjust as necessary
    height: 300, // adjust as necessary
  },
  paymentTable: {
    rowGap: 20,
  },
  paymentTableRow: {
    width: 200,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
