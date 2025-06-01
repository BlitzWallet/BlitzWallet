import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import GlobalThemeView from './globalThemeView';
import {CONTENT_KEYBOARD_OFFSET} from '../../constants';
import useAppInsets from '../../hooks/useAppInsets';

export default function CustomKeyboardAvoidingView({
  children,
  globalThemeViewStyles,
  useStandardWidth,
  useTouchableWithoutFeedback,
  touchableWithoutFeedbackFunction,
  isKeyboardActive,
  useLocalPadding = false,
}) {
  const {bottomPadding} = useAppInsets();

  return (
    <KeyboardAvoidingView
      style={{
        flex: 1,
      }}
      behavior={Platform.OS === 'ios' ? 'padding' : null}>
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
