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
import { useCallback, useMemo } from 'react';
import { getConfirmTxAnimation } from '../../../../../../functions/lottieAnimations';
import { useGlobalThemeContext } from '../../../../../../../context-store/theme';
import LottieView from 'lottie-react-native';
import CustomSettingsTopBar from '../../../../../../functions/CustomElements/settingsTopBar';
import useHandleBackPressNew from '../../../../../../hooks/useHandleBackPressNew';

export default function ChildLinkSuccess() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { resetSession } = useChildPairing();

  const handleDone = useCallback(() => {
    resetSession();
    navigate.popTo('SettingsContentHome', {
      for: 'Accounts',
      initialTab: 'linked',
    });
    return true;
  }, []);

  const confirmAnimation = getConfirmTxAnimation(theme, darkModeType);

  useHandleBackPressNew(handleDone);

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
          content={t('settings.childAccounts.pairing.linkedTitle')}
        />
        <ThemeText
          styles={styles.subtitle}
          content={t('settings.childAccounts.pairing.linkedSubtitle')}
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
