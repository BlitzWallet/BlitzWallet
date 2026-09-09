// The one-time migration screen for legacy `blitz-web-app` wallets. All the
// logic lives in app/functions/legacyWebMigration.js; this is the single screen
// that drives it.
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import CustomSearchInput from '../../functions/CustomElements/searchInput';
import CustomButton from '../../functions/CustomElements/button';
import { CENTER, COLORS, SIZES } from '../../constants';
import { HIDDEN_OPACITY, WINDOWWIDTH } from '../../constants/theme';
import { migrateLegacyWallet } from '../../functions/legacyWebMigration';
import { useKeysContext } from '../../../context-store/keys';
import sha256Hash from '../../functions/hash';

export default function LegacyWebMigration() {
  const [password, setPassword] = useState('');
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
        <View style={styles.inputWrapper}>
          <CustomSearchInput
            inputText={password}
            setInputText={setPassword}
            placeholderText={t(
              'createAccount.legacyWebMigration.passwordPlaceholder',
              'Password',
            )}
            secureTextEntry={true}
            autoComplete="current-password"
            textContentType="password"
            onSubmitEditingFunction={handleSubmit}
          />
          {!!error && <ThemeText styles={styles.errorText} content={error} />}
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
        </View>
      </View>
    </GlobalThemeView>
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
  description: {
    marginTop: 12,
    textAlign: 'center',
    opacity: HIDDEN_OPACITY,
  },
  inputWrapper: {
    width: '100%',
    maxWidth: 400,
    marginTop: 40,
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
});
