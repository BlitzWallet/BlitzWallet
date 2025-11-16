import { StyleSheet, View, TouchableOpacity, ScrollView } from 'react-native';
import { CENTER, COLORS, FONT, SIZES } from '../../constants';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useMemo, useRef } from 'react';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import CustomButton from '../../functions/CustomElements/button';
import LottieView from 'lottie-react-native';
import FormattedSatText from '../../functions/CustomElements/satTextDisplay';
import { copyToClipboard } from '../../functions';
import GetThemeColors from '../../hooks/themeColors';
import { openComposer } from 'react-native-email-link';
import { useGlobalThemeContext } from '../../../context-store/theme';
import {
  applyErrorAnimationTheme,
  updateConfirmAnimation,
} from '../../functions/lottieViewColorTransformer';
import { useToast } from '../../../context-store/toastManager';
import { useSparkWallet } from '../../../context-store/sparkContext';
import formatTokensNumber from '../../functions/lrc20/formatTokensBalance';
import { useTranslation } from 'react-i18next';
import { useAppStatus } from '../../../context-store/appStatus';
import DropdownMenu from '../../functions/CustomElements/dropdownMenu';
import displayCorrectDenomination from '../../functions/displayCorrectDenomination';
import { useGlobalContextProvider } from '../../../context-store/context';
import { useNodeContext } from '../../../context-store/nodeContext';

const confirmTxAnimation = require('../../assets/confirmTxAnimation.json');
const errorTxAnimation = require('../../assets/errorTxAnimation.json');
export default function ConfirmTxPage(props) {
  const { sparkInformation } = useSparkWallet();
  const { screenDimensions } = useAppStatus();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const navigate = useNavigation();
  const { showToast } = useToast();
  const { backgroundOffset } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const animationRef = useRef(null);
  const { t } = useTranslation();
  const isLNURLAuth = props.route.params?.useLNURLAuth;
  const transaction = props.route.params?.transaction;
  const hasError = props.route.params?.error;
  const paymentInformation = transaction?.details;

  const didSucceed = !hasError || isLNURLAuth;

  const paymentNetwork = paymentInformation?.sendingUUID
    ? t('screens.inAccount.expandedTxPage.contactPaymentType')
    : transaction?.paymentType;

  const showPendingMessage = transaction?.paymentStatus === 'pending';

  const paymentFee = paymentInformation?.fee;

  const errorMessage = hasError;

  const amount = paymentInformation?.amount || 0;

  const isLRC20Payment = paymentInformation?.isLRC20Payment;
  const token = isLRC20Payment
    ? sparkInformation.tokens?.[transaction.details.LRC20Token]
    : '';

  const formattedTokensBalance = formatTokensNumber(
    amount,
    token?.tokenMetadata?.decimals,
  );

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
    <GlobalThemeView useStandardWidth={true} styles={styles.globalConatianer}>
      <LottieView
        ref={animationRef}
        source={didSucceed ? confirmAnimation : errorAnimation}
        loop={false}
        style={{
          width: screenDimensions.width / 1.5,
          height: screenDimensions.width / 1.5,
          maxWidth: 400,
          maxHeight: 400,
        }}
      />
      {!isLNURLAuth && (
        <ThemeText
          styles={{ fontSize: SIZES.large, marginBottom: 10 }}
          content={
            !didSucceed
              ? t('screens.inAccount.confirmTxPage.failedToSend')
              : t('screens.inAccount.confirmTxPage.confirmMessage', {
                  context:
                    paymentInformation.direction?.toLowerCase() === 'outgoing'
                      ? 'sent'
                      : 'received',
                })
          }
        />
      )}

      {didSucceed && !isLNURLAuth && (
        <View style={{ marginBottom: 10 }}>
          <FormattedSatText
            styles={{
              fontSize: SIZES.huge,
              includeFontPadding: false,
            }}
            neverHideBalance={true}
            balance={isLRC20Payment ? formattedTokensBalance : amount}
            useCustomLabel={isLRC20Payment}
            customLabel={token?.tokenMetadata?.tokenTicker}
            useMillionDenomination={true}
          />
          {/* {isLRC20Payment && formattedTokensBalance < 1 && (
            <FormattedSatText
              containerStyles={{
                ...CENTER,
              }}
              styles={{
                fontSize: SIZES.small,
                includeFontPadding: false,
              }}
              neverHideBalance={true}
              balance={formatTokensNumber(
                amount,
                token?.tokenMetadata?.decimals,
              )}
              useCustomLabel={isLRC20Payment}
              customLabel={token?.tokenMetadata?.tokenTicker}
            />
          )} */}
        </View>
      )}

      {isLNURLAuth && (
        <ThemeText
          styles={{
            width: '95%',
            maxWidth: 300,
            textAlign: 'center',
            marginBottom: 40,
          }}
          content={t('screens.inAccount.confirmTxPage.lnurlAuthSuccess')}
        />
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
            ? ''
            : t('screens.inAccount.confirmTxPage.paymentErrorMessage')
        }
      />

      {didSucceed && !isLNURLAuth && (
        <View style={styles.paymentTable}>
          <View style={styles.paymentTableRow}>
            <ThemeText
              CustomNumberOfLines={1}
              styles={styles.labelText}
              content={t('constants.fee')}
            />
            <ThemeText
              content={displayCorrectDenomination({
                amount: paymentFee,
                masterInfoObject,
                fiatStats,
              })}
            />
          </View>
          <View style={styles.paymentTableRow}>
            <ThemeText
              CustomNumberOfLines={1}
              styles={styles.labelText}
              content={t('constants.type')}
            />
            <ThemeText content={paymentNetwork} />
          </View>
        </View>
      )}
      {!didSucceed && !isLNURLAuth && (
        <View
          style={{
            flex: 1,
            backgroundColor: backgroundOffset,
            borderRadius: 8,
            width: '95%',
            maxWidth: 300,
            minHeight: 100,
          }}
        >
          <ScrollView contentContainerStyle={{ padding: 10 }}>
            <ThemeText content={errorMessage} />
          </ScrollView>
        </View>
      )}
      {!didSucceed && !isLNURLAuth && (
        <View style={{ marginTop: 10, marginBottom: 20 }}>
          <DropdownMenu
            options={[
              {
                label: t('screens.inAccount.confirmTxPage.emailReport'),
                value: 'email',
              },
              {
                label: t('screens.inAccount.confirmTxPage.copyReport'),
                value: 'clipboard',
              },
            ]}
            selectedValue=""
            placeholder={t('screens.inAccount.confirmTxPage.sendReport')}
            onSelect={async item => {
              if (item.value === 'email') {
                try {
                  await openComposer({
                    to: 'blake@blitzwalletapp.com',
                    subject: 'Payment Failed',
                    body: String(errorMessage),
                  });
                } catch (err) {
                  console.log('Email composer error:', err);
                }
              } else if (item.value === 'clipboard') {
                copyToClipboard(String(errorMessage), showToast);
              }
            }}
            showClearIcon={false}
            showVerticalArrows={false}
            translateLabelText={false}
            customButtonStyles={{
              backgroundColor: 'transparent',
            }}
            textStyles={{
              ...CENTER,
              textDecorationLine: 'underline',
            }}
          />
        </View>
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
          // This will go to whatever the base homsecreen is set to
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              navigate.popToTop();
            });
          });
        }}
        textContent={t('constants.continue')}
      />
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  globalConatianer: {
    flex: 1,
    alignItems: 'center',
  },
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
    width: '100%',
    minWidth: 200,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  labelText: {
    flexShrink: 1,
    marginRight: 5,
  },
});
