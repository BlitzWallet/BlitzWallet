import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { CENTER, COLORS, ICONS, SIZES } from '../../../constants';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../functions/CustomElements';
import CustomButton from '../../../functions/CustomElements/button';
import { useNavigation } from '@react-navigation/native';
import factoryResetWallet from '../../../functions/factoryResetWallet';
import sha256Hash from '../../../functions/hash';
import { useKeysContext } from '../../../../context-store/keys';
import { decryptMnemonicWithPasskey } from '../../../functions/passkeyMnemonic';
import { HIDDEN_OPACITY, WINDOWWIDTH } from '../../../constants/theme';
import { tintStyle } from '../../../functions/webTintColor';
import { useGlobalThemeContext } from '../../../../context-store/theme';
import { Image } from 'expo-image';

// Web login for a wallet locked by a passkey. Unlike PasswordPage there is no
// attempt counter and no auto-reset: a passkey can't be guessed (the
// authenticator enforces its own lockout), and a glitchy password manager
// must never be able to wipe a wallet.
export default function PasskeyLoginPage() {
  const { theme } = useGlobalThemeContext();
  const [error, setError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const { setAccountMnemonic } = useKeysContext();
  const { t } = useTranslation();
  const navigate = useNavigation();
  const didNavigate = useRef(false);
  const isActiveRef = useRef(true);
  // Guards on the ref, not state, so the auto-prompt and a tap can't open two
  // passkey prompts at once.
  const isUnlockingRef = useRef(false);

  const unlock = useCallback(async () => {
    if (isUnlockingRef.current || didNavigate.current) return;
    isUnlockingRef.current = true;
    setIsUnlocking(true);
    setError('');
    try {
      const mnemonic = await decryptMnemonicWithPasskey();
      if (!isActiveRef.current) return;
      if (mnemonic) {
        setAccountMnemonic(mnemonic);
        didNavigate.current = true;
        navigate.replace('ConnectingToNodeLoadingScreen', {
          expectedMnemonicHash: sha256Hash(mnemonic),
        });
        return;
      }
      // null = cancelled / no passkey on this device: the button stays, no
      // message. false = the passkey couldn't unlock this wallet.
      if (mnemonic === false) {
        if ((await getStoredPasskeyInfo().catch(() => undefined)) === null) {
          window.location.reload();
          return;
        }
        setError(
          t(
            'adminLogin.passkeyPage.unlockError',
            "Couldn't unlock with your passkey",
          ),
        );
      }
    } finally {
      isUnlockingRef.current = false;
      if (isActiveRef.current) setIsUnlocking(false);
    }
  }, [navigate, setAccountMnemonic, t]);

  // Open the passkey prompt once on load; the button retries.
  useEffect(() => {
    isActiveRef.current = true;
    unlock();
    return () => {
      isActiveRef.current = false;
    };
  }, []);

  const handleLostPasskey = useCallback(() => {
    if (isUnlockingRef.current) return;
    navigate.navigate('ConfirmActionPage', {
      confirmMessage: t(
        'adminLogin.passkeyPage.lostPasskeyConfirm',
        'Lost your passkey? The only way back in is to reset and restore with your recovery phrase.\n\nDo you want to delete all wallet data? Only continue if your recovery phrase is securely backed up.',
      ),
      confirmFunction: async () => {
        const deleted = await factoryResetWallet();
        if (deleted) {
          window.location.reload();
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
      {!!error && <ThemeText styles={styles.errorText} content={error} />}
      <View style={styles.centerContent}>
        <Image
          source={ICONS.logoIcon}
          style={[
            styles.logo,
            tintStyle(theme ? COLORS.darkModeText : undefined),
          ]}
        />
      </View>
      <View style={styles.buttonContainer}>
        <CustomButton
          textContent={t(
            'adminLogin.passkeyPage.unlockButton',
            'Unlock with passkey',
          )}
          actionFunction={unlock}
          disabled={isUnlocking}
          useLoading={isUnlocking}
        />
        <TouchableOpacity
          testID="lost-passkey"
          style={styles.lostButton}
          onPress={handleLostPasskey}
          disabled={isUnlocking}
        >
          <ThemeText
            styles={styles.lostText}
            content={t(
              'adminLogin.passkeyPage.lostPasskey',
              'Lost your passkey?',
            )}
          />
        </TouchableOpacity>
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
  errorText: {
    fontSize: SIZES.small,
    color: COLORS.cancelRed,
    textAlign: 'center',
    marginTop: 20,
  },
  buttonContainer: {
    marginTop: 'auto',
    width: '100%',
  },
  lostButton: {
    marginTop: 15,
  },
  lostText: {
    fontSize: SIZES.smedium,
    opacity: HIDDEN_OPACITY,
    textAlign: 'center',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
  },
});
