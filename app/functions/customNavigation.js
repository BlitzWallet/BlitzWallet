import { KeyboardController } from 'react-native-keyboard-controller';

export async function keyboardGoBack(navigate) {
  await KeyboardController.dismiss();
  setTimeout(navigate.goBack, KeyboardController.isVisible() ? 60 : 0);
}

export async function keyboardNavigate(navigatorFunction) {
  await KeyboardController.dismiss();
  setTimeout(navigatorFunction, KeyboardController.isVisible() ? 60 : 0);
}
