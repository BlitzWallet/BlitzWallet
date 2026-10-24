import { useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../../context-store/theme';
import CustomSearchInput from '../../../functions/CustomElements/searchInput';
import ThemeIcon from '../../../functions/CustomElements/themeIcon';

// Web password field in the redesign look: r16, 52 high, surface fill, 44
// show/hide eye inset 4 (audit/design OnboardingWeb + LoginWeb).
export default function PasswordField({
  value,
  onChangeText,
  placeholder,
  autoComplete,
  textContentType,
  onSubmitEditing,
}) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  return (
    <CustomSearchInput
      inputText={value}
      setInputText={onChangeText}
      placeholderText={placeholder}
      placeholderTextColor={tokens.muted}
      secureTextEntry={!show}
      autoComplete={autoComplete}
      textContentType={textContentType}
      onSubmitEditingFunction={onSubmitEditing}
      textAlignVertical="center"
      textInputStyles={{
        ...styles.input,
        color: tokens.onField,
        backgroundColor: tokens.field,
      }}
      buttonComponent={
        <TouchableOpacity
          style={styles.eye}
          onPress={() => setShow(prev => !prev)}
          accessibilityRole="button"
          accessibilityLabel={
            show
              ? t('createAccount.keySetup.password.hidePassword')
              : t('createAccount.keySetup.password.showPassword')
          }
        >
          <ThemeIcon
            redesign
            iconName={show ? 'Eye' : 'EyeOff'}
            size={20}
            colorOverride={tokens.muted}
          />
        </TouchableOpacity>
      }
    />
  );
}

const styles = StyleSheet.create({
  input: {
    height: 52,
    borderRadius: 16,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 16,
    paddingRight: 56,
    fontSize: 15,
    lineHeight: 22,
  },
  eye: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
