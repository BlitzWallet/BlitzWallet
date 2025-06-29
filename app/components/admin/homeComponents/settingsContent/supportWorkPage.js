import {Platform, ScrollView, StyleSheet, View} from 'react-native';
import {CENTER} from '../../../../constants';
import {INSET_WINDOW_WIDTH} from '../../../../constants/theme';
import SettingsItemWithSlider from '../../../../functions/CustomElements/settings/settingsItemWithSlider';
import {useGlobalContextProvider} from '../../../../../context-store/context';
import {SATSPERBITCOIN} from '../../../../constants/math';
import {useNodeContext} from '../../../../../context-store/nodeContext';
import {
  CustomKeyboardAvoidingView,
  TextInputSettingsItem,
} from '../../../../functions/CustomElements';
import {useCallback} from 'react';
import {useNavigation} from '@react-navigation/native';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';

export default function SupportWorkPage() {
  const {toggleMasterInfoObject, masterInfoObject} = useGlobalContextProvider();
  const {fiatStats} = useNodeContext();
  const navigate = useNavigation();

  const developerSupportObject = masterInfoObject.enabledDeveloperSupport;
  const balanceDenomination = masterInfoObject.userBalanceDenomination;

  console.log(developerSupportObject, 'TSET', balanceDenomination, fiatStats);
  const handleBaseFeeSettings = useCallback(
    (value, resetFunction) => {
      const parseValue = Number(value);
      if (isNaN(parseValue)) {
        resetFunction();
        navigate.navigate('ErrorScreen', {
          errorMessage: 'Entered value is not a number',
        });
        return;
      }

      if (parseValue <= 0 || !parseValue) {
        resetFunction();
        navigate.navigate('ErrorScreen', {
          errorMessage: 'Value cannot be 0',
        });
        return;
      }

      // convert value to sats here
      let newFee = 0;

      if (balanceDenomination !== 'fiat') {
        newFee = parseValue;
      } else {
        const fiatPrice = fiatStats.value || 50_000;

        const fiatConversion = Math.round(
          (SATSPERBITCOIN / fiatPrice) * parseValue,
        );

        newFee = Math.max(fiatConversion, 1);
      }

      toggleMasterInfoObject({
        enabledDeveloperSupport: {
          ...developerSupportObject,
          baseFee: newFee,
        },
      });
    },
    [masterInfoObject, balanceDenomination],
  );

  const convertedDefaultBaseFee = () => {
    if (balanceDenomination !== 'fiat') {
      return developerSupportObject?.baseFee;
    } else {
      const fiatPrice = fiatStats.value || 50_000;
      console.log(
        fiatPrice,
        fiatPrice / SATSPERBITCOIN,
        developerSupportObject?.baseFee,
      );
      const fiatConversion = Number(
        (
          (fiatPrice / SATSPERBITCOIN) *
          developerSupportObject?.baseFee
        ).toFixed(2),
      );
      console.log(fiatConversion, 'TST');

      return Math.max(fiatConversion, 0.01);
    }
  };
  const handlePercentFeeSettings = useCallback(
    (value, resetFunction) => {
      const parseValue = Number(value);
      if (isNaN(parseValue)) {
        resetFunction();
        navigate.navigate('ErrorScreen', {
          errorMessage: 'Entered value is not a number',
        });
        return;
      }

      if (parseValue <= 0 || !parseValue) {
        resetFunction();
        navigate.navigate('ErrorScreen', {
          errorMessage: 'Value cannot be 0',
        });
        return;
      }
      toggleMasterInfoObject({
        enabledDeveloperSupport: {
          ...developerSupportObject,
          baseFeePercent: Number((parseValue / 100).toFixed(5)),
        },
      });
    },
    [masterInfoObject, balanceDenomination],
  );

  return (
    <CustomKeyboardAvoidingView
      useStandardWidth={true}
      useTouchableWithoutFeedback={true}>
      <CustomSettingsTopBar
        shouldDismissKeyboard={true}
        label={'Support Our Work'}
      />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}>
        <SettingsItemWithSlider
          settingsTitle={`${
            developerSupportObject.isEnabled ? 'Enabled' : 'Disabled'
          } support`}
          toggleSwitchStateValue={developerSupportObject.isEnabled}
          settingDescription={`Blitz Wallet is a free, open-source project. Enabling support adds a small fee to each transaction to help fund continued development. When support is enabled, each time you send a transaction, a second support transaction is sent alongside it. Both will appear in your transaction history.`}
          handleSubmit={() => {
            toggleMasterInfoObject({
              enabledDeveloperSupport: {
                ...developerSupportObject,
                isEnabled: !developerSupportObject.isEnabled,
              },
            });
          }}
          showDescription={true}
        />
        <TextInputSettingsItem
          settingInputTitle={`Base Transaction Fee (${
            balanceDenomination !== 'fiat' ? 'sats' : fiatStats.coin
          })`}
          keyboardType="decimal-pad"
          settingDescription={`This is the base fee that will be added to each transaction. It will be included as part of the total transaction fee every time you send a payment.`}
          defaultTextInputValue={convertedDefaultBaseFee()}
          handleSubmit={handleBaseFeeSettings}
        />
        <TextInputSettingsItem
          settingInputTitle={`Transaction Fee Percent`}
          keyboardType="decimal-pad"
          settingDescription={`This is the percentage of the total transfer amount that will be added as a fee to each transaction.`}
          defaultTextInputValue={developerSupportObject.baseFeePercent * 100}
          handleSubmit={handlePercentFeeSettings}
        />
      </ScrollView>
    </CustomKeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
});
