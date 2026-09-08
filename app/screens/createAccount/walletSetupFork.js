import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { CENTER, COLORS, PENDING_PARENT_CONTACT_KEY } from '../../constants';
import { INSET_WINDOW_WIDTH, SIZES } from '../../constants/theme';
import { ThemeText } from '../../functions/CustomElements';
import GlobalThemeView from '../../functions/CustomElements/globalThemeView';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import CustomSettingsTopBar from '../../functions/CustomElements/settingsTopBar';
import { crashlyticsLogReport } from '../../functions/crashlyticsLogs';
import { removeLocalStorageItem } from '../../functions';

export default function WalletSetupFork() {
  const navigate = useNavigation();
  const { t } = useTranslation();

  const options = [
    {
      icon: 'Plus',
      title: t('createAccount.walletSetup.createTitle'),
      desc: t('createAccount.walletSetup.createDesc'),
      onPress: () => {
        crashlyticsLogReport('Navigating to disclaimer from wallet setup fork');
        removeLocalStorageItem(PENDING_PARENT_CONTACT_KEY);
        navigate.navigate('DisclaimerPage', { nextPage: 'PinSetup' });
      },
    },
    {
      icon: 'Users',
      title: t('createAccount.walletSetup.joinTitle'),
      desc: t('createAccount.walletSetup.joinDesc'),
      onPress: () => {
        crashlyticsLogReport(
          'Navigating to join managed wallet from wallet setup fork',
        );
        navigate.navigate('ChildClaimStack');
      },
    },
    {
      icon: 'RefreshCw',
      title: t('createAccount.walletSetup.restoreTitle'),
      desc: t('createAccount.walletSetup.restoreDesc'),
      onPress: () => {
        crashlyticsLogReport('Navigating to restore from wallet setup fork');
        removeLocalStorageItem(PENDING_PARENT_CONTACT_KEY);
        navigate.navigate('DisclaimerPage', { nextPage: 'RestoreWallet' });
      },
    },
  ];

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar />
      <View style={styles.content}>
        <ThemeText
          styles={styles.title}
          content={t('createAccount.walletSetup.title')}
        />
        <ThemeText
          styles={styles.subtitle}
          content={t('createAccount.walletSetup.subtitle')}
        />

        <View style={styles.card}>
          {options.map((option, index) => (
            <TouchableOpacity
              key={option.icon}
              onPress={option.onPress}
              activeOpacity={0.7}
              style={[
                styles.row,
                index > 0 && {
                  borderTopWidth: 1,
                  borderTopColor: COLORS.lightModeBackground,
                },
              ]}
            >
              <View style={styles.infoIcon}>
                <ThemeIcon
                  iconName={option.icon}
                  size={20}
                  colorOverride={COLORS.primary}
                />
              </View>
              <View style={styles.rowText}>
                <ThemeText styles={styles.rowTitle} content={option.title} />
                <ThemeText styles={styles.rowDesc} content={option.desc} />
              </View>
              <ThemeIcon
                iconName={'ChevronRight'}
                size={20}
                colorOverride={COLORS.primary}
              />
            </TouchableOpacity>
          ))}
        </View>
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
  card: {
    width: '100%',
    marginTop: 24,
    borderRadius: 24,
    backgroundColor: COLORS.lightModeBackgroundOffset,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  rowText: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    fontSize: SIZES.smedium,
    fontWeight: '500',
    color: COLORS.lightModeText,
    includeFontPadding: false,
  },
  rowDesc: {
    fontSize: SIZES.small,
    opacity: 0.65,
    includeFontPadding: false,
  },
  infoIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
