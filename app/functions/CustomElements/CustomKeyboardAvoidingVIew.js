import {Keyboard, Platform, TouchableWithoutFeedback} from 'react-native';
import GlobalThemeView from './globalThemeView';
import {CONTENT_KEYBOARD_OFFSET} from '../../constants';
import {KeyboardAvoidingView} from 'react-native-keyboard-controller';
import {useGlobalInsets} from '../../../context-store/insetsProvider';
import {useMemo} from 'react';

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

  const memoizedStylesTochable = useMemo(() => {
    return {
      paddingBottom: useLocalPadding
        ? isKeyboardActive
          ? CONTENT_KEYBOARD_OFFSET
          : bottomPadding
        : 0,
      ...globalThemeViewStyles,
    };
  }, [useLocalPadding, isKeyboardActive, bottomPadding, globalThemeViewStyles]);

  const memoizedStylesNoTochable = useMemo(() => {
    return {
      paddingBottom: useLocalPadding
        ? isKeyboardActive
          ? CONTENT_KEYBOARD_OFFSET
          : bottomPadding
        : 0,
      ...globalThemeViewStyles,
    };
  }, [useLocalPadding, isKeyboardActive, bottomPadding, globalThemeViewStyles]);
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
            styles={memoizedStylesTochable}
            useStandardWidth={useStandardWidth}>
            {children}
          </GlobalThemeView>
        </TouchableWithoutFeedback>
      ) : (
        <GlobalThemeView
          styles={memoizedStylesNoTochable}
          useStandardWidth={useStandardWidth}>
          {children}
        </GlobalThemeView>
      )}
    </KeyboardAvoidingView>
  );
}
