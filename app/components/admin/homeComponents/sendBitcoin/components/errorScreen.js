import { StyleSheet, useWindowDimensions, View } from 'react-native';
import CustomScrollView from '../../../../../functions/CustomElements/scrollView';
import LottieView from 'lottie-react-native';
import CustomButton from '../../../../../functions/CustomElements/button';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import { CENTER, MAX_WEB_CONTENT_WIDTH, SIZES } from '../../../../../constants';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef } from 'react';
import { getErrorTxAnimation } from '../../../../../functions/lottieAnimations';
import { useTranslation } from 'react-i18next';
import { FONT } from '../../../../../constants/theme';
import GetThemeColors from '../../../../../hooks/themeColors';

export default function ErrorWithPayment({ reason, onContinue }) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const navigate = useNavigation();
  const animationRef = useRef(null);
  const { t } = useTranslation();
  const { tokens } = GetThemeColors();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const errorAnimation = getErrorTxAnimation(theme, darkModeType);

  useEffect(() => {
    animationRef.current?.play();
  }, []);
  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <View style={styles.contentContainer}>
          <LottieView
            ref={animationRef}
            source={errorAnimation}
            loop={false}
            style={{
              width: 125,
              height: 125,
            }}
          />
          <ThemeText
            styles={styles.title}
            content={t('wallet.sendPages.errorScreen.title')}
          />
          <CustomScrollView
            style={styles.errorScroll}
            contentContainerStyle={styles.errorScrollContent}
          >
            <ThemeText
              styles={[styles.errorText, { color: tokens.muted }]}
              content={String(reason)}
            />
          </CustomScrollView>
        </View>

        <CustomButton
          buttonStyles={styles.buttonStyle}
          textContent={t('constants.continue')}
          actionFunction={() => {
            if (onContinue) return onContinue();
            navigate.popTo('HomeAdmin', { screen: 'Home' });
          }}
          size={'regular'}
        />
      </View>
    </GlobalThemeView>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonStyle: {
    marginTop: 'auto',
  },
  title: {
    fontFamily: FONT.Title_Medium,
    fontSize: SIZES.large,
    width: '95%',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  errorScroll: {
    maxHeight: 250,
    flexShrink: 1,
    marginBottom: 40,
  },
  errorScrollContent: {
    flexGrow: 0,
  },
  errorText: {
    textAlign: 'center',
  },
});
