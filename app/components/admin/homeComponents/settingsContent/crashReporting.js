import {ScrollView, StyleSheet, View} from 'react-native';
import {ThemeText} from '../../../../functions/CustomElements';
import CustomToggleSwitch from '../../../../functions/CustomElements/switch';
import {useGlobalContextProvider} from '../../../../../context-store/context';
import {INSET_WINDOW_WIDTH, SIZES} from '../../../../constants/theme';
import {CENTER} from '../../../../constants';
import {useEffect, useRef} from 'react';
import {toggleCrashCollection} from '../../../../functions/crashlyticsLogs';
import {useTranslation} from 'react-i18next';
import GetThemeColors from '../../../../hooks/themeColors';

const SettingsSection = ({title, children, style}) => (
  <View style={[styles.section, style]}>
    {title ? <ThemeText styles={styles.sectionTitle} content={title} /> : null}
    {children}
  </View>
);

const SettingsItem = ({label, children, isLast, dividerColor}) => (
  <>
    <View style={styles.settingsItem}>
      <View style={styles.settingsItemText}>
        <ThemeText styles={styles.settingsItemLabel} content={label} />
      </View>
      {children}
    </View>
    {!isLast && (
      <View style={[styles.divider, {backgroundColor: dividerColor}]} />
    )}
  </>
);

export default function CrashReportingSettingsPage() {
  const {masterInfoObject, toggleMasterInfoObject} = useGlobalContextProvider();
  const isInitialLoad = useRef(true);
  const {t} = useTranslation();
  const {backgroundOffset, backgroundColor} = GetThemeColors();

  const isCrashReportingEnabled =
    masterInfoObject.crashReportingSettings.isCrashReportingEnabled;

  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    toggleCrashCollection(isCrashReportingEnabled);
  }, [isCrashReportingEnabled]);

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      style={styles.innerContainer}
      contentContainerStyle={styles.scrollContent}>
      <SettingsSection>
        <View style={[styles.sectionContent, {backgroundColor: backgroundOffset}]}>
          <SettingsItem
            isLast
            dividerColor={backgroundColor}
            label={t('settings.crashReporting.crashreporting', {
              context: isCrashReportingEnabled ? 'enabled' : 'disabled',
            })}>
            <CustomToggleSwitch
              page="settingsCrashReporting"
              toggleSwitchFunction={() => {
                toggleMasterInfoObject({
                  crashReportingSettings: {
                    isCrashReportingEnabled: !isCrashReportingEnabled,
                    lastChangedInSettings: new Date().getTime(),
                    lastChangedWithFirebase: new Date().getTime(),
                  },
                });
              }}
              stateValue={isCrashReportingEnabled}
            />
          </SettingsItem>
        </View>
        <ThemeText
          styles={styles.rowDescription}
          content={t('settings.crashReporting.descriptionText')}
        />
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
  sectionTitle: {
    fontSize: SIZES.small,
    textTransform: 'uppercase',
    opacity: 0.7,
    marginBottom: 16,
    includeFontPadding: false,
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
  rowDescription: {
    fontSize: SIZES.small,
    opacity: 0.7,
    includeFontPadding: false,
    marginTop: 8,
    paddingHorizontal: 8,
  },
  divider: {
    height: 1,
    marginVertical: 8,
  },
});
