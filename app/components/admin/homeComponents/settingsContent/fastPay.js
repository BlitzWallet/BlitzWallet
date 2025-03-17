import {Keyboard, TouchableWithoutFeedback, View} from 'react-native';
import {useGlobalContextProvider} from '../../../../../context-store/context';
import {CENTER, QUICK_PAY_STORAGE_KEY} from '../../../../constants';
import {useCallback, useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import {INSET_WINDOW_WIDTH} from '../../../../constants/theme';
import TextInputWithSliderSettingsItem from '../../../../functions/CustomElements/settings/textInputWIthSliderSettingsItem';

export default function FastPay() {
  const {masterInfoObject, toggleMasterInfoObject} = useGlobalContextProvider();
  const navigate = useNavigation();
  const fastPayThreshold =
    masterInfoObject[QUICK_PAY_STORAGE_KEY].fastPayThresholdSats;
  const isOn = masterInfoObject[QUICK_PAY_STORAGE_KEY].isFastPayEnabled;

  const handleSlider = useCallback(() => {
    toggleMasterInfoObject({
      [QUICK_PAY_STORAGE_KEY]: {
        ...masterInfoObject[QUICK_PAY_STORAGE_KEY],
        isFastPayEnabled: !isOn,
      },
    });
  }, [masterInfoObject]);

  const handleSubmit = useCallback(
    (value, resetFunction) => {
      const parseValue = Number(value);
      if (isNaN(parseValue)) {
        resetFunction();
        navigate.navigate('ErrorScreen', {
          errorMessage: 'Error adding inputed value, plase try again.',
        });
        return;
      }
      if (parseValue === 0) {
        resetFunction();
        navigate.navigate('ErrorScreen', {
          errorMessage: 'Amount cannot be 0',
        });
        return;
      }
      toggleMasterInfoObject({
        [QUICK_PAY_STORAGE_KEY]: {
          ...masterInfoObject[QUICK_PAY_STORAGE_KEY],
          fastPayThresholdSats: parseValue,
        },
      });
    },
    [masterInfoObject],
  );

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={{flex: 1, width: INSET_WINDOW_WIDTH, ...CENTER}}>
        <TextInputWithSliderSettingsItem
          sliderTitle="Enable Fast Pay"
          settingInputTitle="Fast pay threshold (Sats)"
          settingDescription="Fast pay allows you to instantly pay invoices below a specified threshold without needing to swipe for confirmation."
          defaultTextInputValue={fastPayThreshold}
          handleSubmit={handleSubmit}
          CustomToggleSwitchFunction={handleSlider}
          switchStateValue={isOn}
          switchPage="fastPay"
        />
      </View>
    </TouchableWithoutFeedback>
  );
}
