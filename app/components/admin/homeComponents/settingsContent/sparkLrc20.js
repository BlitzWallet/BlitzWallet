import {StyleSheet, View} from 'react-native';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import {GlobalThemeView} from '../../../../functions/CustomElements';
import {useGlobalContextProvider} from '../../../../../context-store/context';
import SettingsItemWithSlider from '../../../../functions/CustomElements/settings/settingsItemWithSlider';
import {INSET_WINDOW_WIDTH} from '../../../../constants/theme';
import {CENTER} from '../../../../constants';

export default function SparkSettingsPage() {
  const {masterInfoObject, toggleMasterInfoObject} = useGlobalContextProvider();
  const lrc20Settings = masterInfoObject.lrc20Settings || {};
  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar label={'Spark Settings'} />
      <View style={styles.container}>
        <SettingsItemWithSlider
          settingsTitle={`${
            lrc20Settings.isEnabled ? 'Enabled' : 'Disabled'
          } LRC-20`}
          showDescription={true}
          settingDescription="LRC-20 is Spark’s native token. Enabling LRC-20 lets you send and receive tokens on the Spark network."
          handleSubmit={() =>
            toggleMasterInfoObject({
              lrc20Settings: {
                ...lrc20Settings,
                isEnabled: !lrc20Settings.isEnabled,
              },
            })
          }
          toggleSwitchStateValue={lrc20Settings.isEnabled}
        />
      </View>
    </GlobalThemeView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
});
