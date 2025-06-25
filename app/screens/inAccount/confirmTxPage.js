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
import {
  applyErrorAnimationTheme,
  updateConfirmAnimation,
} from '../../functions/lottieViewColorTransformer';

const confirmTxAnimation = require('../../assets/confirmTxAnimation.json');
const errorTxAnimation = require('../../assets/errorTxAnimation.json');
export default function ConfirmTxPage(props) {
  const navigate = useNavigation();

  const {backgroundOffset} = GetThemeColors();
  const {theme, darkModeType} = useGlobalThemeContext();
  const animationRef = useRef(null);

  const transaction = props.route.params?.transaction;
  const hasError = props.route.params?.error;
  const paymentInformation = transaction?.details;

  const didSucceed = !hasError;

  const paymentNetwork = transaction?.paymentType;

  const showPendingMessage = transaction?.paymentStatus === 'pending';

  const paymentFee = paymentInformation?.fee;

  const errorMessage = hasError;

  const amount = paymentInformation?.amount || 0;

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
                paymentInformation.direction?.toLowerCase() === 'outgoing'
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
