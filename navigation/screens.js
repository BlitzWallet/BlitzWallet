import {
  AddOrDeleteContactImage,
  CameraModal,
  ClipboardCopyPopup,
  ContactsPageLongPressActions,
  EditReceivePaymentInformation,
  ErrorScreen,
  SendPaymentScreen,
  SwitchReceiveOptionPage,
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
import HistoricalSMSMessagingPage from '../app/components/admin/homeComponents/apps/sms4sats/sentPayments';
import ViewSmsReceiveCode from '../app/components/admin/homeComponents/apps/sms4sats/viewSMScode';
import {
  ChooseContactHalfModal,
  EditMyProfilePage,
  ExpandedAddContactsPage,
  ExpandedContactsPage,
  MyContactProfilePage,
  SelectGiftCardForContacts,
  SendAndRequestPage,
} from '../app/components/admin/homeComponents/contacts';
import SparkErrorScreen from '../app/components/admin/homeComponents/homeLightning/sparkErrorScreen';
import {
  ConfirmActionPage,
  NosterWalletConnect,
  TotalTipsScreen,
  ViewPOSTransactions,
} from '../app/components/admin/homeComponents/settingsContent';
import AccountPaymentPage from '../app/components/admin/homeComponents/settingsContent/accountComponents/accountPaymentPage';
import CreateCustodyAccountPage from '../app/components/admin/homeComponents/settingsContent/accountComponents/createAccountPage';
import ViewCustodyAccountPage from '../app/components/admin/homeComponents/settingsContent/accountComponents/viewAccountPage';
import ConfirmPinForLoginMode from '../app/components/admin/homeComponents/settingsContent/loginSecurity/enterPinPage';
import Nip5VerificationPage from '../app/components/admin/homeComponents/settingsContent/nip5/nip5Account';
import CreateNostrConnectAccount from '../app/components/admin/homeComponents/settingsContent/nwc/createNWCAccount';
import NWCWalletSetup from '../app/components/admin/homeComponents/settingsContent/nwc/showSeedPage';
import AddPOSItemsPage from '../app/components/admin/homeComponents/settingsContent/posPath/items/addPOSItemsPage';
import POSInstructionsPath from '../app/components/admin/homeComponents/settingsContent/posPath/posInstructionsPath';
import SparkSettingsPage from '../app/components/admin/homeComponents/settingsContent/sparkLrc20';
import RoostockSwapInfo from '../app/components/admin/homeComponents/settingsContent/swapsComponents/rootstockSwapInfo';
import {CustomWebView} from '../app/functions/CustomElements';
import CustomHalfModal from '../app/functions/CustomElements/halfModal';
import InformationPopup from '../app/functions/CustomElements/informationPopup';
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
} from '../app/screens/inAccount';

const SLIDE_FROM_BOTTOM_SCREENS = [
  {name: 'CustomWebView', component: CustomWebView},
  {name: 'SendBTC', component: SendPaymentHome},
  {name: 'ReceiveBTC', component: ReceivePaymentHome},
  {name: 'ExpandedTx', component: ExpandedTx},
  {name: 'TechnicalTransactionDetails', component: TechnicalTransactionDetails},
  // {name: 'LiquidSettingsPage', component: LiquidSettingsPage},
  {
    name: 'EditReceivePaymentInformation',
    component: EditReceivePaymentInformation,
  },
  {name: 'SwitchReceiveOptionPage', component: SwitchReceiveOptionPage},
  {name: 'ViewAllTxPage', component: ViewAllTxPage},
  {name: 'CameraModal', component: CameraModal},
  {name: 'SwitchGenerativeAIModel', component: SwitchGenerativeAIModel},
];
const SLIDE_FROM_RIGHT_SCREENS = [
  {
    name: 'CreateAccountHome',
    component: CreateAccountHome,
    options: {gestureEnabled: true},
  },
  {name: 'SettingsHome', component: SettingsIndex},
  // {name: 'HistoricalOnChainPayments', component: HistoricalOnChainPayments},
  {name: 'ChooseContactHalfModal', component: ChooseContactHalfModal},
  {name: 'SettingsContentHome', component: SettingsContentIndex},
  {
    name: 'ConfirmPaymentScreen',
    component: SendPaymentScreen,
    options: {gestureEnabled: false},
  },
  {name: 'ExpandedContactsPage', component: ExpandedContactsPage},
  {name: 'MyContactProfilePage', component: MyContactProfilePage},
  {name: 'EditMyProfilePage', component: EditMyProfilePage},
  {name: 'ExpandedAddContactsPage', component: ExpandedAddContactsPage},
  {name: 'SendAndRequestPage', component: SendAndRequestPage},
  {name: 'AppStorePageIndex', component: AppStorePageIndex},
  {name: 'HistoricalSMSMessagingPage', component: HistoricalSMSMessagingPage},
  {name: 'HistoricalVPNPurchases', component: HistoricalVPNPurchases},
  {name: 'GeneratedVPNFile', component: GeneratedVPNFile},
  {name: 'POSInstructionsPath', component: POSInstructionsPath},
  {name: 'CreateGiftCardAccount', component: CreateGiftCardAccount},
  {name: 'GiftCardsPage', component: GiftCardPage},
  {name: 'CountryList', component: CountryList},
  {name: 'ExpandedGiftCardPage', component: ExpandedGiftCardPage},
  {name: 'HistoricalGiftCardPurchases', component: HistoricalGiftCardPurchases},
  // {name: 'ManualSwapPopup', component: ManualSwapPopup},
  {name: 'ViewPOSTransactions', component: ViewPOSTransactions},
  // {name: 'LspDescriptionPopup', component: LspDescriptionPopup},
  {name: 'DisclaimerPage', component: DislaimerPage},
  {name: 'GenerateKey', component: GenerateKey},
  {name: 'PinSetup', component: PinSetupPage},
  {name: 'RestoreWallet', component: RestoreWallet},
  // {name: 'EcashSettings', component: EcashSettings},
  {name: 'AddPOSItemsPage', component: AddPOSItemsPage},
  {name: 'CreateCustodyAccount', component: CreateCustodyAccountPage},
  {name: 'ViewCustodyAccount', component: ViewCustodyAccountPage},
  {name: 'CustodyAccountPaymentPage', component: AccountPaymentPage},
  {name: 'NosterWalletConnect', component: NosterWalletConnect},
  {name: 'CreateNostrConnectAccount', component: CreateNostrConnectAccount},
  // {name: 'NWCWallet', component: NWCWallet},
  {name: 'NWCWalletSetup', component: NWCWalletSetup},
  {name: 'SparkSettingsPage', component: SparkSettingsPage},
  {name: 'Nip5VerificationPage', component: Nip5VerificationPage},
  {name: 'SelectGiftCardForContacts', component: SelectGiftCardForContacts},
  {name: 'SMSMessagingReceivedPage', component: SMSMessagingReceivedPage},
  {name: 'SMSMessagingSendPage', component: SMSMessagingSendPage},
];

const FADE_SCREENS = [
  {name: 'CustomHalfModal', component: CustomHalfModal},
  {name: 'ConfirmActionPage', component: ConfirmActionPage},
  {name: 'ConfirmLeaveChatGPT', component: ConfirmLeaveChatGPT},
  {name: 'ClipboardCopyPopup', component: ClipboardCopyPopup},
  {name: 'ErrorScreen', component: ErrorScreen},
  {name: 'SparkErrorScreen', component: SparkErrorScreen},
  // {name: 'ExplainBalanceScreen', component: ExplainBalanceScreen},
  {name: 'GiftCardOrderDetails', component: GiftCardOrderDetails},
  {
    name: 'ContactsPageLongPressActions',
    component: ContactsPageLongPressActions,
  },
  // {name: 'RestoreProofsPopup', component: RestoreProofsPopup},
  // {name: 'MigrateProofsPopup', component: MigrateProofsPopup},
  {name: 'AddOrDeleteContactImage', component: AddOrDeleteContactImage},
  {
    name: 'SkipCreateAccountPathMessage',
    component: SkipCreateAccountPathMessage,
  },
  {name: 'InformationPopup', component: InformationPopup},
  {name: 'ConfirmTxPage', component: ConfirmTxPage},
  {
    name: 'HomeAdmin',
    component: AdminHomeIndex,
    options: {gestureEnabled: false},
  },
  // {
  //   name: 'ViewCustodyKey',
  //   component: ViewCustodyKey,
  // },
  {name: 'ConfirmPinForLoginMode', component: ConfirmPinForLoginMode},
  {name: 'ViewSMSReceiveCode', component: ViewSmsReceiveCode},
  {name: 'ConfirmSMSReceivePage', component: ConfirmSMSReceivePage},
  {name: 'RoostockSwapInfo', component: RoostockSwapInfo},
];
const FADE_TRANSPARENT_MODAL_SCREENS = [
  {
    name: 'TotalTipsScreen',
    component: TotalTipsScreen,
  },
  // {
  //   name: 'RefundLiquidSwapPopup',
  //   component: RefundLiquidSwapPopup,
  // },
];

export {
  SLIDE_FROM_BOTTOM_SCREENS,
  SLIDE_FROM_RIGHT_SCREENS,
  FADE_SCREENS,
  FADE_TRANSPARENT_MODAL_SCREENS,
};
