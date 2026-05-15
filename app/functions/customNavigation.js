import { KEYBOARDTIMEOUT } from '../constants/styles';
import { KeyboardController } from 'react-native-keyboard-controller';

export function keyboardGoBack(navigate) {
  setTimeout(
    navigate.goBack,
    KeyboardController.isVisible() ? KEYBOARDTIMEOUT : 0,
  );
  KeyboardController.dismiss();
}

export function keyboardNavigate(navigatorFunction) {
  setTimeout(
    navigatorFunction,
    KeyboardController.isVisible() ? KEYBOARDTIMEOUT : 0,
  );
  KeyboardController.dismiss();
}
