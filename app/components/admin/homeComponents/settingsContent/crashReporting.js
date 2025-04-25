import {StyleSheet, View} from 'react-native';
import SettingsItemWithSlider from '../../../../functions/CustomElements/settings/settingsItemWithSlider';
import {useGlobalContextProvider} from '../../../../../context-store/context';
import {INSET_WINDOW_WIDTH} from '../../../../constants/theme';
import {CENTER} from '../../../../constants';
import {useEffect, useRef} from 'react';
import {toggleCrashCollection} from '../../../../functions/crashlyticsLogs';
import {useTranslation} from 'react-i18next';

export default function CrashReportingSettingsPage() {
  const {masterInfoObject, toggleMasterInfoObject} = useGlobalContextProvider();
  const isInitialLoad = useRef(true);
  const {t} = useTranslation();

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
    <View style={styles.container}>
      <SettingsItemWithSlider
        settingsTitle={`${
          isCrashReportingEnabled
            ? t('settings.crashreporting.enabled')
            : t('settings.crashreporting.disabled')
        } ${t('settings.crashreporting.crashreporting')}`}
        settingDescription={t('settings.crashreporting.text1')}
        handleSubmit={() => {
          toggleMasterInfoObject({
            crashReportingSettings: {
              isCrashReportingEnabled: !isCrashReportingEnabled,
              lastChangedInSettings: new Date().getTime(),
              lastChangedWithFirebase: new Date().getTime(),
            },
          });
        }}
        toggleSwitchStateValue={isCrashReportingEnabled}
        showDescription={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
});
