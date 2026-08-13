import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../../functions/CustomElements';
import CustomButton from '../../../../../../functions/CustomElements/button';
import { CENTER, CONTENT_KEYBOARD_OFFSET } from '../../../../../../constants';
import {
  FONT,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../../../constants/theme';
import { useChildPairing } from '../../../../../../../context-store/childPairingContext';
import { useMemo } from 'react';
import { applyErrorAnimationTheme } from '../../../../../../functions/lottieViewColorTransformer';
import { useGlobalThemeContext } from '../../../../../../../context-store/theme';
import LottieView from 'lottie-react-native';
import CustomSettingsTopBar from '../../../../../../functions/CustomElements/settingsTopBar';

const confirmTxAnimation = require('../../../../../../assets/errorTxAnimation.json');

export default function ChildLinkError() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { resetSession, status, errorMessage } = useChildPairing();

  const handleDone = () => {
    resetSession();
    navigate.popTo('EditAccountPage', undefined, { merge: true });
  };

  const confirmAnimation = useMemo(() => {
    return applyErrorAnimationTheme(
      confirmTxAnimation,
      theme ? (darkModeType ? 'lightsOut' : 'dark') : 'light',
    );
  }, [theme, darkModeType]);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar customBackFunction={handleDone} />
      <View style={styles.centered}>
        <LottieView
          source={confirmAnimation}
          autoPlay={true}
          loop={false}
          style={{
            width: 125,
            height: 125,
          }}
        />
        <ThemeText
          styles={styles.title}
          content={t('settings.childAccounts.pairing.errorTitle')}
        />
        <ThemeText
          styles={styles.subtitle}
          content={
            errorMessage ||
            t(
              status === 'expired'
                ? 'settings.childAccounts.pairing.expired'
                : 'settings.childAccounts.creating.errorTitle',
            )
          }
        />
      </View>
      <CustomButton
        buttonStyles={styles.button}
        textContent={t('settings.childAccounts.confirmation.done')}
        actionFunction={handleDone}
      />
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: FONT.Title_Medium,
    fontSize: SIZES.large,
    width: '95%',
    textAlign: 'center',

    marginBottom: 10,
  },
  subtitle: {
    opacity: 0.6,
    width: '95%',
    maxWidth: 300,
    textAlign: 'center',
  },
  button: {
    width: INSET_WINDOW_WIDTH,
    marginBottom: CONTENT_KEYBOARD_OFFSET,
    ...CENTER,
  },
});
