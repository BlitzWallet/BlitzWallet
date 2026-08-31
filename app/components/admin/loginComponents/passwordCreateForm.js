import { useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SIZES } from '../../../constants';
import { ThemeText } from '../../../functions/CustomElements';
import CustomSearchInput from '../../../functions/CustomElements/searchInput';
import CustomButton from '../../../functions/CustomElements/button';
import { useTranslation } from 'react-i18next';
import {
  MIN_PASSWORD_LENGTH,
  getPasswordStrength,
} from '../../../functions/passwordStrength';
import { WINDOWWIDTH } from '../../../constants/theme';

export default function PasswordCreateForm({
  headerText,
  subtitleText,
  buttonText,
  onSubmit,
  isSubmitting,
}) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const canSubmit =
    password.length >= MIN_PASSWORD_LENGTH &&
    password === confirm &&
    !isSubmitting;

  // On web go through the DOM form submit so the browser offers to save the
  // password; the form's onSubmit re-checks canSubmit before calling onSubmit.
  const submit = () => {
    onSubmit(password);
  };

  return (
    <View style={styles.container}>
      <ThemeText styles={styles.header} content={headerText} />
      {subtitleText ? (
        <ThemeText styles={styles.subtitle} content={subtitleText} />
      ) : null}

      <View style={styles.inputWrapper}>
        <CustomSearchInput
          inputText={password}
          setInputText={setPassword}
          placeholderText={t(
            'createAccount.keySetup.password.newPasswordPlaceholder',
          )}
          secureTextEntry={true}
          autoComplete="new-password"
          textContentType="newPassword"
        />
      </View>

      <View style={styles.meterRow}>
        <View style={styles.meterBarContainer}>
          {[0, 1, 2, 3, 4].map(i => (
            <View
              key={i}
              style={[
                styles.meterSegment,
                {
                  backgroundColor:
                    strength.score >= i && password.length
                      ? getMeterColor(strength.score)
                      : '#ccc',
                },
              ]}
            />
          ))}
        </View>
        <ThemeText
          styles={styles.meterLabel}
          content={
            password.length === 0
              ? ''
              : strength.label +
                (strength.isCommon
                  ? ` — ${t(
                      'createAccount.keySetup.password.commonWarning',
                      'Common password',
                    )}`
                  : '')
          }
        />
      </View>

      <View style={styles.inputWrapper}>
        <CustomSearchInput
          inputText={confirm}
          setInputText={setConfirm}
          placeholderText={t(
            'createAccount.keySetup.password.confirmPasswordPlaceholder',
          )}
          secureTextEntry={true}
          autoComplete="new-password"
          textContentType="newPassword"
        />
      </View>

      {confirm.length > 0 && password !== confirm ? (
        <ThemeText
          styles={styles.errorText}
          content={t('createAccount.keySetup.password.mismatchError')}
        />
      ) : null}

      <View style={styles.buttonContainer}>
        <CustomButton
          textContent={buttonText}
          actionFunction={submit}
          disabled={!canSubmit}
          useLoading={isSubmitting}
        />
      </View>
    </View>
  );
}

function getMeterColor(score) {
  if (score === 0) return '#e74c3c';
  if (score === 1) return '#e74c3c';
  if (score === 2) return '#f39c12';
  if (score === 3) return '#3498db';
  return '#27ae60';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: WINDOWWIDTH,
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
  inputWrapper: {
    width: '100%',
    marginTop: 20,
  },
  meterRow: {
    width: '100%',
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  meterBarContainer: {
    flexDirection: 'row',
    gap: 4,
    flex: 1,
    marginRight: 10,
  },
  meterSegment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  meterLabel: {
    fontSize: SIZES.small,
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
});
