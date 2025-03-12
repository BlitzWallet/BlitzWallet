import {Keyboard} from 'react-native';
import {KEYBOARDTIMEOUT} from '../constants/styles';

export function keyboardGoBack(navigate) {
  Keyboard.dismiss();
  setTimeout(navigate.goBack, Keyboard.isVisible() ? KEYBOARDTIMEOUT : 0);
}
