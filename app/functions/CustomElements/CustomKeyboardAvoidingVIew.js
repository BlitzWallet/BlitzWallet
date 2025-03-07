import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import GlobalThemeView from './globalThemeView';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ANDROIDSAFEAREA} from '../../constants/styles';
import {CONTENT_KEYBOARD_OFFSET} from '../../constants';

export default function CustomKeyboardAvoidingView({
  children,
  globalThemeViewStyles,
  useStandardWidth,
  useTouchableWithoutFeedback,
  touchableWithoutFeedbackFunction,
  isKeyboardActive,
  useLocalPadding = false,
}) {
  const insets = useSafeAreaInsets();
  const paddingBottom = Platform.select({
    ios: insets.bottom,
    android: ANDROIDSAFEAREA,
  });

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
                  : paddingBottom
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
                : paddingBottom
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
