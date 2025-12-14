import { Keyboard, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import GlobalThemeView from './globalThemeView';
import { CONTENT_KEYBOARD_OFFSET } from '../../constants';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useGlobalInsets } from '../../../context-store/insetsProvider';
import { useCallback, useMemo } from 'react';

export default function CustomKeyboardAvoidingView({
  children,
  globalThemeViewStyles,
  useStandardWidth,
  useTouchableWithoutFeedback,
  touchableWithoutFeedbackFunction,
  isKeyboardActive,
  useLocalPadding = false,
}) {
  const { bottomPadding } = useGlobalInsets();

  const memoizedStyles = useMemo(() => {
    return {
      paddingBottom: useLocalPadding
        ? isKeyboardActive
          ? CONTENT_KEYBOARD_OFFSET
          : bottomPadding
        : 0,
      ...globalThemeViewStyles,
    };
  }, [useLocalPadding, isKeyboardActive, bottomPadding, globalThemeViewStyles]);

  const touchableOnPress = useCallback(() => {
    if (touchableWithoutFeedbackFunction) {
      touchableWithoutFeedbackFunction();
      return;
    }
    Keyboard.dismiss();
  }, [touchableWithoutFeedbackFunction]);

  if (useTouchableWithoutFeedback) {
    return (
      <TouchableWithoutFeedback onPress={touchableOnPress}>
        <KeyboardAvoidingView
          behavior={'padding'}
          style={styles.globalContainer}
        >
          <GlobalThemeView
            styles={memoizedStyles}
            useStandardWidth={useStandardWidth}
          >
            {children}
          </GlobalThemeView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    );
  }

  return (
    <KeyboardAvoidingView behavior={'padding'} style={styles.globalContainer}>
      <GlobalThemeView
        styles={memoizedStyles}
        useStandardWidth={useStandardWidth}
      >
        {children}
      </GlobalThemeView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  globalContainer: {
    flex: 1,
  },
});
