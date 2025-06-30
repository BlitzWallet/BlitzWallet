import {ScrollView} from 'react-native';
import {
  CustomKeyboardAvoidingView,
  TextInputSettingsItem,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import useHandleBackPressNew from '../../../../../hooks/useHandleBackPressNew';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import {useNodeContext} from '../../../../../../context-store/nodeContext';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import {useCallback} from 'react';
import {
  BITCOIN_SAT_TEXT,
  CENTER,
  MAX_ECASH_BALANCE,
  MAX_ECASH_RECEIVE,
} from '../../../../../constants';
import {useNavigation} from '@react-navigation/native';
import {INSET_WINDOW_WIDTH} from '../../../../../constants/theme';

export default function EcashSettings() {
  const navigate = useNavigation();
  const {nodeInformation} = useNodeContext();
  const {masterInfoObject, toggleMasterInfoObject} = useGlobalContextProvider();
  useHandleBackPressNew();
  const ecashWalletSettings = masterInfoObject.ecashWalletSettings;

  const handleMaxReceive = useCallback(
    (value, resetFunction) => {
      const parseValue = Number(value);
      if (isNaN(parseValue)) {
        resetFunction();
        navigate.navigate('ErrorScreen', {
          errorMessage: 'Error adding inputed value, plase try again.',
        });
        return;
      }
      if (parseValue > ecashWalletSettings.maxEcashBalance) {
        resetFunction();
        navigate.navigate('ErrorScreen', {
          errorMessage: 'Cannot set value greater than maximum balance.',
        });
        return;
      }
      toggleMasterInfoObject({
        ecashWalletSettings: {
          ...ecashWalletSettings,
          maxReceiveAmountSat: parseValue,
        },
      });
    },
    [ecashWalletSettings, toggleMasterInfoObject],
  );
  const handleMaxBalance = useCallback(
    (value, resetFunction) => {
      const parseValue = Number(value);
      if (isNaN(parseValue)) {
        resetFunction();
        navigate.navigate('ErrorScreen', {
          errorMessage: 'Error adding inputed value, plase try again.',
        });
        return;
      }
      if (parseValue > MAX_ECASH_BALANCE) {
        resetFunction();
        navigate.navigate('ErrorScreen', {
          errorMessage: 'Cannot set value greater than maximum amount.',
        });
        return;
      }
      toggleMasterInfoObject({
        ecashWalletSettings: {
          ...ecashWalletSettings,
          maxEcashBalance: parseValue,
        },
      });
    },
    [ecashWalletSettings, toggleMasterInfoObject],
  );
  return (
    <CustomKeyboardAvoidingView useStandardWidth={true}>
      <CustomSettingsTopBar shouldDismissKeyboard={true} />
      <ScrollView
        contentContainerStyle={{width: INSET_WINDOW_WIDTH, ...CENTER}}
        showsVerticalScrollIndicator={false}>
        <TextInputSettingsItem
          defaultTextInputValue={ecashWalletSettings.maxReceiveAmountSat}
          settingInputTitle={`Max receive (${BITCOIN_SAT_TEXT})`}
          settingDescription={`This is the maximum receive limit for eCash transactions. If a payment exceeds the set limit, it will automatically be directed to a different network. The highest limit you can set for this feature is ${displayCorrectDenomination(
            {amount: MAX_ECASH_RECEIVE, nodeInformation, masterInfoObject},
          )}.`}
          handleSubmit={handleMaxReceive}
        />
        <TextInputSettingsItem
          defaultTextInputValue={ecashWalletSettings.maxEcashBalance}
          settingInputTitle={`Max balance (${BITCOIN_SAT_TEXT})`}
          settingDescription={`This is the maximum balance limit for eCash. If your exceeds the set limit, you will no longer be able to receive to eCash. The highest limit you can set for this feature is ${displayCorrectDenomination(
            {amount: MAX_ECASH_BALANCE, nodeInformation, masterInfoObject},
          )}.`}
          handleSubmit={handleMaxBalance}
        />
      </ScrollView>
    </CustomKeyboardAvoidingView>
  );
}
