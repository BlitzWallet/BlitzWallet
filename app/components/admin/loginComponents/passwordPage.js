import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Platform } from 'react-native';
import { getLocalStorageItem, setLocalStorageItem } from '../../../functions';
import {
  CENTER,
  COLORS,
  PERSISTED_LOGIN_COUNT_KEY,
  SIZES,
} from '../../../constants';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../functions/CustomElements';
import CustomSearchInput from '../../../functions/CustomElements/searchInput';
import CustomButton from '../../../functions/CustomElements/button';
import { useNavigation } from '@react-navigation/native';
import factoryResetWallet from '../../../functions/factoryResetWallet';
import sha256Hash from '../../../functions/hash';
import { useKeysContext } from '../../../../context-store/keys';
import { decryptMnemonicWithPin } from '../../../functions/handleMnemonic';
import RNRestart from 'react-native-restart-newarch';
import { HIDDEN_OPACITY, WINDOWWIDTH } from '../../../constants/theme';

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
      setError(
        t(
          'adminLogin.passwordPage.wrongPasswordError',
          'Wrong password, try again',
        ),
      );
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

  // Forgot password routes to the confirm page that factory resets the wallet.
  const handleForgotPassword = useCallback(() => {
    navigate.navigate('ConfirmActionPage', {
      confirmMessage: t('adminLogin.passwordPage.forgotPasswordConfirm'),
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

  return (
    <View style={styles.contentContainer}>
      <ThemeText
        styles={styles.header}
        content={t('adminLogin.passwordPage.welcomeBackTitle', 'Welcome back!')}
      />
      {!!attemptCount && (
        <ThemeText
          styles={styles.attemptsText}
          content={t('adminLogin.passwordPage.attemptsText', {
            attempts: 8 - attemptCount,
          })}
        />
      )}
      <View style={styles.inputWrapper}>
        <CustomSearchInput
          inputText={password}
          setInputText={setPassword}
          placeholderText={t(
            'adminLogin.passwordPage.passwordPlaceholder',
            'Password',
          )}
          secureTextEntry={true}
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditingFunction={submit}
        />
        <TouchableOpacity
          style={styles.forgotButton}
          onPress={handleForgotPassword}
        >
          <ThemeText
            styles={styles.forgotText}
            content={t(
              'adminLogin.passwordPage.forgotPassword',
              'Forgot password?',
            )}
          />
        </TouchableOpacity>
      </View>
      <View style={styles.buttonContainer}>
        <CustomButton
          textContent={t('adminLogin.passwordPage.loginButton', 'Log In')}
          actionFunction={submit}
          disabled={!password || isSubmitting}
          useLoading={isSubmitting}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
    width: WINDOWWIDTH,
    alignItems: 'center',
    ...CENTER,
  },
  header: {
    fontSize: SIZES.xxLarge,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 50,
  },
  attemptsText: {
    marginTop: 6,
    opacity: HIDDEN_OPACITY,
  },
  inputWrapper: {
    width: '100%',
    maxWidth: 400,
    marginTop: 40,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  forgotText: {
    fontSize: SIZES.smedium,
    color: COLORS.gray,
  },
  errorText: {
    fontSize: SIZES.small,
    color: COLORS.cancelRed,
    marginTop: 10,
  },
  buttonContainer: {
    marginTop: 'auto',
    width: '100%',
  },
});
