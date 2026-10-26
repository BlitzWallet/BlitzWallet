import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ICONS } from '../../../constants';
import { useTranslation } from 'react-i18next';
import CustomButton from '../../../functions/CustomElements/button';
import { useNavigation } from '@react-navigation/native';
import factoryResetWallet from '../../../functions/factoryResetWallet';
import sha256Hash from '../../../functions/hash';
import { useKeysContext } from '../../../../context-store/keys';
import {
  decryptMnemonicWithPasskey,
  getStoredPasskeyInfo,
} from '../../../functions/passkeyMnemonic';
import { tintStyle } from '../../../functions/webTintColor';
import { useGlobalThemeContext } from '../../../../context-store/theme';
import { Image } from 'expo-image';
import TextButton from '../../../functions/CustomElements/redesign/TextButton';
import { ThemeText } from '../../../functions/CustomElements';
import Animated, { FadeIn } from 'react-native-reanimated';
import { LOGIN_LOGO_TOP } from './loginLayout';

// Web login for a wallet locked by a passkey. Unlike PasswordPage there is no
// attempt counter and no auto-reset: a passkey can't be guessed (the
// authenticator enforces its own lockout), and a glitchy password manager
// must never be able to wipe a wallet.
export default function PasskeyLoginPage() {
  const { theme, tokens } = useGlobalThemeContext();
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
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'walletReset',
      title: t('adminLogin.passkeyPage.lostPasskey'),
      message: t('adminLogin.passkeyPage.lostPasskeyMessage'),
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
      <Image
        source={ICONS.logoIcon}
        style={[styles.logo, tintStyle(theme ? tokens.ink : undefined)]}
      />
      {!!error && (
        <Animated.View entering={FadeIn.duration(150)}>
          <ThemeText
            styles={[styles.errorText, { color: tokens.danger }]}
            content={error}
          />
        </Animated.View>
      )}
      <View style={styles.buttonContainer}>
        <CustomButton
          textContent={t(
            'adminLogin.passkeyPage.unlockButton',
            'Open with passkey',
          )}
          actionFunction={unlock}
          disabled={isUnlocking}
          useLoading={isUnlocking}
          size={'regular'}
        />
        <TextButton
          text={t('adminLogin.passkeyPage.lostPasskey')}
          align="center"
          textStyle={styles.lostText}
          onPress={handleLostPasskey}
          disabled={isUnlocking}
          testID={'lost-passkey'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  logo: {
    position: 'absolute',
    top: LOGIN_LOGO_TOP,
    alignSelf: 'center',
    width: 88,
    height: 88,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    includeFontPadding: false,
    marginBottom: 12,
  },
  buttonContainer: {
    gap: 12,
  },
  lostText: {
    fontSize: 15,
    lineHeight: 22,
  },
});
