import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { updateConfirmAnimation } from '../../../../../functions/lottieViewColorTransformer';
import LottieView from 'lottie-react-native';
import { ThemeText } from '../../../../../functions/CustomElements';
import GetThemeColors from '../../../../../hooks/themeColors';
import { useNavigation } from '@react-navigation/native';
import { INSET_WINDOW_WIDTH, SIZES } from '../../../../../constants/theme';
import { useTranslation } from 'react-i18next';
import { parsePhoneNumberWithError } from 'libphonenumber-js';
import { useToast } from '../../../../../../context-store/toastManager';
import { copyToClipboard } from '../../../../../functions';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
const confirmTxAnimation = require('../../../../../assets/confirmTxAnimation.json');

export default function ConfirmSMSReceivePage(props) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const animationRef = useRef(null);
  const { backgroundOffset, transparentOveraly } = GetThemeColors();
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [contentHeight, setContentHeight] = useState(0);

  const didSucceed = props.route.params?.didSucceed;
  const isRefund = props.route.params?.isRefund;
  const number = props.route.params?.number;

  const formatPhoneNumber = useCallback(number => {
    if (!number) return '';
    try {
      return parsePhoneNumberWithError('+' + number).formatInternational();
    } catch (error) {
      console.warn('Phone formatting error:', error);
      return number;
    }
  }, []);

  const confirmAnimation = useMemo(() => {
    return updateConfirmAnimation(
      confirmTxAnimation,
      theme ? (darkModeType ? 'lightsOut' : 'dark') : 'light',
    );
  }, [theme, darkModeType]);

  useEffect(() => {
    animationRef.current?.play();
  }, []);

  const handleContentLayout = event => {
    const { height } = event.nativeEvent.layout;
    setContentHeight(height);
  };

  return (
    <View style={[styles.container, { backgroundColor: transparentOveraly }]}>
      <View
        style={[
          styles.contentWrapper,
          {
            backgroundColor: backgroundOffset,
            height: contentHeight > 0 ? contentHeight + 100 : 'auto',
          },
        ]}
      >
        <TouchableOpacity style={styles.backBTN} onPress={navigate.goBack}>
          <ThemeIcon iconName={'X'} />
        </TouchableOpacity>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          showsVerticalScrollIndicator={false}
        >
          <View onLayout={handleContentLayout}>
            {/* Animation Section */}
            <View style={styles.animationContainer}>
              <LottieView
                ref={animationRef}
                source={confirmAnimation}
                loop={false}
                style={styles.animation}
              />
            </View>
            {/* Instructions Section */}
            <View
              style={{
                width: isRefund ? '90%' : '100%',
              }}
            >
              <ThemeText
                content={
                  isRefund
                    ? didSucceed
                      ? t('apps.sms4sats.confirmCodePage.automaticRefund')
                      : t('apps.sms4sats.confirmCodePage.waitedRefund')
                    : t('apps.sms4sats.confirmCodePage.header')
                }
                styles={styles.introText}
              />
              {!isRefund && (
                <>
                  <ThemeText
                    content={t(
                      'apps.sms4sats.confirmCodePage.phoneNumberLabel',
                    )}
                    styles={styles.phoneNumberLabel}
                  />
                  <TouchableOpacity
                    onPress={() => copyToClipboard(number, showToast)}
                    style={styles.phoneNumberContainer}
                  >
                    <ThemeText
                      content={formatPhoneNumber(number)}
                      styles={styles.phoneNumber}
                    />
                  </TouchableOpacity>
                  <View style={styles.instructionStep}>
                    <ThemeText
                      content={t('apps.sms4sats.confirmCodePage.step1')}
                      styles={styles.instructionText}
                    />
                  </View>
                  <View style={styles.instructionStep}>
                    <ThemeText
                      content={t('apps.sms4sats.confirmCodePage.step2')}
                      styles={styles.instructionText}
                    />
                  </View>
                  <View style={styles.instructionStep}>
                    <ThemeText
                      content={t('apps.sms4sats.confirmCodePage.step3')}
                      styles={styles.instructionText}
                    />
                  </View>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBTN: {
    alignSelf: 'flex-end',
  },
  contentWrapper: {
    maxWidth: INSET_WINDOW_WIDTH,
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    maxHeight: '80%',
  },
  animationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
  },
  animation: {
    width: 150,
    height: 150,
  },
  instructionsContainer: {
    width: '90%',
  },
  introText: {
    textAlign: 'center',
    marginBottom: 20,
  },
  instructionStep: {
    marginBottom: 16,
    paddingHorizontal: 15,
  },
  instructionText: {
    includeFontPadding: false,
  },
  phoneNumberLabel: {
    width: '100%',
    includeFontPadding: false,
    textAlign: 'center',
    alignSelf: 'center',
  },
  phoneNumber: {
    width: '100%',
    includeFontPadding: false,
    textAlign: 'center',
    alignSelf: 'center',
    fontSize: SIZES.xLarge,
  },
  phoneNumberContainer: {
    marginBottom: 20,
  },
});
