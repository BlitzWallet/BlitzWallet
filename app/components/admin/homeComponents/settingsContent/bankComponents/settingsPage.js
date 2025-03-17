import {Platform, ScrollView} from 'react-native';
import {
  MAX_CHANNEL_OPEN_FEE,
  MIN_CHANNEL_OPEN_FEE,
} from '../../../../../constants';
import {ANDROIDSAFEAREA, CENTER} from '../../../../../constants/styles';
import {useNavigation} from '@react-navigation/native';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import {useCallback, useState} from 'react';
import {
  CustomKeyboardAvoidingView,
  TextInputSettingsItem,
} from '../../../../../functions/CustomElements';
import {INSET_WINDOW_WIDTH} from '../../../../../constants/theme';
import {formatBalanceAmount} from '../../../../../functions';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import connectToLightningNode from '../../../../../functions/connectToLightning';
import {
  connectLsp,
  listLsps,
  nodeInfo,
} from '@breeztech/react-native-breez-sdk';
import {getTransactions} from '../../../../../functions/SDK';
import {useLightningEvent} from '../../../../../../context-store/lightningEventContext';
import {useNodeContext} from '../../../../../../context-store/nodeContext';
import useHandleBackPressNew from '../../../../../hooks/useHandleBackPressNew';
import TextInputWithSliderSettingsItem from '../../../../../functions/CustomElements/settings/textInputWIthSliderSettingsItem';
import SettingsItemWithSlider from '../../../../../functions/CustomElements/settings/settingsItemWithSlider';
import {useAppStatus} from '../../../../../../context-store/appStatus';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';

const SETTINGSITEMS = [
  {
    desc: `By turning on auto channel rebalance, Blitz will automatically swap funds from your channel to the bank or the bank to your channels based on the percentage of outgoing capacity you initially want.`,
    name: 'Auto channel rebalance',
    inputTitle: 'Initial percentage',
    id: 'acr', //auto channel rebalance
  },
  {
    desc: `By turning on regulated channel open, if you reach your inbound liquidity limit during a session, new funds will automatically be swapped to your bank for future use without opening a new channel. Once your bank has the amount specified above, a channel will be opened.`,
    name: 'Regulate channel open',
    inputTitle: 'Channel open size (sats)',
    id: 'rco', //regulate channel open
  },
  {
    desc: `Turning off Lightning disables both auto channel rebalance and regulate channel open. So, your balance will be held only on Liquid and never swapped to Lightning.`,
    name: 'Enable Lightning',
    id: 'tln', //toggleLN
  },
];

export default function LiquidSettingsPage() {
  const navigate = useNavigation();
  const {masterInfoObject, toggleMasterInfoObject} = useGlobalContextProvider();
  const {minMaxLiquidSwapAmounts} = useAppStatus();
  const {toggleNodeInformation} = useNodeContext();
  const {onLightningBreezEvent} = useLightningEvent();
  const [isEnablingLightning, setIsEnablingLightning] = useState(false);
  const insets = useSafeAreaInsets();
  useHandleBackPressNew();
  const autoChannelRebalanceState =
    masterInfoObject.liquidWalletSettings.autoChannelRebalance;
  const regulateChannelOpenState =
    masterInfoObject.liquidWalletSettings.regulateChannelOpen;
  const isLightningEnabledState =
    masterInfoObject.liquidWalletSettings.isLightningEnabled;

  const bottomPadding = Platform.select({
    ios: insets.bottom,
    android: ANDROIDSAFEAREA,
  });

  const handleAutoChannelRebalanceSubmit = useCallback(
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
          errorMessage: 'Percentage cannot be 0',
        });
        return;
      }

      toggleMasterInfoObject({
        liquidWalletSettings: {
          ...masterInfoObject.liquidWalletSettings,
          autoChannelRebalancePercantage: parseValue,
        },
      });
    },
    [masterInfoObject],
  );
  const handleRegulateChannelOpenSubmit = useCallback(
    (value, resetFunction) => {
      const parseValue = Number(value);
      if (isNaN(parseValue)) {
        resetFunction();
        navigate.navigate('ErrorScreen', {
          errorMessage: 'Error adding inputed value, plase try again.',
        });
        return;
      }

      if (
        parseValue < MIN_CHANNEL_OPEN_FEE ||
        parseValue > MAX_CHANNEL_OPEN_FEE
      ) {
        resetFunction();
        navigate.navigate('ErrorScreen', {
          errorMessage: `${
            parseValue <= MAX_CHANNEL_OPEN_FEE
              ? `Minimum channel open size cannot be smaller than ${formatBalanceAmount(
                  MIN_CHANNEL_OPEN_FEE,
                )} sats`
              : `Minimum channel open size cannot be larger than ${formatBalanceAmount(
                  MAX_CHANNEL_OPEN_FEE,
                )} sats`
          }`,
        });
        return;
      }

      toggleMasterInfoObject({
        liquidWalletSettings: {
          ...masterInfoObject.liquidWalletSettings,
          regulatedChannelOpenSize: parseValue,
        },
      });
    },
    [masterInfoObject],
  );
  const handleMaxChannelOpenFeeSubmit = useCallback(
    (value, resetFunction) => {
      const parseValue = Number(value);
      if (isNaN(parseValue)) {
        resetFunction();
        navigate.navigate('ErrorScreen', {
          errorMessage: 'Error adding inputed value, plase try again.',
        });
        return;
      }

      toggleMasterInfoObject({
        liquidWalletSettings: {
          ...masterInfoObject.liquidWalletSettings,
          maxChannelOpenFee: parseValue,
        },
      });
    },
    [masterInfoObject],
  );
  const handleMinimumRebalanceFeeSubmit = useCallback(
    (value, resetFunction) => {
      const parseValue = Number(value);
      if (isNaN(parseValue)) {
        resetFunction();
        navigate.navigate('ErrorScreen', {
          errorMessage: 'Error adding inputed value, plase try again.',
        });
        return;
      }
      if (parseValue < minMaxLiquidSwapAmounts.min) {
        resetFunction();
        navigate.navigate('ErrorScreen', {
          errorMessage: `Amount can not be less than minimum swap amount ${formatBalanceAmount(
            minMaxLiquidSwapAmounts.min,
          )} sats.`,
        });
        return;
      }
      toggleMasterInfoObject({
        liquidWalletSettings: {
          ...masterInfoObject.liquidWalletSettings,
          minAutoSwapAmount: parseValue,
        },
      });
    },
    [masterInfoObject],
  );
  const handleEnableLightningSubmit = useCallback(async () => {
    if (isLightningEnabledState) {
      toggleMasterInfoObject({
        liquidWalletSettings: {
          ...masterInfoObject.liquidWalletSettings,
          isLightningEnabled: false,
        },
      });
      return;
    }

    const didConnectToNode = await handleConnectToNode();
    console.log(didConnectToNode, 'DID CONNECT TO NODE');

    if (didConnectToNode) {
      toggleMasterInfoObject({
        liquidWalletSettings: {
          ...masterInfoObject.liquidWalletSettings,
          isLightningEnabled: true,
        },
      });
    } else {
      navigate.navigate('ErrorScreen', {
        errorMessage:
          'Unable to connect to the node at this time. Please try again later',
      });
    }
    return;
  }, [masterInfoObject, isLightningEnabledState]);
  const autoChannelRegalanceSwitchFunction = useCallback(() => {
    toggleMasterInfoObject({
      liquidWalletSettings: {
        ...masterInfoObject.liquidWalletSettings,
        autoChannelRebalance: !autoChannelRebalanceState,
      },
    });
  }, [masterInfoObject, autoChannelRebalanceState]);
  const regulateChannelOpenSwitchFunction = useCallback(() => {
    toggleMasterInfoObject({
      liquidWalletSettings: {
        ...masterInfoObject.liquidWalletSettings,
        regulateChannelOpen: !regulateChannelOpenState,
      },
    });
  }, [masterInfoObject, regulateChannelOpenState]);

  const handleConnectToNode = useCallback(async () => {
    try {
      setIsEnablingLightning(true);
      const didConnectToNode = await connectToLightningNode(
        onLightningBreezEvent,
      );
      if (!didConnectToNode?.isConnected)
        throw Error('Not able to connect to node');
      const node_info = await nodeInfo();
      if (!node_info.connectedPeers.length) {
        const availableLsps = await listLsps();

        await connectLsp(availableLsps[0].id);
      }

      const [nodeState, transactions, lspInfo] = await Promise.all([
        nodeInfo(),
        getTransactions(),
        listLsps(),
      ]);

      const msatToSat = nodeState.channelsBalanceMsat / 1000;

      toggleNodeInformation({
        didConnectToNode: true,
        transactions: transactions,
        userBalance: msatToSat,
        inboundLiquidityMsat: nodeState.totalInboundLiquidityMsats,
        blockHeight: nodeState.blockHeight,
        onChainBalance: nodeState.onchainBalanceMsat,
        lsp: lspInfo,
      });

      return true;
    } catch (err) {
      console.log(err);
      console.log(err, 'HANDLE NODE CONNECTION ERROR');
      return false;
    } finally {
      console.log('RUNNING IN FINALLY ');
      setIsEnablingLightning(false);
    }
  }, []);

  return (
    <CustomKeyboardAvoidingView useStandardWidth={true}>
      <CustomSettingsTopBar shouldDismissKeyboard={true} label={'Settings'} />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          width: INSET_WINDOW_WIDTH,
          ...CENTER,
          paddingBottom: bottomPadding,
        }}
        showsVerticalScrollIndicator={false}>
        <TextInputWithSliderSettingsItem
          sliderTitle={SETTINGSITEMS[0].name}
          settingInputTitle={SETTINGSITEMS[0].inputTitle}
          settingDescription={SETTINGSITEMS[0].desc}
          defaultTextInputValue={
            masterInfoObject.liquidWalletSettings.autoChannelRebalancePercantage
          }
          handleSubmit={handleAutoChannelRebalanceSubmit}
          CustomToggleSwitchFunction={autoChannelRegalanceSwitchFunction}
          switchStateValue={autoChannelRebalanceState}
          switchPage="bankSettings"
        />
        <TextInputWithSliderSettingsItem
          sliderTitle={SETTINGSITEMS[1].name}
          settingInputTitle={SETTINGSITEMS[1].inputTitle}
          settingDescription={SETTINGSITEMS[1].desc}
          defaultTextInputValue={
            masterInfoObject.liquidWalletSettings.regulatedChannelOpenSize
          }
          handleSubmit={handleRegulateChannelOpenSubmit}
          CustomToggleSwitchFunction={regulateChannelOpenSwitchFunction}
          switchStateValue={regulateChannelOpenState}
          switchPage="bankSettings"
        />
        <SettingsItemWithSlider
          settingsTitle={SETTINGSITEMS[2].name}
          settingDescription={SETTINGSITEMS[2].desc}
          switchPageName={'bankSettings'}
          handleSubmit={handleEnableLightningSubmit}
          showLoadingIcon={isEnablingLightning}
          toggleSwitchStateValue={isLightningEnabledState}
        />
        <TextInputSettingsItem
          settingInputTitle="Max open fee (sats)"
          settingDescription="The Max Channel Open Fee sets the highest amount you’re willing to pay in on-chain fees when opening a Lightning channel. If the network fee exceeds this limit, the channel won’t be opened"
          defaultTextInputValue={
            masterInfoObject.liquidWalletSettings.maxChannelOpenFee === 0 ||
            masterInfoObject.liquidWalletSettings.maxChannelOpenFee
              ? masterInfoObject.liquidWalletSettings.maxChannelOpenFee
              : 5000
          }
          handleSubmit={handleMaxChannelOpenFeeSubmit}
        />
        <TextInputSettingsItem
          settingInputTitle="Minimum rebalance (sats)"
          settingDescription={`Minimum Rebalance sets the lowest amount of satoshis required for auto-rebalancing in Blitz Wallet. If the rebalance amount is below this limit, no rebalancing will occur. The amount can not be less than ${formatBalanceAmount(
            minMaxLiquidSwapAmounts.min,
          )} sats.`}
          defaultTextInputValue={
            masterInfoObject.liquidWalletSettings.minAutoSwapAmount
          }
          handleSubmit={handleMinimumRebalanceFeeSubmit}
        />
      </ScrollView>
    </CustomKeyboardAvoidingView>
  );
}
