import { ScrollView, StyleSheet, View } from 'react-native';
import LottieView from 'lottie-react-native';
import CustomButton from '../../../../../functions/CustomElements/button';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import { SIZES } from '../../../../../constants';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useMemo, useRef } from 'react';
import { getErrorTxAnimation } from '../../../../../functions/lottieAnimations';
import { useTranslation } from 'react-i18next';
import { FONT, INSET_WINDOW_WIDTH } from '../../../../../constants/theme';

export default function ErrorWithPayment({ reason }) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const navigate = useNavigation();
  const animationRef = useRef(null);
  const { t } = useTranslation();

  const errorAnimation = getErrorTxAnimation(theme, darkModeType);

  useEffect(() => {
    animationRef.current?.play();
  }, []);
  return (
    <GlobalThemeView styles={styles.container} useStandardWidth={true}>
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
        <ScrollView
          style={styles.errorScroll}
          contentContainerStyle={styles.errorScrollContent}
        >
          <ThemeText styles={styles.errorText} content={String(reason)} />
        </ScrollView>
      </View>
      <CustomButton
        buttonStyles={styles.buttonStyle}
        textContent={t('constants.continue')}
        actionFunction={() => {
          navigate.popTo('HomeAdmin', { screen: 'Home' });
        }}
      />
    </GlobalThemeView>
  );
}
const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonStyle: {
    marginTop: 'auto',
    width: INSET_WINDOW_WIDTH,
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
    width: INSET_WINDOW_WIDTH,
    maxHeight: 250,
    flexShrink: 1,
    marginBottom: 40,
  },
  errorScrollContent: {
    flexGrow: 0,
  },
  errorText: {
    opacity: 0.6,
    textAlign: 'center',
  },
});
