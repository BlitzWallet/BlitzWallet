import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemeText } from '../../../../functions/CustomElements';
import { COLORS, INSET_WINDOW_WIDTH, SIZES } from '../../../../constants/theme';
import { CENTER } from '../../../../constants';
import GetThemeColors from '../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';

const SettingsSection = ({ children, style }) => (
  <View style={[styles.section, style]}>{children}</View>
);

export default function NostrHome() {
  const navigate = useNavigation();
  const { darkModeType, theme } = useGlobalThemeContext();
  const { backgroundOffset } = GetThemeColors();
  const { t } = useTranslation();

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.innerContainer}
      contentContainerStyle={styles.scrollContent}
    >
      <SettingsSection>
        <TouchableOpacity
          onPress={() => navigate.navigate('Nip5VerificationPage')}
          style={[styles.sectionContent, { backgroundColor: backgroundOffset }]}
        >
          <View style={styles.settingsItem}>
            <View style={styles.settingsItemText}>
              <ThemeText
                styles={styles.settingsItemLabel}
                content={t('settings.nostrHome.nip5Title')}
              />
              <ThemeText
                styles={styles.settingsItemDescription}
                content={t('settings.nostrHome.nip5Desc')}
              />
            </View>
            <ThemeIcon iconName="ChevronRight" />
          </View>
        </TouchableOpacity>
      </SettingsSection>

      <SettingsSection style={styles.lastSection}>
        <TouchableOpacity
          onPress={() => navigate.navigate('NosterWalletConnect')}
          style={[styles.sectionContent, { backgroundColor: backgroundOffset }]}
        >
          <View style={styles.settingsItem}>
            <View style={styles.settingsItemText}>
              <View style={styles.labelRow}>
                <ThemeText
                  styles={styles.settingsItemLabel}
                  content={t('settings.nostrHome.nwcTitle')}
                />
                <ThemeText
                  CustomNumberOfLines={1}
                  styles={[
                    styles.experimentalBadge,
                    {
                      color:
                        theme && darkModeType
                          ? COLORS.darkModeText
                          : COLORS.primary,
                    },
                  ]}
                  content={t('constants.experimentalLower')}
                />
              </View>
              <ThemeText
                styles={styles.settingsItemDescription}
                content={t('settings.nostrHome.nwcDesc')}
              />
            </View>
            <ThemeIcon iconName="ChevronRight" />
          </View>
        </TouchableOpacity>
      </SettingsSection>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  innerContainer: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
  scrollContent: {
    paddingTop: 24,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
    width: '100%',
  },
  lastSection: {
    marginBottom: 0,
  },
  sectionContent: {
    width: '100%',
    borderRadius: 8,
    padding: 16,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingsItemText: {
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
  },
  settingsItemLabel: {
    includeFontPadding: false,
  },
  settingsItemDescription: {
    fontSize: SIZES.small,
    opacity: 0.7,
    includeFontPadding: false,
    marginTop: 4,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  experimentalBadge: {
    fontSize: SIZES.small,
    marginLeft: 5,
    includeFontPadding: false,
    flexShrink: 1,
  },
});
