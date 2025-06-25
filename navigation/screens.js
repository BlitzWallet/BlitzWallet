import {
  AddOrDeleteContactImage,
  CameraModal,
  ClipboardCopyPopup,
  ContactsPageLongPressActions,
  EditReceivePaymentInformation,
  ErrorScreen,
  LiquidSettingsPage,
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
import HistoricalSMSMessagingPage from '../app/components/admin/homeComponents/apps/sms4sats/sentPayments';
import {
  ChooseContactHalfModal,
  EditMyProfilePage,
  ExpandedAddContactsPage,
  ExpandedContactsPage,
  MyContactProfilePage,
  SendAndRequestPage,
} from '../app/components/admin/homeComponents/contacts';
import ExplainBalanceScreen from '../app/components/admin/homeComponents/sendBitcoin/components/balanceExplainerScreen';
import {
  ConfirmActionPage,
  HistoricalOnChainPayments,
  LspDescriptionPopup,
  TotalTipsScreen,
  ViewPOSTransactions,
} from '../app/components/admin/homeComponents/settingsContent';
import EcashSettings from '../app/components/admin/homeComponents/settingsContent/experimentalComponents/ecashSettings';
import MigrateProofsPopup from '../app/components/admin/homeComponents/settingsContent/experimentalComponents/migrateProofsPopup';
import RestoreProofsPopup from '../app/components/admin/homeComponents/settingsContent/experimentalComponents/restoreProofsPopup';
import RefundLiquidSwapPopup from '../app/components/admin/homeComponents/settingsContent/failedLiquidSwapsComponents/refundSwapPopup';
import AddPOSItemsPage from '../app/components/admin/homeComponents/settingsContent/posPath/items/addPOSItemsPage';
import POSInstructionsPath from '../app/components/admin/homeComponents/settingsContent/posPath/posInstructionsPath';
import AccountInformationPage from '../app/components/admin/homeComponents/settingsContent/walletInfoComponents/AccountInformationPage';
import ManualSwapPopup from '../app/components/admin/homeComponents/settingsContent/walletInfoComponents/manualSwapPopup';
import {CustomWebView} from '../app/functions/CustomElements';
import CustomHalfModal from '../app/functions/CustomElements/halfModal';
import InformationPopup from '../app/functions/CustomElements/informationPopup';
import {
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
  {name: 'SettingsHome', component: SettingsIndex},
  {name: 'HistoricalOnChainPayments', component: HistoricalOnChainPayments},
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
  {name: 'AccountInformationPage', component: AccountInformationPage},
  {name: 'ViewPOSTransactions', component: ViewPOSTransactions},
  {name: 'LspDescriptionPopup', component: LspDescriptionPopup},
  {name: 'DisclaimerPage', component: DislaimerPage},
  {name: 'GenerateKey', component: GenerateKey},
  {name: 'PinSetup', component: PinSetupPage},
  {name: 'RestoreWallet', component: RestoreWallet},
  {name: 'EcashSettings', component: EcashSettings},
  {name: 'AddPOSItemsPage', component: AddPOSItemsPage},
];

const FADE_SCREENS = [
  {name: 'CustomHalfModal', component: CustomHalfModal},
  {name: 'ConfirmActionPage', component: ConfirmActionPage},
  {name: 'ConfirmLeaveChatGPT', component: ConfirmLeaveChatGPT},
  {name: 'ClipboardCopyPopup', component: ClipboardCopyPopup},
  {name: 'ErrorScreen', component: ErrorScreen},
  {name: 'ExplainBalanceScreen', component: ExplainBalanceScreen},
  {name: 'GiftCardOrderDetails', component: GiftCardOrderDetails},
  {
    name: 'ContactsPageLongPressActions',
    component: ContactsPageLongPressActions,
  },
  {name: 'RestoreProofsPopup', component: RestoreProofsPopup},
  {name: 'MigrateProofsPopup', component: MigrateProofsPopup},
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
];
const FADE_TRANSPARENT_MODAL_SCREENS = [
  {
    name: 'TotalTipsScreen',
    component: TotalTipsScreen,
  },
  {
    name: 'RefundLiquidSwapPopup',
    component: RefundLiquidSwapPopup,
  },
];

export {
  SLIDE_FROM_BOTTOM_SCREENS,
  SLIDE_FROM_RIGHT_SCREENS,
  FADE_SCREENS,
  FADE_TRANSPARENT_MODAL_SCREENS,
};
