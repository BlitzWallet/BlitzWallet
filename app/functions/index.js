import {getLocalStorageItem, setLocalStorageItem} from './localStorage';
// import RotatingAnimation from './rotatingAnimation';
import {retrieveData, terminateAccount, storeData} from './secureStore';

import shuffleArray from './shuffleArray';
import {
  hasHardware,
  hasSavedProfile,
  handleLogin,
} from './biometricAuthentication';
import formatBalanceAmount from './formatNumber';

import copyToClipboard from './copyToClipboard';
import {navigateToSendUsingClipboard, getQRImage} from './sendBitcoin';
import numberConverter from './numberConverter';
import {createAccountMnemonic} from './seed';

export {
  retrieveData,
  terminateAccount,
  storeData,
  createAccountMnemonic,
  shuffleArray,
  // RotatingAnimation,
  getLocalStorageItem,
  setLocalStorageItem,
  hasHardware,
  hasSavedProfile,
  handleLogin,
  formatBalanceAmount,
  copyToClipboard,
  navigateToSendUsingClipboard,
  getQRImage,
  numberConverter,
};
