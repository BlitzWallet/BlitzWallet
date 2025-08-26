import {useEffect, useMemo, useRef} from 'react';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import {updateConfirmAnimation} from '../../../../../functions/lottieViewColorTransformer';
import LottieView from 'lottie-react-native';
import {COLORS, ICONS} from '../../../../../constants';
import {ThemeText} from '../../../../../functions/CustomElements';
import GetThemeColors from '../../../../../hooks/themeColors';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import {useNavigation} from '@react-navigation/native';
import {INSET_WINDOW_WIDTH} from '../../../../../constants/theme';
import {useTranslation} from 'react-i18next';

const confirmTxAnimation = require('../../../../../assets/confirmTxAnimation.json');

export default function ConfirmSMSReceivePage() {
  const {theme, darkModeType} = useGlobalThemeContext();
  const animationRef = useRef(null);
  const {backgroundOffset} = GetThemeColors();
  const navigate = useNavigation();
  const {t} = useTranslation();

  const confirmAnimation = useMemo(() => {
    return updateConfirmAnimation(
      confirmTxAnimation,
      theme ? (darkModeType ? 'lightsOut' : 'dark') : 'light',
    );
  }, [theme, darkModeType]);

  useEffect(() => {
    animationRef.current?.play();
  }, []);

  return (
    <View style={styles.container}>
      <View
        style={[styles.contentWrapper, {backgroundColor: backgroundOffset}]}>
        <TouchableOpacity style={styles.backBTN} onPress={navigate.goBack}>
          <ThemeImage
            lightModeIcon={ICONS.xSmallIcon}
            darkModeIcon={ICONS.xSmallIcon}
            lightsOutIcon={ICONS.xSmallIconWhite}
          />
        </TouchableOpacity>
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
        <View style={styles.instructionsContainer}>
          <ThemeText
            content={t('apps.sms4sats.confirmCodePage.header')}
            styles={styles.introText}
          />

          <View style={styles.instructionStep}>
            <ThemeText
              content={t('apps.sms4sats.confirmCodePage.step1')}
              style={styles.instructionText}
            />
          </View>

          <View style={styles.instructionStep}>
            <ThemeText
              content={t('apps.sms4sats.confirmCodePage.step2')}
              style={styles.instructionText}
            />
          </View>

          <View style={styles.instructionStep}>
            <ThemeText
              content={t('apps.sms4sats.confirmCodePage.step3')}
              style={styles.instructionText}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.halfModalBackgroundColor,
  },
  backBTN: {
    alignSelf: 'flex-end',
  },
  contentWrapper: {
    maxWidth: INSET_WINDOW_WIDTH,
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
  },
  animationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  animation: {
    width: 150,
    height: 150,
  },

  instructionsContainer: {
    width: '100%',
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
});
