import {StyleSheet, View} from 'react-native';
import SettingsItemWithSlider from '../../../../functions/CustomElements/settings/settingsItemWithSlider';
import {useGlobalContextProvider} from '../../../../../context-store/context';
import {INSET_WINDOW_WIDTH} from '../../../../constants/theme';
import {CENTER} from '../../../../constants';
import {useEffect, useRef} from 'react';
import {toggleCrashCollection} from '../../../../functions/crashlyticsLogs';

export default function CrashReportingSettingsPage() {
  const {masterInfoObject, toggleMasterInfoObject} = useGlobalContextProvider();
  const isInitialLoad = useRef(true);

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
          isCrashReportingEnabled ? 'Enabled' : 'Disabled'
        } crash reporting`}
        settingDescription={`Crash data helps us improve the stability and performance of our application.\n\nWhen a crash occurs, the device information that is automatically recorded includes:\n\n• Operating System: OS version, device orientation, and jailbreak status\n• Device Details: Model, orientation, and available RAM\n• Crash Information: Date of the crash and the app version`}
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
