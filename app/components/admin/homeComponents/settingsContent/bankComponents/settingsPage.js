// import {Platform, ScrollView} from 'react-native';
// import {
//   MAX_CHANNEL_OPEN_FEE,
//   MIN_CHANNEL_OPEN_FEE,
// } from '../../../../../constants';
// import {ANDROIDSAFEAREA, CENTER} from '../../../../../constants/styles';
// import {useNavigation} from '@react-navigation/native';
// import {useGlobalContextProvider} from '../../../../../../context-store/context';
// import {useCallback, useState} from 'react';
// import {
//   CustomKeyboardAvoidingView,
//   TextInputSettingsItem,
// } from '../../../../../functions/CustomElements';
// import {INSET_WINDOW_WIDTH} from '../../../../../constants/theme';
// import {formatBalanceAmount} from '../../../../../functions';
// import {useSafeAreaInsets} from 'react-native-safe-area-context';
// import connectToLightningNode from '../../../../../functions/connectToLightning';
// import {
//   connectLsp,
//   listLsps,
//   nodeInfo,
// } from '@breeztech/react-native-breez-sdk';
// import {getTransactions} from '../../../../../functions/SDK';
// import {useLightningEvent} from '../../../../../../context-store/lightningEventContext';
// import {useNodeContext} from '../../../../../../context-store/nodeContext';
// import useHandleBackPressNew from '../../../../../hooks/useHandleBackPressNew';
// import TextInputWithSliderSettingsItem from '../../../../../functions/CustomElements/settings/textInputWIthSliderSettingsItem';
// import SettingsItemWithSlider from '../../../../../functions/CustomElements/settings/settingsItemWithSlider';
// import {useAppStatus} from '../../../../../../context-store/appStatus';
// import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
// import {useTranslation} from 'react-i18next';

// export default function LiquidSettingsPage() {
//   const navigate = useNavigation();
//   const {masterInfoObject, toggleMasterInfoObject} = useGlobalContextProvider();
//   const {minMaxLiquidSwapAmounts} = useAppStatus();
//   const {toggleNodeInformation} = useNodeContext();
//   const {onLightningBreezEvent} = useLightningEvent();
//   const [isEnablingLightning, setIsEnablingLightning] = useState(false);
//   const {t} = useTranslation();
//   const insets = useSafeAreaInsets();
//   useHandleBackPressNew();
//   const autoChannelRebalanceState =
//     masterInfoObject.liquidWalletSettings.autoChannelRebalance;
//   const regulateChannelOpenState =
//     masterInfoObject.liquidWalletSettings.regulateChannelOpen;
//   const isLightningEnabledState =
//     masterInfoObject.liquidWalletSettings.isLightningEnabled;

//   const bottomPadding = Platform.select({
//     ios: insets.bottom,
//     android: ANDROIDSAFEAREA,
//   });

//   const handleAutoChannelRebalanceSubmit = useCallback(
//     (value, resetFunction) => {
//       const parseValue = Number(value);
//       if (isNaN(parseValue)) {
//         resetFunction();
//         navigate.navigate('ErrorScreen', {
//           errorMessage: t('settings.bank.settings.text1'),
//         });
//         return;
//       }
//       if (parseValue === 0) {
//         resetFunction();
//         navigate.navigate('ErrorScreen', {
//           errorMessage: t('settings.bank.settings.text2'),
//         });
//         return;
//       }

//       toggleMasterInfoObject({
//         liquidWalletSettings: {
//           ...masterInfoObject.liquidWalletSettings,
//           autoChannelRebalancePercantage: parseValue,
//         },
//       });
//     },
//     [masterInfoObject],
//   );
//   const handleRegulateChannelOpenSubmit = useCallback(
//     (value, resetFunction) => {
//       const parseValue = Number(value);
//       if (isNaN(parseValue)) {
//         resetFunction();
//         navigate.navigate('ErrorScreen', {
//           errorMessage: t('settings.bank.settings.text1'),
//         });
//         return;
//       }

//       if (
//         parseValue < MIN_CHANNEL_OPEN_FEE ||
//         parseValue > MAX_CHANNEL_OPEN_FEE
//       ) {
//         resetFunction();
//         navigate.navigate('ErrorScreen', {
//           errorMessage: `${
//             parseValue <= MAX_CHANNEL_OPEN_FEE
//               ? `${t('settings.bank.settings.text3')} ${formatBalanceAmount(
//                   MIN_CHANNEL_OPEN_FEE,
//                 )} sats`
//               : `${t('settings.bank.settings.text4')} ${formatBalanceAmount(
//                   MAX_CHANNEL_OPEN_FEE,
//                 )} sats`
//           }`,
//         });
//         return;
//       }

//       toggleMasterInfoObject({
//         liquidWalletSettings: {
//           ...masterInfoObject.liquidWalletSettings,
//           regulatedChannelOpenSize: parseValue,
//         },
//       });
//     },
//     [masterInfoObject],
//   );
//   const handleMaxChannelOpenFeeSubmit = useCallback(
//     (value, resetFunction) => {
//       const parseValue = Number(value);
//       if (isNaN(parseValue)) {
//         resetFunction();
//         navigate.navigate('ErrorScreen', {
//           errorMessage: t('settings.bank.settings.text1'),
//         });
//         return;
//       }

//       toggleMasterInfoObject({
//         liquidWalletSettings: {
//           ...masterInfoObject.liquidWalletSettings,
//           maxChannelOpenFee: parseValue,
//         },
//       });
//     },
//     [masterInfoObject],
//   );
//   const handleMinimumRebalanceFeeSubmit = useCallback(
//     (value, resetFunction) => {
//       const parseValue = Number(value);
//       if (isNaN(parseValue)) {
//         resetFunction();
//         navigate.navigate('ErrorScreen', {
//           errorMessage: t('settings.bank.settings.text1'),
//         });
//         return;
//       }
//       if (parseValue < minMaxLiquidSwapAmounts.min) {
//         resetFunction();
//         navigate.navigate('ErrorScreen', {
//           errorMessage: `${t(
//             'settings.bank.settings.text5',
//           )} ${formatBalanceAmount(minMaxLiquidSwapAmounts.min)} sats.`,
//         });
//         return;
//       }
//       toggleMasterInfoObject({
//         liquidWalletSettings: {
//           ...masterInfoObject.liquidWalletSettings,
//           minAutoSwapAmount: parseValue,
//         },
//       });
//     },
//     [masterInfoObject],
//   );
//   const handleEnableLightningSubmit = useCallback(async () => {
//     if (isLightningEnabledState) {
//       toggleMasterInfoObject({
//         liquidWalletSettings: {
//           ...masterInfoObject.liquidWalletSettings,
//           isLightningEnabled: false,
//         },
//       });
//       return;
//     }

//     const didConnectToNode = await handleConnectToNode();
//     console.log(didConnectToNode, 'DID CONNECT TO NODE');

//     if (didConnectToNode) {
//       toggleMasterInfoObject({
//         liquidWalletSettings: {
//           ...masterInfoObject.liquidWalletSettings,
//           isLightningEnabled: true,
//         },
//       });
//     } else {
//       navigate.navigate('ErrorScreen', {
//         errorMessage: t('settings.bank.settings.text6'),
//       });
//     }
//     return;
//   }, [masterInfoObject, isLightningEnabledState]);
//   const autoChannelRegalanceSwitchFunction = useCallback(() => {
//     toggleMasterInfoObject({
//       liquidWalletSettings: {
//         ...masterInfoObject.liquidWalletSettings,
//         autoChannelRebalance: !autoChannelRebalanceState,
//       },
//     });
//   }, [masterInfoObject, autoChannelRebalanceState]);
//   const regulateChannelOpenSwitchFunction = useCallback(() => {
//     toggleMasterInfoObject({
//       liquidWalletSettings: {
//         ...masterInfoObject.liquidWalletSettings,
//         regulateChannelOpen: !regulateChannelOpenState,
//       },
//     });
//   }, [masterInfoObject, regulateChannelOpenState]);

//   const handleConnectToNode = useCallback(async () => {
//     try {
//       setIsEnablingLightning(true);
//       const didConnectToNode = await connectToLightningNode(
//         onLightningBreezEvent,
//       );

//       if (
//         !didConnectToNode?.isConnected &&
//         didConnectToNode.reason !== 'BreezServices already initialized'
//       )
//         throw Error('Not able to connect to node');

//       const [nodeState, transactions, lspInfo] = await Promise.all([
//         nodeInfo(),
//         getTransactions(),
//         listLsps(),
//       ]);

//       if (!nodeState.connectedPeers.length) {
//         if (lspInfo[0]?.id) await connectLsp(lspInfo[0]?.id);
//       }

//       const msatToSat = nodeState.channelsBalanceMsat / 1000;

//       toggleNodeInformation({
//         didConnectToNode: true,
//         transactions: transactions,
//         userBalance: msatToSat,
//         inboundLiquidityMsat: nodeState.totalInboundLiquidityMsats,
//         blockHeight: nodeState.blockHeight,
//         onChainBalance: nodeState.onchainBalanceMsat,
//         lsp: lspInfo,
//       });

//       return true;
//     } catch (err) {
//       console.log(err);
//       console.log(err, 'HANDLE NODE CONNECTION ERROR');
//       return false;
//     } finally {
//       console.log('RUNNING IN FINALLY');
//       setIsEnablingLightning(false);
//     }
//   }, []);

//   return (
//     <CustomKeyboardAvoidingView useStandardWidth={true}>
//       <CustomSettingsTopBar
//         shouldDismissKeyboard={true}
//         label={t('settings.bank.settings.text7')}
//       />
//       <ScrollView
//         contentContainerStyle={{
//           flexGrow: 1,
//           width: INSET_WINDOW_WIDTH,
//           ...CENTER,
//           paddingBottom: bottomPadding,
//         }}
//         showsVerticalScrollIndicator={false}>
//         <TextInputWithSliderSettingsItem
//           sliderTitle={t('settings.bank.settings.text8')}
//           settingInputTitle={t('settings.bank.settings.text9')}
//           settingDescription={t('settings.bank.settings.text10')}
//           defaultTextInputValue={
//             masterInfoObject.liquidWalletSettings.autoChannelRebalancePercantage
//           }
//           handleSubmit={handleAutoChannelRebalanceSubmit}
//           CustomToggleSwitchFunction={autoChannelRegalanceSwitchFunction}
//           switchStateValue={autoChannelRebalanceState}
//           switchPage="bankSettings"
//         />
//         <TextInputWithSliderSettingsItem
//           sliderTitle={t('settings.bank.settings.text11')}
//           settingInputTitle={t('settings.bank.settings.text12')}
//           settingDescription={t('settings.bank.settings.text13')}
//           defaultTextInputValue={
//             masterInfoObject.liquidWalletSettings.regulatedChannelOpenSize
//           }
//           handleSubmit={handleRegulateChannelOpenSubmit}
//           CustomToggleSwitchFunction={regulateChannelOpenSwitchFunction}
//           switchStateValue={regulateChannelOpenState}
//           switchPage="bankSettings"
//         />
//         <SettingsItemWithSlider
//           settingsTitle={t('settings.bank.settings.text14')}
//           settingDescription={t('settings.bank.settings.text15')}
//           switchPageName={'bankSettings'}
//           handleSubmit={handleEnableLightningSubmit}
//           showLoadingIcon={isEnablingLightning}
//           toggleSwitchStateValue={isLightningEnabledState}
//         />
//         <TextInputSettingsItem
//           settingInputTitle={t('settings.bank.settings.text16')}
//           settingDescription={t('settings.bank.settings.text17')}
//           defaultTextInputValue={
//             masterInfoObject.liquidWalletSettings.maxChannelOpenFee === 0 ||
//             masterInfoObject.liquidWalletSettings.maxChannelOpenFee
//               ? masterInfoObject.liquidWalletSettings.maxChannelOpenFee
//               : 5000
//           }
//           handleSubmit={handleMaxChannelOpenFeeSubmit}
//         />
//         <TextInputSettingsItem
//           settingInputTitle={t('settings.bank.settings.text18')}
//           settingDescription={`${t(
//             'settings.bank.settings.text19',
//           )} ${formatBalanceAmount(minMaxLiquidSwapAmounts.min)} sats.`}
//           defaultTextInputValue={
//             masterInfoObject.liquidWalletSettings.minAutoSwapAmount
//           }
//           handleSubmit={handleMinimumRebalanceFeeSubmit}
//         />
//       </ScrollView>
//     </CustomKeyboardAvoidingView>
//   );
// }
