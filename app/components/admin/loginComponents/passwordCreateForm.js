import { createElement, useState } from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

const AUTOSAVE_USERNAME = 'blitzwallet';
import { COLORS, SIZES } from '../../../constants';
import { ThemeText } from '../../../functions/CustomElements';
import CustomSearchInput from '../../../functions/CustomElements/searchInput';
import ThemeIcon from '../../../functions/CustomElements/themeIcon';
import { useGlobalThemeContext } from '../../../../context-store/theme';
import CustomButton from '../../../functions/CustomElements/button';
import { useTranslation } from 'react-i18next';
import { HIDDEN_OPACITY, INSET_WINDOW_WIDTH } from '../../../constants/theme';
import GetThemeColors from '../../../hooks/themeColors';
import { openBrowserAsync } from 'expo-web-browser';
import { useNavigation } from '@react-navigation/native';

export default function PasswordCreateForm({
  headerText,
  subtitleText,
  buttonText,
  onSubmit,
  isSubmitting,
}) {
  const { textInputBackground, backgroundColor } = GetThemeColors();
  const navigate = useNavigation();
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { theme, darkModeType } = useGlobalThemeContext();

  const doesMatch = password === confirm;

  const canSubmit = doesMatch && !isSubmitting && !!password.length;

  const submit = () => {
    if (isSubmitting) return;
    if (password.length && !doesMatch) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t('createAccount.keySetup.password.mismatchError'),
      });
      return;
    }
    if (!canSubmit) return;
    onSubmit(password);
  };

  return (
    <View style={styles.container}>
      <ThemeText styles={styles.header} content={headerText} />
      {subtitleText ? (
        <ThemeText styles={styles.subtitle} content={subtitleText} />
      ) : null}

      {/* Hidden username field so the browser saves the credential under
          "blitzwallet" instead of guessing. Web only. */}
      {Platform.OS === 'web'
        ? createElement('input', {
            type: 'text',
            name: 'username',
            autoComplete: 'username',
            value: AUTOSAVE_USERNAME,
            readOnly: true,
            'aria-hidden': true,
            tabIndex: -1,
            style: {
              position: 'absolute',
              width: 1,
              height: 1,
              opacity: 0,
              pointerEvents: 'none',
            },
          })
        : null}

      <View
        style={[styles.inputWrapper, { backgroundColor: textInputBackground }]}
      >
        <CustomSearchInput
          inputText={password}
          setInputText={setPassword}
          placeholderText={t(
            'createAccount.keySetup.password.newPasswordPlaceholder',
          )}
          secureTextEntry={!showPassword}
          autoComplete="new-password"
          textContentType="newPassword"
          containerStyles={styles.eyeInputContainer}
          textInputStyles={styles.eyeInputText}
          buttonComponent={
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword(prev => !prev)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={
                showPassword
                  ? t('createAccount.keySetup.password.hidePassword')
                  : t('createAccount.keySetup.password.showPassword')
              }
            >
              <ThemeIcon
                iconName={showPassword ? 'EyeOff' : 'Eye'}
                size={22}
                colorOverride={
                  theme && !darkModeType
                    ? COLORS.darkModePlaceholder
                    : COLORS.lightModePlaceholder
                }
              />
            </TouchableOpacity>
          }
        />
        <View style={[styles.divider, { backgroundColor }]} />
        <CustomSearchInput
          inputText={confirm}
          setInputText={setConfirm}
          placeholderText={t(
            'createAccount.keySetup.password.confirmPasswordPlaceholder',
          )}
          secureTextEntry={!showPassword}
          autoComplete="new-password"
          textContentType="newPassword"
        />
      </View>

      <TouchableOpacity
        onPress={() =>
          openBrowserAsync(
            'https://www.nist.gov/cybersecurity-and-privacy/how-do-i-create-good-password?utm_source=chatgpt.com',
          )
        }
      >
        <ThemeText
          styles={styles.strongPassword}
          content={t('createAccount.keySetup.password.whatMakesStrongPassword')}
        />
      </TouchableOpacity>
      <View style={styles.buttonContainer}>
        <CustomButton
          textContent={buttonText}
          actionFunction={submit}
          buttonStyles={{ opacity: canSubmit ? 1 : HIDDEN_OPACITY }}
          useLoading={isSubmitting}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: INSET_WINDOW_WIDTH,
  },
  header: {
    fontSize: SIZES.large,
    fontWeight: '500',
    includeFontPadding: false,
    marginTop: 28,
    marginBottom: 8,
  },
  subtitle: {
    opacity: 0.6,
    fontSize: SIZES.smedium,
    lineHeight: 22,
    marginBottom: 20,
  },
  requirements: {
    opacity: 0.6,
    fontSize: SIZES.smedium,
    lineHeight: 22,
    marginBottom: 8,
  },
  inputWrapper: {
    width: '100%',
    marginTop: 20,
    borderRadius: 8,
    overflow: 'hidden',
  },
  eyeInputContainer: {
    justifyContent: 'center',
  },
  eyeInputText: {
    paddingRight: 45,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
  },
  meterRow: {
    width: '100%',
    marginTop: 8,
  },
  meterBarContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  meterSegment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  meterLabel: {
    fontSize: SIZES.small,
    marginTop: 8,
  },
  divider: {
    height: 1,
    width: '100%',
    backgroundColor: 'red',
    marginLeft: 10,
  },
  errorText: {
    fontSize: SIZES.small,
    color: '#e74c3c',
    marginTop: 4,
  },
  buttonContainer: {
    marginTop: 'auto',
    width: '100%',
  },
  strongPassword: {
    paddingVertical: 10,
    textAlign: 'center',
    opacity: HIDDEN_OPACITY,
    fontSize: SIZES.smedium,
  },
});
