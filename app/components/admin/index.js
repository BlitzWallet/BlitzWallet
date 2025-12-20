import { ConfirmLeaveChatGPT } from './homeComponents/apps';
import AddChatGPTCredits from './homeComponents/apps/chatGPT/addCreditsPage';
import CameraModal from './homeComponents/cameraModal';
import ClipboardCopyPopup from './homeComponents/confirmClipboard';
import {
  ContactsPage,
  EditMyProfilePage,
  ExpandedContactsPage,
  // MyContactProfilePage,
  SendAndRequestPage,
} from './homeComponents/contacts';
import AddOrDeleteContactImage from './homeComponents/contacts/internalComponents/addOrDeleteImageScreen';
import ContactsPageLongPressActions from './homeComponents/contacts/internalComponents/contactsPageLongPressActions';
import ErrorScreen from './homeComponents/errorScreen';
import HomeLightning from './homeComponents/homeLightning';
import HalfModalSendOptions from './homeComponents/homeLightning/halfModalSendOptions';
import { SendRecieveBTNs } from './homeComponents/homeLightning/sendReciveBTNs';
import { UserSatAmount } from './homeComponents/homeLightning/userSatAmount';

import NavBar from './homeComponents/navBar';
import {
  ButtonsContainer,
  EditReceivePaymentInformation,
} from './homeComponents/receiveBitcoin';
import SwitchReceiveOptionPage from './homeComponents/receiveBitcoin/switchReceiveOptionPage';

import SendPaymentScreen from './homeComponents/sendBitcoin/sendPaymentScreen';

import {
  AboutPage,
  BlitzSocialOptions,
  ConfirmActionPage,
  DisplayOptions,
  FiatCurrencyPage,
  NosterWalletConnect,
  ResetPage,
  SeedPhrasePage,
} from './homeComponents/settingsContent';
import PinPage from './loginComponents/pinPage';

export {
  NavBar,
  HomeLightning,
  CameraModal,
  BlitzSocialOptions,
  SeedPhrasePage,
  ResetPage,
  NosterWalletConnect,
  FiatCurrencyPage,
  DisplayOptions,
  AboutPage,
  ConfirmActionPage,
  SendPaymentScreen,
  ButtonsContainer,
  EditReceivePaymentInformation,
  SwitchReceiveOptionPage,
  SendRecieveBTNs,
  UserSatAmount,
  PinPage,
  ClipboardCopyPopup,
  HalfModalSendOptions,
  ExpandedContactsPage,
  EditMyProfilePage,
  // MyContactProfilePage,
  SendAndRequestPage,
  ErrorScreen,
  ConfirmLeaveChatGPT,
  AddChatGPTCredits,
  ContactsPage,
  ContactsPageLongPressActions,
  AddOrDeleteContactImage,
};
