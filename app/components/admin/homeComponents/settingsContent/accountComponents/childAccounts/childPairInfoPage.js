import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../../functions/CustomElements/settingsTopBar';
import ThemeIcon from '../../../../../../functions/CustomElements/themeIcon';
import CustomButton from '../../../../../../functions/CustomElements/button';
import { CENTER, CONTENT_KEYBOARD_OFFSET } from '../../../../../../constants';
import { INSET_WINDOW_WIDTH, SIZES } from '../../../../../../constants/theme';
import GetThemeColors from '../../../../../../hooks/themeColors';
import { useChildPairing } from '../../../../../../../context-store/childPairingContext';

export default function ChildPairInfoPage(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { backgroundOffset } = GetThemeColors();
  const { startPairing } = useChildPairing();

  const reshareChild = props?.route?.params?.reshareChild ?? null;

  const bullets = [
    { icon: 'Check', text: t('settings.childAccounts.pairing.info.bullet1') },
    { icon: 'Info', text: t('settings.childAccounts.pairing.info.bullet2') },
    {
      icon: 'TriangleAlert',
      text: t('settings.childAccounts.pairing.info.bullet3'),
    },
  ];

  const handleContinue = () => {
    startPairing(reshareChild);
    navigate.navigate('ChildLinkCode');
  };

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        label={t('settings.childAccounts.pairing.info.navTitle')}
      />
      <View style={styles.content}>
        <ThemeText
          styles={styles.title}
          content={t('settings.childAccounts.pairing.info.title')}
        />
        <ThemeText
          styles={styles.subtitle}
          content={t('settings.childAccounts.pairing.info.intro')}
        />
        <View style={styles.bullets}>
          {bullets.map(({ icon, text }) => (
            <View key={icon} style={styles.bulletRow}>
              <View
                style={[
                  styles.bulletIcon,
                  { backgroundColor: backgroundOffset },
                ]}
              >
                <ThemeIcon iconName={icon} size={20} />
              </View>
              <ThemeText styles={styles.bulletText} content={text} />
            </View>
          ))}
        </View>
        <CustomButton
          buttonStyles={styles.button}
          textContent={t('settings.childAccounts.pairing.info.continue')}
          actionFunction={handleContinue}
        />
      </View>
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
  bullets: {
    gap: 22,
    marginTop: 20,
    marginBottom: 'auto',
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 15,
  },
  bulletIcon: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletText: {
    flex: 1,
    paddingTop: 8,
    lineHeight: 21,
  },
  button: {
    width: '100%',
    marginTop: CONTENT_KEYBOARD_OFFSET,
    ...CENTER,
  },
});
