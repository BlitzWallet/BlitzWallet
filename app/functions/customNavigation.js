import { Keyboard } from 'react-native';
import { KEYBOARDTIMEOUT } from '../constants/styles';

export function keyboardGoBack(navigate) {
  setTimeout(navigate.goBack, Keyboard.isVisible() ? KEYBOARDTIMEOUT : 0);
  Keyboard.dismiss();
}

export function keyboardNavigate(navigatorFunction) {
  setTimeout(navigatorFunction, Keyboard.isVisible() ? KEYBOARDTIMEOUT : 0);
  Keyboard.dismiss();
}
