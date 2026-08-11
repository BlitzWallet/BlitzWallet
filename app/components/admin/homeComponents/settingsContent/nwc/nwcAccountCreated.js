import { StyleSheet, View } from 'react-native';
import { useEffect, useMemo, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import LottieView from 'lottie-react-native';
import { useTranslation } from 'react-i18next';
import { GlobalThemeView, ThemeText } from '../../../../../functions/CustomElements';
import CustomButton from '../../../../../functions/CustomElements/button';
import { copyToClipboard } from '../../../../../functions';
import { COLORS, FONT, SIZES } from '../../../../../constants';
import { INSET_WINDOW_WIDTH } from '../../../../../constants/theme';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { useToast } from '../../../../../../context-store/toastManager';
import GetThemeColors from '../../../../../hooks/themeColors';
import { updateConfirmAnimation } from '../../../../../functions/lottieViewColorTransformer';

const confirmTxAnimation = require('../../../../../assets/confirmTxAnimation.json');

export default function NWCAccountCreated(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { textColor } = GetThemeColors();
  const animationRef = useRef(null);
  const connectionString = props.route.params?.connectionString;

  const confirmAnimation = useMemo(
    () =>
      updateConfirmAnimation(
        confirmTxAnimation,
        theme ? (darkModeType ? 'lightsOut' : 'dark') : 'light',
      ),
    [theme, darkModeType],
  );

  useEffect(() => {
    animationRef.current?.play();
  }, []);

  return (
    <GlobalThemeView useStandardWidth={true} styles={styles.globalContainer}>
      <View style={styles.contentContainer}>
        <LottieView
          ref={animationRef}
          source={confirmAnimation}
          loop={false}
          style={{ width: 125, height: 125 }}
        />
        <ThemeText
          styles={styles.title}
          content={t('settings.nwc.accountCreated.title')}
        />
        <ThemeText
          styles={styles.subtitle}
          content={t('settings.nwc.accountCreated.subtitle')}
        />
      </View>

      <CustomButton
        buttonStyles={{
          width: INSET_WINDOW_WIDTH,
          backgroundColor: !theme ? COLORS.primary : COLORS.darkModeText,
          marginTop: 'auto',
          paddingHorizontal: 15,
        }}
        textStyles={{
          ...styles.buttonText,
          color: !theme ? COLORS.darkModeText : COLORS.lightModeText,
        }}
        actionFunction={() => navigate.popTo('NosterWalletConnect')}
        textContent={t('constants.done')}
      />
      <CustomButton
        textStyles={{ color: textColor }}
        buttonStyles={{
          width: INSET_WINDOW_WIDTH,
          paddingHorizontal: 15,
          backgroundColor: 'unset',
        }}
        actionFunction={() => copyToClipboard(connectionString, showToast)}
        textContent={t('settings.nwc.accountCreated.copyConnection')}
      />
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  globalContainer: { flex: 1, alignItems: 'center' },
  contentContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontFamily: FONT.Title_Medium,
    fontSize: SIZES.large,
    width: '95%',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  subtitle: {
    opacity: 0.6,
    width: '95%',
    maxWidth: 300,
    textAlign: 'center',
    marginBottom: 40,
  },
  buttonText: { fontFamily: FONT.Descriptoin_Regular },
});
