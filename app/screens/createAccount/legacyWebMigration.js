// The one-time migration screen for legacy `blitz-web-app` wallets. All the
// logic lives in app/functions/legacyWebMigration.js; this is the single screen
// that drives it.
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import RNRestart from 'react-native-restart-newarch';

import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import CustomButton from '../../functions/CustomElements/button';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../constants';
import {
  LEGACY_WALLET_KEY,
  migrateLegacyWallet,
} from '../../functions/legacyWebMigration';
import { removeLocalStorageItem } from '../../functions/localStorage';
import { useKeysContext } from '../../../context-store/keys';
import sha256Hash from '../../functions/hash';
import { useTheme } from '../../../context-store/theme';
import PasswordField from '../../components/admin/loginComponents/passwordField';
import PageHeader from '../../functions/CustomElements/redesign/PageHeader';
import TextButton from '../../functions/CustomElements/redesign/TextButton';

export default function LegacyWebMigration() {
  const { tokens } = useTheme();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRunningRef = useRef(false);
  const { setAccountMnemonic } = useKeysContext();
  const navigate = useNavigation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
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
    // Same danger sheet as the other wallet-removal confirms (Q1-3).
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'walletReset',
      title: t('createAccount.legacyWebMigration.useRecoveryPhrase'),
      message: t('createAccount.legacyWebMigration.recoveryConfirm'),
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
      <View style={[styles.contentContainer, { width: contentWidth }]}>
        <PageHeader
          title={t(
            'createAccount.legacyWebMigration.title',
            'Blitz has been updated',
          )}
          sub={t(
            'createAccount.legacyWebMigration.description',
            'Log in once with your existing password to move your wallet over. Your balance, accounts and history stay the same.',
          )}
          large
        />
        <View style={styles.inputWrapper}>
          <PasswordField
            value={password}
            onChangeText={setPassword}
            placeholder={t(
              'createAccount.legacyWebMigration.passwordPlaceholder',
              'Password',
            )}
            autoComplete="current-password"
            textContentType="password"
            onSubmitEditing={handleSubmit}
            focusRing
          />
        </View>
        {!!error && (
          <ThemeText
            variant="hint"
            styles={[styles.errorText, { color: tokens.danger }]}
            content={error}
          />
        )}
        <View style={styles.buttonContainer}>
          <CustomButton
            textContent={t(
              'createAccount.legacyWebMigration.button',
              'Log in & update',
            )}
            actionFunction={handleSubmit}
            disabled={!password || isSubmitting}
            useLoading={isSubmitting}
            size={'regular'}
          />
          <TextButton
            text={t('createAccount.legacyWebMigration.useRecoveryPhrase')}
            onPress={handleUseRecoveryPhrase}
            disabled={isSubmitting}
            align="center"
            textStyle={styles.recoveryText}
          />
        </View>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
    ...CENTER,
  },
  inputWrapper: {
    width: '100%',
    marginTop: 28,
  },
  errorText: {
    marginTop: 8,
  },
  buttonContainer: {
    marginTop: 'auto',
    width: '100%',
    gap: 12,
  },
  recoveryText: {
    fontSize: 15,
    lineHeight: 22,
  },
});
