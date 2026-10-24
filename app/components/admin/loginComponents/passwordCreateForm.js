import { createElement, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

const AUTOSAVE_USERNAME = 'blitzwallet';
// New passwords only. Unlock and legacy migration accept any existing
// password, so wallets created before this minimum still open.
export const MIN_PASSWORD_LENGTH = 6;
import { FONT } from '../../../constants';
import { ThemeText } from '../../../functions/CustomElements';
import CustomButton from '../../../functions/CustomElements/button';
import TextButton from '../../../functions/CustomElements/redesign/TextButton';
import { useTranslation } from 'react-i18next';
import { HIDDEN_OPACITY, INSET_WINDOW_WIDTH } from '../../../constants/theme';
import { useTheme } from '../../../../context-store/theme';
import { openBrowserAsync } from 'expo-web-browser';
import PasswordField from './passwordField';

export default function PasswordCreateForm({
  headerText,
  subtitleText,
  buttonText,
  onSubmit,
  isSubmitting,
}) {
  const { tokens } = useTheme();
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const doesMatch = password === confirm;

  const isLongEnough = password.length >= MIN_PASSWORD_LENGTH;

  const canSubmit = doesMatch && !isSubmitting && isLongEnough;

  const edit = setValue => value => {
    setValue(value);
    setError('');
  };

  const submit = () => {
    if (isSubmitting) return;
    if (password.length && !isLongEnough) {
      setError(
        t('createAccount.keySetup.password.tooShortError', {
          count: MIN_PASSWORD_LENGTH,
        }),
      );
      return;
    }
    if (password.length && !doesMatch) {
      setError(t('createAccount.keySetup.password.mismatchError'));
      return;
    }
    if (!canSubmit) return;
    onSubmit(password);
  };

  return (
    <View style={styles.container}>
      <ThemeText styles={styles.header} content={headerText} />
      {subtitleText ? (
        <ThemeText
          variant="body"
          styles={[styles.subtitle, { color: tokens.muted }]}
          content={subtitleText}
        />
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

      <View style={styles.fields}>
        <PasswordField
          value={password}
          onChangeText={edit(setPassword)}
          placeholder={t(
            'createAccount.keySetup.password.newPasswordPlaceholder',
          )}
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <PasswordField
          value={confirm}
          onChangeText={edit(setConfirm)}
          placeholder={t(
            'createAccount.keySetup.password.confirmPasswordPlaceholder',
          )}
          autoComplete="new-password"
          textContentType="newPassword"
        />
      </View>
      {!!error && (
        <ThemeText
          variant="body"
          styles={[styles.errorText, { color: tokens.danger }]}
          content={error}
        />
      )}

      <TextButton
        text={t('createAccount.keySetup.password.whatMakesStrongPassword')}
        paddingHorizontal={0}
        onPress={() =>
          openBrowserAsync(
            'https://www.nist.gov/cybersecurity-and-privacy/how-do-i-create-good-password?utm_source=chatgpt.com',
            { windowFeatures: { noopener: true, noreferrer: true } },
          )
        }
      />
      <View style={styles.buttonContainer}>
        <CustomButton
          size="regular"
          tone="primary"
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
  },
  header: {
    fontFamily: FONT.Title_Medium,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.56,
    includeFontPadding: false,
    marginTop: 28,
  },
  subtitle: {
    marginTop: 8,
  },
  fields: {
    marginTop: 28,
    gap: 10,
  },
  errorText: {
    marginTop: 8,
  },
  buttonContainer: {
    marginTop: 'auto',
    width: '100%',
  },
});
