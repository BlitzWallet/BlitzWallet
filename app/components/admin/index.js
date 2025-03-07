import {ConfirmLeaveChatGPT} from './homeComponents/apps';
import AddChatGPTCredits from './homeComponents/apps/chatGPT/addCreditsPage';
import CameraModal from './homeComponents/cameraModal';
import ClipboardCopyPopup from './homeComponents/confirmClipboard';
import {
  ContactsPage,
  EditMyProfilePage,
  ExpandedContactsPage,
  MyContactProfilePage,
  SendAndRequestPage,
} from './homeComponents/contacts';
import {
  GivawayHome,
  AutomatedPayments,
} from './homeComponents/contacts/automatedPayments/index.js';
import AddOrDeleteContactImage from './homeComponents/contacts/internalComponents/addOrDeleteImageScreen';
import ContactsPageLongPressActions from './homeComponents/contacts/internalComponents/contactsPageLongPressActions';
import ErrorScreen from './homeComponents/errorScreen';
import HomeLightning from './homeComponents/homeLightning';
import HalfModalSendOptions from './homeComponents/homeLightning/halfModalSendOptions';
import LiquidityIndicator from './homeComponents/homeLightning/liquidityIndicator';
import {SendRecieveBTNs} from './homeComponents/homeLightning/sendReciveBTNs';
import {UserSatAmount} from './homeComponents/homeLightning/userSatAmount';

import NavBar from './homeComponents/navBar';
import {
  ButtonsContainer,
  EditReceivePaymentInformation,
} from './homeComponents/receiveBitcoin';
import SwitchReceiveOptionPage from './homeComponents/receiveBitcoin/switchReceiveOptionPage';

import SendPaymentScreen from './homeComponents/sendBitcoin/sendPaymentScreen';

import {
  AboutPage,
  BiometricLoginPage,
  BlitzSocialOptions,
  ConfirmActionPage,
  DisplayOptions,
  FiatCurrencyPage,
  LSPPage,
  LspDescriptionPopup,
  NodeInfo,
  NosterWalletConnect,
  RefundFailedLiquidSwaps,
  ResetPage,
  SeedPhrasePage,
  SendOnChainBitcoin,
  UserBalanceDenomination,
} from './homeComponents/settingsContent';
import LiquidSettingsPage from './homeComponents/settingsContent/bankComponents/settingsPage';
import HasNWCAccount from './homeComponents/settingsContent/nwc/hasAccount';
import NoNWCAccount from './homeComponents/settingsContent/nwc/noAccount';
import PinPage from './loginComponents/pinPage';

export {
  NavBar,
  HomeLightning,
  CameraModal,
  BlitzSocialOptions,
  SendOnChainBitcoin,
  SeedPhrasePage,
  ResetPage,
  RefundFailedLiquidSwaps,
  NosterWalletConnect,
  NodeInfo,
  LSPPage,
  FiatCurrencyPage,
  DisplayOptions,
  BiometricLoginPage,
  AboutPage,
  UserBalanceDenomination,
  ConfirmActionPage,
  LspDescriptionPopup,
  HasNWCAccount,
  NoNWCAccount,
  SendPaymentScreen,
  // RefundBitcoinTransactionPage,
  ButtonsContainer,
  EditReceivePaymentInformation,
  SwitchReceiveOptionPage,
  // ViewInProgressSwap,
  LiquidityIndicator,
  SendRecieveBTNs,
  UserSatAmount,
  // HomeLogin,
  PinPage,
  ClipboardCopyPopup,
  HalfModalSendOptions,
  ExpandedContactsPage,
  EditMyProfilePage,
  MyContactProfilePage,
  SendAndRequestPage,
  ErrorScreen,
  AutomatedPayments,
  ConfirmLeaveChatGPT,
  AddChatGPTCredits,
  ContactsPage,
  // ConfirmAddContact,
  ContactsPageLongPressActions,
  LiquidSettingsPage,
  AddOrDeleteContactImage,
};
