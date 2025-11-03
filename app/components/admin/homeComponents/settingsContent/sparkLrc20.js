import { ScrollView, StyleSheet, View } from 'react-native';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import { GlobalThemeView } from '../../../../functions/CustomElements';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import SettingsItemWithSlider from '../../../../functions/CustomElements/settings/settingsItemWithSlider';
import { INSET_WINDOW_WIDTH } from '../../../../constants/theme';
import { CENTER } from '../../../../constants';
import { useEffect, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { useTranslation } from 'react-i18next';

export default function SparkSettingsPage() {
  const navigate = useNavigation();
  const { sparkInformation } = useSparkWallet();
  const { masterInfoObject, toggleMasterInfoObject } =
    useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const isInitialRender = useRef(true);
  const lrc20Settings = masterInfoObject.lrc20Settings || {};
  const { t } = useTranslation();

  useEffect(() => {
    console.log(isInitialRender.current, lrc20Settings.isEnabled);
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }

    if (!lrc20Settings.isEnabled) return;
    if (sparkInformation.balance > 10) return;
    navigate.navigate('InformationPopup', {
      textContent: t('settings.sparkLrc20.balanceError', {
        balance: displayCorrectDenomination({
          amount: sparkInformation.balance,
          masterInfoObject,
          fiatStats,
        }),
        fee: displayCorrectDenomination({
          amount: 10,
          masterInfoObject,
          fiatStats,
        }),
      }),
      buttonText: t('constants.understandText'),
    });
  }, [lrc20Settings, sparkInformation.balance]);
  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar label={t('settings.sparkLrc20.title')} />
      <ScrollView>
        <View style={styles.container}>
          <SettingsItemWithSlider
            settingsTitle={t('settings.sparkLrc20.sliderTitle', {
              context: lrc20Settings.isEnabled ? 'enabled' : 'disabled',
            })}
            switchPageName={'lrc20Settings'}
            showDescription={true}
            settingDescription={t('settings.sparkLrc20.sliderDesc', {
              fee: displayCorrectDenomination({
                amount: 10,
                masterInfoObject,
                fiatStats,
              }),
            })}
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
