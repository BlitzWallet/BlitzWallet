import {StyleSheet, TextInput, View} from 'react-native';
import GetThemeColors from '../../../hooks/themeColors';
import {COLORS, FONT, SIZES} from '../../../constants';
import ThemeText from '../textTheme';
import {useCallback, useState} from 'react';
import {useGlobalThemeContext} from '../../../../context-store/theme';

export default function TextInputSettingsItem({
  settingInputTitle = '',
  settingDescription = '',
  defaultTextInputValue,
  handleSubmit,
  keyboardType = 'number-pad',
}) {
  const {theme} = useGlobalThemeContext();
  const [inputValue, setInputValue] = useState(undefined);
  const {backgroundOffset, backgroundColor, textColor} = GetThemeColors();
  const resetInputValue = useCallback(() => {
    setInputValue(String(defaultTextInputValue));
  }, [defaultTextInputValue]);

  return (
    <View
      style={[
        styles.contentContainer,
        {
          backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
        },
      ]}>
      <View
        style={[styles.sliderContianer, {borderBottomColor: backgroundColor}]}>
        <ThemeText
          CustomNumberOfLines={1}
          styles={{includeFontPadding: false, flex: 1}}
          content={settingInputTitle}
        />
        <TextInput
          keyboardAppearance={theme ? 'dark' : 'light'}
          value={inputValue}
          defaultValue={String(defaultTextInputValue)}
          onChangeText={setInputValue}
          keyboardType={keyboardType}
          onEndEditing={() => {
            if (!inputValue) return;
            if (inputValue == defaultTextInputValue) return;
            if (!handleSubmit) return;
            handleSubmit(inputValue, resetInputValue);
          }}
          style={[styles.textInput, {backgroundColor, color: textColor}]}
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
  sliderContianer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    paddingRight: 10,
    paddingBottom: 10,
    marginBottom: 10,
    marginLeft: 20,
    borderBottomWidth: 1,
  },
  textInput: {
    maxWidth: '50%',
    padding: 10,
    borderRadius: 8,
    fontSize: SIZES.medium,
    fontFamily: FONT.Title_Regular,
    includeFontPadding: false,
  },
  textContainer: {
    paddingRight: 10,
    marginLeft: 20,
  },
});
