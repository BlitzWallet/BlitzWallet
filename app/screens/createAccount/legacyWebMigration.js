// The one-time migration screen for legacy `blitz-web-app` wallets. All the
// logic lives in app/functions/legacyWebMigration.js; this is the single screen
// that drives it.
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import RNRestart from 'react-native-restart-newarch';

import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import CustomSearchInput from '../../functions/CustomElements/searchInput';
import CustomButton from '../../functions/CustomElements/button';
import { CENTER, COLORS, SIZES } from '../../constants';
import { HIDDEN_OPACITY, WINDOWWIDTH } from '../../constants/theme';
import {
  LEGACY_WALLET_KEY,
  migrateLegacyWallet,
} from '../../functions/legacyWebMigration';
import { removeLocalStorageItem } from '../../functions/localStorage';
import { useKeysContext } from '../../../context-store/keys';
import sha256Hash from '../../functions/hash';
import IconActionCircle from '../../functions/CustomElements/actionCircleContainer';
import { useGlobalThemeContext } from '../../../context-store/theme';
import GetThemeColors from '../../hooks/themeColors';
import ThemeIcon from '../../functions/CustomElements/themeIcon';

export default function LegacyWebMigration() {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, textColor, textInputBackground } = GetThemeColors();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRunningRef = useRef(false);
  const { setAccountMnemonic } = useKeysContext();
  const navigate = useNavigation();
  const { t } = useTranslation();

  const handleSubmit = useCallback(async () => {
    if (isRunningRef.current || !password) return;
    isRunningRef.current = true;
    setIsSubmitting(true);
    setError('');
    try {
      await new Promise(res => setTimeout(res, 100)); // add small promise to fix UI thread block
      const result = await migrateLegacyWallet(password);

      if (result.status === 'wrong-password') {
        setError(
          t(
            'createAccount.legacyWebMigration.wrongPassword',
            'Wrong password, try again',
          ),
        );
        return;
      }
      if (result.status !== 'ok') {
        throw new Error(`migration returned ${result.status}`);
      }

      setAccountMnemonic(result.mnemonic);
      // No shouldWipeLocalData: the wipe already ran inside the migration, and
      // repeating it here would delete the account list it just wrote.
      navigate.reset({
        index: 0,
        routes: [
          {
            name: 'ConnectingToNodeLoadingScreen',
            params: { expectedMnemonicHash: sha256Hash(result.mnemonic) },
          },
        ],
      });
    } catch (err) {
      console.log('legacy web migration error', err);
      setError(
        t(
          'createAccount.legacyWebMigration.error',
          'Update failed. Your wallet has not been changed — reload the page and try again.',
        ),
      );
    } finally {
      isRunningRef.current = false;
      setIsSubmitting(false);
    }
  }, [password, navigate, setAccountMnemonic, t]);

  const handleUseRecoveryPhrase = () => {
    if (isRunningRef.current) return;
    navigate.navigate('ConfirmActionPage', {
      confirmMessage: t('createAccount.legacyWebMigration.recoveryConfirm'),
      confirmFunction: async () => {
        if (isRunningRef.current) return;
        isRunningRef.current = true;
        setIsSubmitting(true);
        setError('');
        const removed = await removeLocalStorageItem(LEGACY_WALLET_KEY);
        if (removed) {
          RNRestart.restart();
          return;
        }
        setError(t('createAccount.legacyWebMigration.recoveryError'));
        isRunningRef.current = false;
        setIsSubmitting(false);
      },
    });
  };

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={styles.contentContainer}>
        <ThemeText
          styles={styles.header}
          content={t(
            'createAccount.legacyWebMigration.title',
            'Blitz has been updated',
          )}
        />
        <ThemeText
          styles={styles.description}
          content={t(
            'createAccount.legacyWebMigration.description',
            'Log in once with your existing password to move your wallet over. Your balance, accounts and history stay the same.',
          )}
        />
        <View
          style={[
            styles.inputWrapper,
            { backgroundColor: textInputBackground },
          ]}
        >
          <CustomSearchInput
            inputText={password}
            setInputText={setPassword}
            placeholderText={t(
              'createAccount.legacyWebMigration.passwordPlaceholder',
              'Password',
            )}
            secureTextEntry={!showPassword}
            autoComplete="current-password"
            textContentType="password"
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
                  iconName={showPassword ? 'Eye' : 'EyeOff'}
                  size={22}
                  colorOverride={
                    theme && !darkModeType
                      ? COLORS.darkModePlaceholder
                      : COLORS.lightModePlaceholder
                  }
                />
              </TouchableOpacity>
            }
            onSubmitEditingFunction={handleSubmit}
          />
        </View>
        {!!error && <ThemeText styles={styles.errorText} content={error} />}
        <View style={styles.keyIconContainer}>
          <IconActionCircle
            customBackgroundColor={
              theme && darkModeType ? backgroundOffset : 'rgba(3,117,246,0.1)'
            }
            icon={'Key'}
            size={130}
          />
        </View>
        <View style={styles.buttonContainer}>
          <CustomButton
            textContent={t(
              'createAccount.legacyWebMigration.button',
              'Log in & update',
            )}
            actionFunction={handleSubmit}
            disabled={!password || isSubmitting}
            useLoading={isSubmitting}
          />
          <CustomButton
            textContent={t(
              'createAccount.legacyWebMigration.useRecoveryPhrase',
            )}
            actionFunction={handleUseRecoveryPhrase}
            disabled={isSubmitting}
            enableElipsis={false}
            buttonStyles={styles.recoveryButton}
            textStyles={{ color: textColor }}
          />
        </View>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
    width: WINDOWWIDTH,
    ...CENTER,
  },
  header: {
    fontSize: SIZES.large,
    fontWeight: '500',
    marginTop: 28,
    marginBottom: 8,
  },
  description: {
    opacity: 0.6,
    fontSize: SIZES.smedium,
    lineHeight: 22,
  },
  inputWrapper: {
    width: '100%',
    marginTop: 40,
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
  errorText: {
    fontSize: SIZES.small,
    color: COLORS.cancelRed,
    marginTop: 10,
    textAlign: 'center',
  },
  buttonContainer: {
    marginTop: 'auto',
    width: '100%',
  },
  recoveryButton: {
    marginTop: 12,
    backgroundColor: 'transparent',
  },
  keyIconContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
