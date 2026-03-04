import { Keyboard, StyleSheet, TextInput, View } from 'react-native';
import ThemeText from '../textTheme';
import { useCallback, useEffect, useState } from 'react';
import GetThemeColors from '../../../hooks/themeColors';
import CustomToggleSwitch from '../switch';
import { COLORS, FONT, SIZES } from '../../../constants';
import { useGlobalThemeContext } from '../../../../context-store/theme';

export default function TextInputWithSliderSettingsItem({
  sliderTitle = '',
  settingInputTitle = '',
  settingDescription = '',
  defaultTextInputValue,
  handleSubmit,
  CustomToggleSwitchFunction,
  switchStateValue,
  switchPage,
}) {
  const { theme } = useGlobalThemeContext();
  const [inputValue, setInputValue] = useState(undefined);
  const [isFocused, setIsFocused] = useState(false);
  const { backgroundOffset, backgroundColor, textColor } = GetThemeColors();

  const resetInputValue = useCallback(() => {
    setInputValue(String(defaultTextInputValue));
  }, [defaultTextInputValue]);

  const handleEndEditing = useCallback(() => {
    if (!inputValue) {
      resetInputValue();
      return;
    }
    if (inputValue == defaultTextInputValue) {
      resetInputValue();
      return;
    }
    if (!handleSubmit) {
      resetInputValue();
      return;
    }
    handleSubmit(inputValue, resetInputValue);
  }, [inputValue, defaultTextInputValue, handleSubmit, resetInputValue]);

  useEffect(() => {
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        if (isFocused) {
          handleEndEditing();
          setIsFocused(false);
        }
      },
    );

    return () => {
      keyboardDidHideListener.remove();
    };
  }, [isFocused, handleEndEditing]);

  return (
    <View
      style={[
        styles.contentContainer,
        {
          backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
        },
      ]}
    >
      <View
        style={[styles.sliderContianer, { borderBottomColor: backgroundColor }]}
      >
        <ThemeText
          CustomNumberOfLines={1}
          styles={styles.titleStyle}
          content={sliderTitle}
        />
        <CustomToggleSwitch
          page={switchPage}
          toggleSwitchFunction={CustomToggleSwitchFunction}
          stateValue={switchStateValue}
        />
      </View>
      <View style={[styles.sliderContianer, { borderBottomWidth: 0 }]}>
        <ThemeText
          CustomNumberOfLines={1}
          styles={styles.titleStyle}
          content={settingInputTitle}
        />
        <TextInput
          keyboardAppearance={theme ? 'dark' : 'light'}
          value={inputValue}
          defaultValue={String(defaultTextInputValue)}
          onChangeText={setInputValue}
          keyboardType="number-pad"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onEndEditing={handleEndEditing}
          style={[styles.textInput, { backgroundColor, color: textColor }]}
        />
      </View>
      <View style={styles.textContainer}>
        <ThemeText content={settingDescription} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
  },
  titleStyle: {
    includeFontPadding: false,
    flex: 1,
    marginRight: 8,
  },
  sliderContianer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 56,
    borderBottomWidth: 1,
  },
  textContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  textInput: {
    maxWidth: '50%',
    padding: 8,
    borderRadius: 8,
    fontSize: SIZES.medium,
    fontFamily: FONT.Title_Regular,
    includeFontPadding: false,
  },
});
