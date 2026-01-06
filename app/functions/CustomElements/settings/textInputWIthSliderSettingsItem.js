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
    minHeight: 60,
    width: '100%',
    borderRadius: 8,
    paddingVertical: 10,
    marginVertical: 20,
    justifyContent: 'center',
  },
  titleStyle: { includeFontPadding: false, flex: 1, marginRight: 5 },
  sliderContianer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    paddingRight: 10,
    paddingBottom: 10,
    marginBottom: 10,
    marginLeft: 10,
    borderBottomWidth: 1,
  },
  textContainer: {
    paddingRight: 10,
    marginLeft: 10,
  },
  textInput: {
    maxWidth: '50%',
    padding: 10,
    borderRadius: 8,
    fontSize: SIZES.medium,
    fontFamily: FONT.Title_Regular,
    includeFontPadding: false,
  },

  container: {
    width: '100%',
  },
  labelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 5,
  },

  slider: {
    width: '100%',
    height: 40,
    marginTop: 20,
  },
});
