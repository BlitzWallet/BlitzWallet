import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../../functions/CustomElements/settingsTopBar';
import CustomButton from '../../../../../../functions/CustomElements/button';
import { CENTER } from '../../../../../../constants';
import { INSET_WINDOW_WIDTH, SIZES } from '../../../../../../constants/theme';
import GetThemeColors from '../../../../../../hooks/themeColors';
import { useChildPairing } from '../../../../../../../context-store/childPairingContext';

export default function ChildLinkCode(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { backgroundOffset } = GetThemeColors();
  const { parentUniqueName, startPairing } = useChildPairing();
  const reshareChild = props?.route?.params?.reshareChild ?? null;

  const generateCode = () => {
    // startPairing guards double-start, so re-pressing after returning from the
    // code screen is a no-op while a session is live.
    startPairing(reshareChild);
    navigate.navigate('ChildShareCode');
  };

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar label={t('settings.childAccounts.pairing.title')} />
      <View style={styles.content}>
        <ThemeText
          styles={styles.title}
          content={t('settings.childAccounts.pairing.usernameTitle')}
        />
        <ThemeText
          styles={styles.subtitle}
          content={t('settings.childAccounts.pairing.usernameSubtitle')}
        />
        <View style={[styles.card, { backgroundColor: backgroundOffset }]}>
          <ThemeText styles={styles.usernameValue} content={parentUniqueName} />
        </View>
      </View>
      <CustomButton
        buttonStyles={styles.button}
        textContent={t('settings.childAccounts.pairing.generateCode')}
        actionFunction={generateCode}
      />
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  title: {
    fontSize: SIZES.large,
    fontWeight: '500',
    includeFontPadding: false,
    marginTop: 28,
    marginBottom: 8,
  },
  subtitle: {
    opacity: 0.6,
    fontSize: SIZES.smedium,
    lineHeight: 22,
    marginBottom: 20,
  },
  card: {
    borderRadius: 16,
    paddingVertical: 40,
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  usernameValue: {
    fontSize: SIZES.xxLarge,
    includeFontPadding: false,
    textAlign: 'center',
  },
  button: { width: INSET_WINDOW_WIDTH, ...CENTER, marginTop: 'auto' },
});