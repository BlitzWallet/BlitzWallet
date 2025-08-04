import {StyleSheet, View} from 'react-native';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import {GlobalThemeView} from '../../../../functions/CustomElements';
import {useGlobalContextProvider} from '../../../../../context-store/context';
import SettingsItemWithSlider from '../../../../functions/CustomElements/settings/settingsItemWithSlider';
import {INSET_WINDOW_WIDTH} from '../../../../constants/theme';
import {CENTER} from '../../../../constants';
import {useEffect, useRef} from 'react';
import {useNavigation} from '@react-navigation/native';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import {useNodeContext} from '../../../../../context-store/nodeContext';

export default function SparkSettingsPage() {
  const navigate = useNavigation();
  const {masterInfoObject, toggleMasterInfoObject} = useGlobalContextProvider();
  const {fiatStats} = useNodeContext();
  const isInitialRender = useRef(true);
  const lrc20Settings = masterInfoObject.lrc20Settings || {};

  useEffect(() => {
    console.log(isInitialRender.current, lrc20Settings.isEnabled);
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }

    if (!lrc20Settings.isEnabled) return;
    navigate.navigate('InformationPopup', {
      textContent: `Blitz adds a ${displayCorrectDenomination({
        amount: 5,
        masterInfoObject,
        fiatStats,
      })} fee to all LRC-20 payments. Make sure you have some Bitcoin in your wallet to send tokens.`,
      buttonText: 'I understand',
    });
    console.log(lrc20Settings, 't');
  }, [lrc20Settings]);
  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar label={'Spark Settings'} />
      <View style={styles.container}>
        <SettingsItemWithSlider
          settingsTitle={`${
            lrc20Settings.isEnabled ? 'Enabled' : 'Disabled'
          } LRC-20`}
          showDescription={true}
          settingDescription={
            'LRC-20 is Spark’s native token. Enabling LRC-20 lets you send and receive tokens on the Spark network.\n\nBlitz is a Bitcoin focused wallet. We do not promote or endorse tokens. This feature exists because we believe users should have the freedom to use the technology they want to use. If you decide to use tokens, please understand they are speculative and have no real value.'
          }
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
