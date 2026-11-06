import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { getLocalStorageItem, setLocalStorageItem } from '../../../functions';
import { ICONS, PERSISTED_LOGIN_COUNT_KEY } from '../../../constants';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../functions/CustomElements';
import TextButton from '../../../functions/CustomElements/redesign/TextButton';
import PasswordField from './passwordField';
import CustomButton from '../../../functions/CustomElements/button';
import { useNavigation } from '@react-navigation/native';
import factoryResetWallet from '../../../functions/factoryResetWallet';
import sha256Hash from '../../../functions/hash';
import { useKeysContext } from '../../../../context-store/keys';
import { decryptMnemonicWithPin } from '../../../functions/handleMnemonic';
import { getStoredPasskeyInfo } from '../../../functions/passkeyMnemonic';
import RNRestart from 'react-native-restart-newarch';
import { tintStyle } from '../../../functions/webTintColor';
import { Image } from 'expo-image';
import { useTheme } from '../../../../context-store/theme';

export default function PasswordPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [attemptCount, setAttemptCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setAccountMnemonic } = useKeysContext();
  const { t } = useTranslation();
  const navigate = useNavigation();
  const didNavigate = useRef(null);
  const isCheckingRef = useRef(false);
  const { tokens } = useTheme();

  useEffect(() => {
    async function loadPageInformation() {
      try {
        const persistedPinEnterCount = await getLocalStorageItem(
          PERSISTED_LOGIN_COUNT_KEY,
        ).then(v => {
          try {
            return JSON.parse(v) || 0;
          } catch {
            return 0;
          }
        });
        setAttemptCount(persistedPinEnterCount || 0);
      } catch (err) {
        console.log('Load password page information error', err);
      }
    }
    loadPageInformation();
  }, []);

  const handleWrongPassword = useCallback(async () => {
    // A stale password tab must never count attempts against a passkey wallet.
    // An unreadable envelope is not evidence of a wrong password either.
    try {
      if (await getStoredPasskeyInfo()) {
        window.location.reload();
        return;
      }
    } catch {
      setError(
        t(
          'adminLogin.passwordPage.storageError',
          'Unable to read wallet storage. Please try again.',
        ),
      );
      return;
    }
    if (attemptCount >= 7) {
      const deleted = await factoryResetWallet();
      if (deleted) {
        if (Platform.OS === 'web') window.location.reload();
        else RNRestart.restart();
      } else {
        navigate.navigate('ErrorScreen', {
          errorMessage: t('errormessages.deleteAccount'),
        });
      }
    } else {
      const next = attemptCount + 1;
      setLocalStorageItem(PERSISTED_LOGIN_COUNT_KEY, JSON.stringify(next));
      setAttemptCount(next);
      setPassword('');
    }
  }, [attemptCount, navigate, t]);

  const handleSubmit = useCallback(async () => {
    if (isCheckingRef.current || didNavigate.current) return;
    if (!password) return;
    isCheckingRef.current = true;
    setIsSubmitting(true);
    setError('');
    try {
      const mnemonicPlain = await decryptMnemonicWithPin(
        JSON.stringify(password),
      );
      if (mnemonicPlain) {
        setAccountMnemonic(mnemonicPlain);
        didNavigate.current = true;
        navigate.replace('ConnectingToNodeLoadingScreen', {
          expectedMnemonicHash: sha256Hash(mnemonicPlain),
        });
        return;
      }
      await handleWrongPassword();
    } finally {
      isCheckingRef.current = false;
      setIsSubmitting(false);
    }
  }, [password, handleWrongPassword, navigate, setAccountMnemonic]);

  // On web submit through the DOM form so the browser can autofill/save the
  // password; native calls handleSubmit directly.
  const submit = useCallback(() => {
    handleSubmit();
  }, [handleSubmit]);

  // Forgot password opens the delete-and-restore confirm sheet.
  const handleForgotPassword = useCallback(() => {
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'walletReset',
      title: t('adminLogin.passwordPage.forgotPasswordTitle'),
      message: t('adminLogin.passwordPage.forgotPasswordMessage'),
      confirmFunction: async () => {
        const deleted = await factoryResetWallet();
        if (deleted) {
          if (Platform.OS === 'web') window.location.reload();
          else RNRestart.restart();
        } else {
          navigate.navigate('ErrorScreen', {
            errorMessage: t('errormessages.deleteAccount'),
          });
        }
      },
    });
  }, [navigate, t]);

  // The storage error takes the attempts line's place (owner 2026-10-26).
  const statusText =
    error ||
    (!!attemptCount &&
      t('adminLogin.passwordPage.attemptsText', {
        attempts: 8 - attemptCount,
      }));

  return (
    <View style={styles.contentContainer}>
      <View style={styles.hero}>
        <Image
          source={ICONS.logoIcon}
          style={[
            styles.logo,
            tintStyle(tokens.scheme === 'light' ? undefined : tokens.ink),
          ]}
        />
        <ThemeText
          variant="title"
          styles={styles.header}
          content={t(
            'adminLogin.passwordPage.welcomeBackTitle',
            'Welcome back!',
          )}
        />
        {!!statusText && (
          <ThemeText
            variant="body"
            styles={[styles.attemptsText, { color: tokens.danger }]}
            content={statusText}
          />
        )}
      </View>
      <View style={styles.inputWrapper}>
        <PasswordField
          value={password}
          onChangeText={setPassword}
          placeholder={t(
            'adminLogin.passwordPage.passwordPlaceholder',
            'Password',
          )}
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={submit}
          focusRing
        />
      </View>
      <View style={styles.buttonContainer}>
        <CustomButton
          size="regular"
          tone="primary"
          textContent={t('adminLogin.passwordPage.loginButton', 'Log in')}
          actionFunction={submit}
          disabled={!password || isSubmitting}
          useLoading={isSubmitting}
        />
        <TextButton
          text={t('adminLogin.passwordPage.forgotPassword', 'Forgot password?')}
          align="center"
          textStyle={styles.forgotText}
          onPress={handleForgotPassword}
        />
      </View>
    </View>
  );
}

// Positions from audit/design LoginWeb, measured below the 54 safe area:
// logo at 96, field at 276 (fixed, so the attempts line never moves it).
const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
  },
  hero: {
    alignItems: 'center',
    marginTop: 96,
  },
  logo: {
    width: 64,
    height: 64,
  },
  header: {
    textAlign: 'center',
    marginTop: 24,
  },
  attemptsText: {
    marginTop: 8,
    textAlign: 'center',
  },
  inputWrapper: {
    position: 'absolute',
    top: 276,
    left: 0,
    right: 0,
  },
  forgotText: {
    fontSize: 15,
    lineHeight: 22,
  },
  buttonContainer: {
    marginTop: 'auto',
    width: '100%',
    gap: 12,
  },
});
