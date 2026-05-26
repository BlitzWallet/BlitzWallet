import {
  AddOrDeleteContactImage,
  CameraModal,
  ContactsPageLongPressActions,
  EditReceivePaymentInformation,
  ErrorScreen,
  SendPaymentScreen,
  SwitchReceiveOptionPage,
  ConfirmSplitPayment,
} from '../app/components/admin';
import {
  ConfirmLeaveChatGPT,
  CountryList,
  CreateGiftCardAccount,
  ExpandedGiftCardPage,
  GeneratedVPNFile,
  GiftCardOrderDetails,
  GiftCardPage,
  HistoricalGiftCardPurchases,
  HistoricalVPNPurchases,
  SwitchGenerativeAIModel,
} from '../app/components/admin/homeComponents/apps';
import ConfirmSMSReceivePage from '../app/components/admin/homeComponents/apps/sms4sats/confirmReceivePaymentScreen';
import SMSMessagingReceivedPage from '../app/components/admin/homeComponents/apps/sms4sats/receivePage';
import SMSMessagingSendPage from '../app/components/admin/homeComponents/apps/sms4sats/sendPage';
import SMSMessagingSendPhonePage from '../app/components/admin/homeComponents/apps/sms4sats/sendPhonePage';
import SMSMessagingReceiveCountryPage from '../app/components/admin/homeComponents/apps/sms4sats/receiveCountryPage';
import SMSMessagingSendDescriptionPage from '../app/components/admin/homeComponents/apps/sms4sats/sendDescriptionPage';
import ViewSmsReceiveCode from '../app/components/admin/homeComponents/apps/sms4sats/viewSMScode';
import {
  AddFriendsToSplit,
  CreateSplitBill,
  EditMyProfilePage,
  EditProfileFieldPage,
  ExpandedAddContactsPage,
  ExpandedContactsPage,
  // MyContactProfilePage,
  SelectGiftCardForContacts,
  SendAndRequestPage,
} from '../app/components/admin/homeComponents/contacts';
import SparkErrorScreen from '../app/components/admin/homeComponents/homeLightning/sparkErrorScreen';
import BackupSeedWarning from '../app/components/admin/homeComponents/homeLightning/backupSeedWarning';

import {
  ConfirmActionPage,
  NosterWalletConnect,
} from '../app/components/admin/homeComponents/settingsContent';
import POSStack from './POSStack';
import AccountPaymentPage from '../app/components/admin/homeComponents/settingsContent/accountComponents/accountPaymentPage';
import CreateCustodyAccountPage from '../app/components/admin/homeComponents/settingsContent/accountComponents/createAccountPage';
import SelectCreateAccountType from '../app/components/admin/homeComponents/settingsContent/accountComponents/selectCreateAccountType';
import EditAccountPage from '../app/components/admin/homeComponents/settingsContent/accountComponents/editAccountPage';
import EditAccountName from '../app/components/admin/homeComponents/settingsContent/accountComponents/editAccountName';
import EmojiAvatarSelector from '../app/components/admin/homeComponents/settingsContent/accountComponents/selectProfileImage';
import RemoveAccountPage from '../app/components/admin/homeComponents/settingsContent/accountComponents/removeAccountPage';
import RestoreDerivedAccountPage from '../app/components/admin/homeComponents/settingsContent/accountComponents/restoreDerivedAccountPage';
import SeedPhraseWarning from '../app/components/admin/homeComponents/settingsContent/seedPhraseWarning';
import ConfirmPinForLoginMode from '../app/components/admin/homeComponents/settingsContent/loginSecurity/enterPinPage';
import Nip5VerificationPage from '../app/components/admin/homeComponents/settingsContent/nip5/nip5Account';
import CreateNostrConnectAccount from '../app/components/admin/homeComponents/settingsContent/nwc/createNWCAccount';
import AddPOSItemsPage from '../app/components/admin/homeComponents/settingsContent/posPath/items/addPOSItemsPage';
import POSInstructionsPath from '../app/components/admin/homeComponents/settingsContent/posPath/posInstructionsPath';
import RoostockSwapInfo from '../app/components/admin/homeComponents/settingsContent/swapsComponents/rootstockSwapInfo';
import { CustomWebView } from '../app/functions/CustomElements';
import CustomHalfModal from '../app/functions/CustomElements/halfModal';
import InformationPopup from '../app/functions/CustomElements/informationPopup';
import ShowProfileQr from '../app/functions/CustomElements/showProfileQr';
import ViewContibutors from '../app/components/admin/homeComponents/pools/viewContributors';
import PoolsStack from './PoolsStack';
import GiftsStack from './GiftsStack';
import SavingsStack from './SavingsStack';
import {
  CreateAccountHome,
  DislaimerPage,
  GenerateKey,
  PinSetupPage,
  RestoreWallet,
  SkipCreateAccountPathMessage,
} from '../app/screens/createAccount';
import {
  AdminHomeIndex,
  AppStorePageIndex,
  ConfirmTxPage,
  ExpandedTx,
  ReceivePaymentHome,
  SendPaymentHome,
  SettingsContentIndex,
  SettingsIndex,
  TechnicalTransactionDetails,
  ViewAllTxPage,
  SettingsHub,
  SparkReceivePage,
} from '../app/screens/inAccount';
import SelectStablecoinParamsScreen from '../app/screens/inAccount/selectStablecoinParamsScreen';
import StablecoinSendScreen from '../app/components/admin/homeComponents/sendBitcoin/stablecoinSendScreen';
import AccumulationAddressDetail from '../app/components/admin/homeComponents/accumulationAddresses/AccumulationAddressDetail';
import AccumulationAddressesHome from '../app/components/admin/homeComponents/accumulationAddresses/AccumulationAddressesHome';
import AnalyticsStack from './analyticsStack';
import BTCMapScreen from '../app/screens/inAccount/btcMap';
import BitrefillShopModal from '../app/components/admin/homeComponents/store/bitrefillModal';

const SLIDE_FROM_BOTTOM_SCREENS = [
  { name: 'CustomWebView', component: CustomWebView },
  { name: 'SendBTC', component: SendPaymentHome },

  { name: 'ExpandedTx', component: ExpandedTx },
  {
    name: 'TechnicalTransactionDetails',
    component: TechnicalTransactionDetails,
  },
  // {name: 'LiquidSettingsPage', component: LiquidSettingsPage},
  {
    name: 'EditReceivePaymentInformation',
    component: EditReceivePaymentInformation,
  },
  { name: 'SwitchReceiveOptionPage', component: SwitchReceiveOptionPage },
  { name: 'ViewAllTxPage', component: ViewAllTxPage },
  { name: 'CameraModal', component: CameraModal },
  { name: 'SwitchGenerativeAIModel', component: SwitchGenerativeAIModel },
  { name: 'ShowProfileQr', component: ShowProfileQr },
  { name: 'ViewContributor', component: ViewContibutors },
  { name: 'BTCMapScreen', component: BTCMapScreen },
];
const SLIDE_FROM_RIGHT_SCREENS = [
  {
    name: 'CreateAccountHome',
    component: CreateAccountHome,
    options: { gestureEnabled: true },
  },
  { name: 'SettingsIndex', component: SettingsIndex },
  { name: 'SettingsHome', component: SettingsHub },
  // {name: 'HistoricalOnChainPayments', component: HistoricalOnChainPayments},
  { name: 'SettingsContentHome', component: SettingsContentIndex },
  {
    name: 'ConfirmPaymentScreen',
    component: SendPaymentScreen,
    options: { gestureEnabled: false },
  },
  { name: 'ExpandedContactsPage', component: ExpandedContactsPage },
  { name: 'ReceiveBTC', component: ReceivePaymentHome },
  // { name: 'MyContactProfilePage', component: MyContactProfilePage },
  { name: 'EditMyProfilePage', component: EditMyProfilePage },
  { name: 'EditProfileFieldPage', component: EditProfileFieldPage },
  { name: 'ExpandedAddContactsPage', component: ExpandedAddContactsPage },
  { name: 'SendAndRequestPage', component: SendAndRequestPage },
  { name: 'AddFriendsToSplit', component: AddFriendsToSplit },
  { name: 'CreateSplitBill', component: CreateSplitBill },
  { name: 'AppStorePageIndex', component: AppStorePageIndex },
  { name: 'HistoricalVPNPurchases', component: HistoricalVPNPurchases },
  { name: 'GeneratedVPNFile', component: GeneratedVPNFile },
  { name: 'POSInstructionsPath', component: POSInstructionsPath },
  { name: 'CreateGiftCardAccount', component: CreateGiftCardAccount },
  { name: 'GiftCardsPage', component: GiftCardPage },
  { name: 'CountryList', component: CountryList },
  { name: 'ExpandedGiftCardPage', component: ExpandedGiftCardPage },
  {
    name: 'HistoricalGiftCardPurchases',
    component: HistoricalGiftCardPurchases,
  },
  // {name: 'ManualSwapPopup', component: ManualSwapPopup},
  { name: 'POSStack', component: POSStack },
  // {name: 'LspDescriptionPopup', component: LspDescriptionPopup},
  { name: 'DisclaimerPage', component: DislaimerPage },
  { name: 'GenerateKey', component: GenerateKey },
  { name: 'PinSetup', component: PinSetupPage },
  { name: 'RestoreWallet', component: RestoreWallet },
  // {name: 'EcashSettings', component: EcashSettings},
  { name: 'AddPOSItemsPage', component: AddPOSItemsPage },
  { name: 'CreateCustodyAccount', component: CreateCustodyAccountPage },
  { name: 'SelectCreateAccountType', component: SelectCreateAccountType },
  { name: 'RestoreDerivedAccount', component: RestoreDerivedAccountPage },
  { name: 'EditAccountName', component: EditAccountName },
  { name: 'EditAccountPage', component: EditAccountPage },
  { name: 'RemoveAccountPage', component: RemoveAccountPage },
  { name: 'SeedPhraseWarning', component: SeedPhraseWarning },
  { name: 'EmojiAvatarSelector', component: EmojiAvatarSelector },
  { name: 'CustodyAccountPaymentPage', component: AccountPaymentPage },
  { name: 'NosterWalletConnect', component: NosterWalletConnect },
  { name: 'CreateNostrConnectAccount', component: CreateNostrConnectAccount },
  // {name: 'NWCWallet', component: NWCWallet},
  { name: 'Nip5VerificationPage', component: Nip5VerificationPage },
  { name: 'SelectGiftCardForContacts', component: SelectGiftCardForContacts },
  { name: 'SMSMessagingReceivedPage', component: SMSMessagingReceivedPage },
  { name: 'SMSMessagingSendPage', component: SMSMessagingSendPage },
  { name: 'SMSMessagingSendPhonePage', component: SMSMessagingSendPhonePage },
  {
    name: 'SMSMessagingSendDescriptionPage',
    component: SMSMessagingSendDescriptionPage,
  },
  {
    name: 'SMSMessagingReceiveCountryPage',
    component: SMSMessagingReceiveCountryPage,
  },
  { name: 'PoolsStack', component: PoolsStack },
  { name: 'GiftsStack', component: GiftsStack },
  { name: 'SavingsStack', component: SavingsStack },
  {
    name: 'ConfirmSplitPayment',
    component: ConfirmSplitPayment,
    options: { gestureEnabled: false },
  },
  {
    name: 'SelectStablecoinParamsScreen',
    component: SelectStablecoinParamsScreen,
  },
  {
    name: 'StablecoinSendScreen',
    component: StablecoinSendScreen,
    options: { gestureEnabled: false },
  },
  { name: 'AccumulationAddressesHome', component: AccumulationAddressesHome },
  { name: 'AccumulationAddressDetail', component: AccumulationAddressDetail },
  { name: 'SparkReceivePage', component: SparkReceivePage },
  { name: 'AnalyticsStack', component: AnalyticsStack },
];

const FADE_SCREENS = [
  { name: 'CustomHalfModal', component: CustomHalfModal },
  { name: 'ConfirmActionPage', component: ConfirmActionPage },
  { name: 'ConfirmLeaveChatGPT', component: ConfirmLeaveChatGPT },
  { name: 'ErrorScreen', component: ErrorScreen },
  { name: 'SparkErrorScreen', component: SparkErrorScreen },
  // {name: 'ExplainBalanceScreen', component: ExplainBalanceScreen},
  { name: 'GiftCardOrderDetails', component: GiftCardOrderDetails },
  {
    name: 'ContactsPageLongPressActions',
    component: ContactsPageLongPressActions,
  },
  // {name: 'RestoreProofsPopup', component: RestoreProofsPopup},
  // {name: 'MigrateProofsPopup', component: MigrateProofsPopup},
  { name: 'AddOrDeleteContactImage', component: AddOrDeleteContactImage },
  {
    name: 'SkipCreateAccountPathMessage',
    component: SkipCreateAccountPathMessage,
  },
  { name: 'InformationPopup', component: InformationPopup },

  { name: 'ConfirmTxPage', component: ConfirmTxPage },
  {
    name: 'HomeAdmin',
    component: AdminHomeIndex,
    options: { gestureEnabled: false },
  },
  // {
  //   name: 'ViewCustodyKey',
  //   component: ViewCustodyKey,
  // },
  { name: 'ConfirmPinForLoginMode', component: ConfirmPinForLoginMode },
  { name: 'ViewSMSReceiveCode', component: ViewSmsReceiveCode },
  { name: 'ConfirmSMSReceivePage', component: ConfirmSMSReceivePage },
  { name: 'RoostockSwapInfo', component: RoostockSwapInfo },
  { name: 'BackupSeedWarning', component: BackupSeedWarning },
];
const FADE_TRANSPARENT_MODAL_SCREENS = [
  // {
  //   name: 'RefundLiquidSwapPopup',
  //   component: RefundLiquidSwapPopup,
  // },
];
const MODAL_CARD_SCREENS = [
  {
    name: 'BitrefillShopModal',
    component: BitrefillShopModal,
  },
];

export {
  SLIDE_FROM_BOTTOM_SCREENS,
  SLIDE_FROM_RIGHT_SCREENS,
  FADE_SCREENS,
  FADE_TRANSPARENT_MODAL_SCREENS,
  MODAL_CARD_SCREENS,
};
