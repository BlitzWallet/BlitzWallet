import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { GlobalThemeView, ThemeText } from '../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../functions/CustomElements/settingsTopBar';
import ThemeIcon from '../../../functions/CustomElements/themeIcon';
import CustomButton from '../../../functions/CustomElements/button';
import { CENTER, CONTENT_KEYBOARD_OFFSET } from '../../../constants';
import { COLORS, INSET_WINDOW_WIDTH, SIZES } from '../../../constants/theme';
import GetThemeColors from '../../../hooks/themeColors';

export default function ChildClaimInfo() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { backgroundOffset, backgroundColor } = GetThemeColors();

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar />
      <View style={styles.content}>
        <ThemeText
          styles={styles.title}
          content={t('settings.childAccounts.claim.info.title')}
        />
        <ThemeText
          styles={styles.subtitle}
          content={t('settings.childAccounts.claim.info.intro')}
        />

        <View style={[styles.card, { backgroundColor: backgroundOffset }]}>
          {[
            {
              icon: 'KeyRound',
              label: t('settings.childAccounts.claim.info.row1Label'),
              desc: t('settings.childAccounts.claim.info.row1Description'),
            },
            {
              icon: 'Wallet',
              label: t('settings.childAccounts.claim.info.row2Label'),
              desc: t('settings.childAccounts.claim.info.row2Description'),
            },
            {
              icon: 'TriangleAlert',
              label: t('settings.childAccounts.claim.info.row3Label'),
              desc: t('settings.childAccounts.claim.info.row3Description'),
            },
          ].map(({ icon, label, desc }, index) => (
            <View
              key={icon}
              style={[
                styles.infoRow,
                index > 0 && {
                  borderTopWidth: 1,
                  borderTopColor: backgroundColor,
                },
              ]}
            >
              <View style={styles.infoIcon}>
                <ThemeIcon
                  size={20}
                  iconName={icon}
                  // colorOverride={COLORS.darkModeText}
                />
              </View>
              <View style={styles.infoText}>
                <ThemeText styles={styles.infoLabel} content={label} />
                <ThemeText styles={styles.infoDesc} content={desc} />
              </View>
            </View>
          ))}
        </View>

        <CustomButton
          buttonStyles={styles.button}
          textContent={t('settings.childAccounts.claim.info.continue')}
          actionFunction={() => navigate.navigate('ChildEnterCode')}
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
    marginBottom: 32,
  },
  bullets: {
    gap: 22,
    marginTop: 20,
    marginBottom: 'auto',
  },
  button: {
    width: '100%',
    marginTop: CONTENT_KEYBOARD_OFFSET,
    ...CENTER,
  },
  card: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 'auto',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  infoIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    // backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoText: {
    flex: 1,
    gap: 3,
  },
  infoLabel: {
    fontSize: SIZES.smedium,
    fontWeight: '500',
    includeFontPadding: false,
  },
  infoDesc: {
    fontSize: SIZES.small,
    opacity: 0.65,
    includeFontPadding: false,
  },
});
