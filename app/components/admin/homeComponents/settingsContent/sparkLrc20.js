import {ScrollView, StyleSheet, View} from 'react-native';
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
import {useSparkWallet} from '../../../../../context-store/sparkContext';

export default function SparkSettingsPage() {
  const navigate = useNavigation();
  const {sparkInformation} = useSparkWallet();
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
    if (sparkInformation.balance > 10) return;
    navigate.navigate('InformationPopup', {
      textContent: `Your current wallet balance is ${displayCorrectDenomination(
        {
          amount: sparkInformation.balance,
          masterInfoObject,
          fiatStats,
        },
      )}. Blitz adds a ${displayCorrectDenomination({
        amount: 10,
        masterInfoObject,
        fiatStats,
      })} fee to all LRC-20 payments. Make sure you have some Bitcoin in your wallet to send tokens.`,
      buttonText: 'I understand',
    });
  }, [lrc20Settings, sparkInformation.balance]);
  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar label={'Spark Settings'} />
      <ScrollView>
        <View style={styles.container}>
          <SettingsItemWithSlider
            settingsTitle={`${
              lrc20Settings.isEnabled ? 'Enabled' : 'Disabled'
            } LRC-20`}
            switchPageName={'lrc20Settings'}
            showDescription={true}
            settingDescription={`LRC-20 is Spark’s native token. Enabling LRC-20 allows you send and receive tokens on the Spark network.\n\nBlitz is a Bitcoin focused wallet. We do not promote or endorse the use of tokens. This feature exists because we believe users should have the freedom to use the technology they want to use.\n\nBlitz also applies a ${displayCorrectDenomination(
              {amount: 10, masterInfoObject, fiatStats},
            )} fee to all token transactions, with 20% of that fee donated to support open-source Bitcoin development.`}
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
      </ScrollView>
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
