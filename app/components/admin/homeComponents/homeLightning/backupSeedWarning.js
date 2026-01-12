import { useNavigation } from '@react-navigation/native';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';
import { COLORS, SIZES } from '../../../../constants';
import { ThemeText } from '../../../../functions/CustomElements';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import CustomButton from '../../../../functions/CustomElements/button';
import GetThemeColors from '../../../../hooks/themeColors';
import { useTranslation } from 'react-i18next';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';

export default function BackupSeedWarning() {
  const { t } = useTranslation();
  const navigate = useNavigation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor, textColor, transparentOveraly } =
    GetThemeColors();

  const navigateToSettings = () => {
    navigate.reset({
      index: 0,
      routes: [
        {
          name: 'HomeAdmin',
          params: { screen: 'Home' },
        },
        {
          name: 'SettingsHome',
        },
        {
          name: 'SettingsContentHome',
          params: {
            for: 'Backup wallet',
          },
        },
      ],
    });
  };
  return (
    <View style={[styles.overlay, { backgroundColor: transparentOveraly }]}>
      <View
        style={[
          styles.card,
          { backgroundColor: theme ? backgroundOffset : COLORS.darkModeText },
        ]}
      >
        <View style={styles.iconContainer}>
          <ThemeIcon size={45} iconName={'AlertTriangle'} />
        </View>

        <ThemeText
          styles={styles.header}
          content={t('wallet.homeLightning.backupSeedWarning.header')}
        />

        <ThemeText
          styles={styles.description}
          content={t('wallet.homeLightning.backupSeedWarning.description')}
        />

        <CustomButton
          actionFunction={navigateToSettings}
          buttonStyles={{
            ...styles.button,
            backgroundColor: theme ? backgroundColor : COLORS.primary,
          }}
          textStyles={{ color: theme ? textColor : COLORS.darkModeText }}
          textContent={t('wallet.homeLightning.backupSeedWarning.backupBTN')}
        />

        <CustomButton
          actionFunction={navigate.goBack}
          buttonStyles={{
            ...styles.dismissButton,
            backgroundColor: 'transparent',
          }}
          textStyles={{ color: textColor }}
          textContent={t('wallet.homeLightning.backupSeedWarning.laterBTN')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  warningIcon: {
    width: 45,
    height: 45,
  },

  card: {
    borderRadius: 20,
    padding: 24,
    maxWidth: 400,
    width: '90%',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 48,
  },
  header: {
    fontSize: SIZES.large,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    lineHeight: 22,
    opacity: 0.7,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    paddingVertical: 8,
    alignItems: 'center',
    marginBottom: 12,
  },

  dismissButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
});
