import {Keyboard, Platform, TouchableWithoutFeedback} from 'react-native';
import GlobalThemeView from './globalThemeView';
import {CONTENT_KEYBOARD_OFFSET} from '../../constants';
import {KeyboardAvoidingView} from 'react-native-keyboard-controller';
import {useGlobalInsets} from '../../../context-store/insetsProvider';

export default function CustomKeyboardAvoidingView({
  children,
  globalThemeViewStyles,
  useStandardWidth,
  useTouchableWithoutFeedback,
  touchableWithoutFeedbackFunction,
  isKeyboardActive,
  useLocalPadding = false,
}) {
  const {bottomPadding} = useGlobalInsets();

  return (
    <KeyboardAvoidingView
      behavior={'padding'}
      style={{
        flex: 1,
      }}>
      {useTouchableWithoutFeedback ? (
        <TouchableWithoutFeedback
          onPress={() => {
            if (touchableWithoutFeedbackFunction) {
              touchableWithoutFeedbackFunction();
              return;
            }
            Keyboard.dismiss();
          }}>
          <GlobalThemeView
            styles={{
              paddingBottom: useLocalPadding
                ? isKeyboardActive
                  ? CONTENT_KEYBOARD_OFFSET
                  : bottomPadding
                : 0,
              ...globalThemeViewStyles,
            }}
            useStandardWidth={useStandardWidth}>
            {children}
          </GlobalThemeView>
        </TouchableWithoutFeedback>
      ) : (
        <GlobalThemeView
          styles={{
            paddingBottom: useLocalPadding
              ? isKeyboardActive
                ? CONTENT_KEYBOARD_OFFSET
                : bottomPadding
              : 0,
            ...globalThemeViewStyles,
          }}
          useStandardWidth={useStandardWidth}>
          {children}
        </GlobalThemeView>
      )}
    </KeyboardAvoidingView>
  );
}
