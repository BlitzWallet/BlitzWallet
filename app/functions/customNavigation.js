import {Keyboard} from 'react-native';
import {KEYBOARDTIMEOUT} from '../constants/styles';

export function keyboardGoBack(navigate) {
  Keyboard.dismiss();
  setTimeout(navigate.goBack, Keyboard.isVisible() ? KEYBOARDTIMEOUT : 0);
}

export function keyboardNavigate(navigatorFunction) {
  Keyboard.dismiss();
  setTimeout(navigatorFunction, Keyboard.isVisible() ? KEYBOARDTIMEOUT : 0);
}
