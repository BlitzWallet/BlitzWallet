import {View} from 'react-native';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import {GlobalThemeView} from '../../../../functions/CustomElements';
import {useGlobalContextProvider} from '../../../../../context-store/context';
import SettingsItemWithSlider from '../../../../functions/CustomElements/settings/settingsItemWithSlider';

export default function SparkSettingsPage() {
  const {masterInfoObject, toggleMasterInfoObject} = useGlobalContextProvider();
  const lrc20Settings = masterInfoObject.lrc20Settings || {};
  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar label={'Spark Settings'} />
      <SettingsItemWithSlider
        settingsTitle={`${
          lrc20Settings.isEnabled ? 'Enabled' : 'Disabled'
        } LRC-20`}
        settingDescription="LRC-20 is Spark’s native token. Enabling LRC-20 lets you send and receive tokens on the Spark network."
      />
    </GlobalThemeView>
  );
}
