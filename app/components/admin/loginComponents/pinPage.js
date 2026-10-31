import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  getLocalStorageItem,
  retrieveData,
  setLocalStorageItem,
} from '../../../functions';
import {
  ICONS,
  LOCK_SCREEN_PROFILE_KEY,
  LOGIN_SECUITY_MODE_KEY,
  PERSISTED_LOGIN_COUNT_KEY,
  RANDOM_LOGIN_KEYBOARD_LAYOUT_KEY,
} from '../../../constants';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../functions/CustomElements';
import KeyForKeyboard from '../../../functions/CustomElements/key';
import RNRestart from 'react-native-restart-newarch';
import { Image } from 'expo-image';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../../../context-store/theme';
import { tintStyle } from '../../../functions/webTintColor';
import { useNavigation } from '@react-navigation/native';
import factoryResetWallet from '../../../functions/factoryResetWallet';
import sha256Hash from '../../../functions/hash';
import { useKeysContext } from '../../../../context-store/keys';
import {
  decryptMnemonicWithPin,
  handleLoginSecuritySwitch,
  isEncryptedMnemonicFormat,
} from '../../../functions/handleMnemonic';
import { validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';

export default function PinPage() {
  const [loginSettings, setLoginSettings] = useState({
    isBiometricEnabled: null,
    isPinEnabled: null,
    isSecurityEnabled: null,
    enteredPin: [null, null, null, null],
    savedPin: '',
    enteredPinCount: 0,
    needsToBeMigrated: null,
  });
  const [useRanomPinLayout, setUseRandomPinLayout] = useState(false);
  // E2: photo cached on Home. undefined until read (the greeting
  // stays hidden so it never flashes the logo first), null when never cached.
  const [lockProfile, setLockProfile] = useState(undefined);
  const [photoFailed, setPhotoFailed] = useState(false);
  const { tokens, scheme } = useTheme();
  const [isShaking, setIsShaking] = useState(false);
  const isShakingRef = useRef(false);
  const dotsShake = useSharedValue(0);
  const dotsShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dotsShake.value }],
  }));
  const { setAccountMnemonic } = useKeysContext();
  const { t } = useTranslation();
  const didNavigate = useRef(null);
  // Block async Argon2 decrypt window from runing two checks that both fail and
  // both increment the wrong-PIN count toward the factory reset.
  const isCheckingPinRef = useRef(false);

  const navigate = useNavigation();

  // Generate randomized keyboard layout
  const keyboardLayout = useMemo(() => {
    if (!useRanomPinLayout) {
      return [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
        ['C', 0, 'back'],
      ];
    }

    const numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }

    return [
      [numbers[0], numbers[1], numbers[2]],
      [numbers[3], numbers[4], numbers[5]],
      [numbers[6], numbers[7], numbers[8]],
      ['C', numbers[9], 'back'],
    ];
  }, [useRanomPinLayout, loginSettings.enteredPinCount]);

  const handleWrongPin = useCallback(async () => {
    if (loginSettings.enteredPinCount >= 7) {
      const deleted = await factoryResetWallet();
      if (deleted) {
        clearSettings();
        RNRestart.restart();
      } else {
        navigate.navigate('ErrorScreen', {
          errorMessage: t('errormessages.deleteAccount'),
        });
      }
    } else {
      const next = loginSettings.enteredPinCount + 1;
      setLocalStorageItem(PERSISTED_LOGIN_COUNT_KEY, JSON.stringify(next));
      setLoginSettings(prev => {
        return {
          ...prev,
          enteredPinCount: next,
          enteredPin: [null, null, null, null],
        };
      });
      // The PIN itself is cleared above, at once: a full PIN left in state
      // re-runs the check and counts one entry several times. Only the dots
      // stay filled while they shake 3× over 240 ms; keys wait until then.
      isShakingRef.current = true;
      setIsShaking(true);
      dotsShake.value = withSequence(
        ...[8, -8, 8, -8, 8, 0].map(x => withTiming(x, { duration: 40 })),
      );
      setTimeout(() => {
        isShakingRef.current = false;
        setIsShaking(false);
      }, 240);
    }
  }, [loginSettings, navigate, t]);

  const handlePinCheck = useCallback(async () => {
    const filteredPin = loginSettings.enteredPin.filter(pin => {
      if (typeof pin === 'number') return true;
    });

    if (filteredPin.length != 4) return;
    if (didNavigate.current) return;
    if (loginSettings.isBiometricEnabled) return;
    if (isCheckingPinRef.current) return;

    isCheckingPinRef.current = true;
    try {
      if (loginSettings.needsToBeMigrated) {
        const savedMnemonic = await retrieveData('encryptedMnemonic');
        // Keychain glitch (value:false): count a wrong attempt rather than
        // attempting a decrypt of a non-existent envelope.
        if (!savedMnemonic.didWork) return handleWrongPin();
        if (isEncryptedMnemonicFormat(savedMnemonic.value)) {
          // Resume a crashed migration: an encrypted value (v2/v3/EvpKDF) was
          // already written but the marker wasn't, so this install still looks
          // needsToBeMigrated. Verify by decrypting — re-encrypting
          // savedMnemonic here would double-encrypt the ciphertext and corrupt
          // the wallet identity.
          const mnemonicPlain = await decryptMnemonicWithPin(
            JSON.stringify(loginSettings.enteredPin),
          );
          if (mnemonicPlain) {
            setAccountMnemonic(mnemonicPlain);
            didNavigate.current = true;
            navigate.replace('ConnectingToNodeLoadingScreen', {
              expectedMnemonicHash: sha256Hash(mnemonicPlain),
            });
            return;
          }
        } else if (
          // savedMnemonic is still the plaintext seed and savedPin is the
          // user's own raw plaintext PIN (very old plaintext-seed installs).
          // The sha256 comparison is the ONLY authentication factor on this
          // branch — validateMnemonic alone is always true for a valid seed —
          // so it MUST stay: without it, anyone at the unlocked PIN screen
          // types any 4 digits and the seed is re-encrypted under their PIN
          // (wallet takeover). Comparing it is not an offline oracle — it is
          // fixed the moment this login re-encrypts the seed to v3 below.
          validateMnemonic(savedMnemonic.value, wordlist) &&
          sha256Hash(loginSettings.savedPin) ===
            sha256Hash(JSON.stringify(loginSettings.enteredPin))
        ) {
          const migrationResponse = await handleLoginSecuritySwitch(
            savedMnemonic.value,
            loginSettings.enteredPin,
            'pin',
          );
          if (migrationResponse) {
            setAccountMnemonic(savedMnemonic.value);
            didNavigate.current = true;
            navigate.replace('ConnectingToNodeLoadingScreen', {
              expectedMnemonicHash: sha256Hash(savedMnemonic.value),
            });
          } else {
            navigate.navigate('ErrorScreen', {
              errorMessage: t('errormessages.failedToDecryptPin'),
            });
          }
          return;
        }
      } else {
        // Decrypt-to-verify: the Argon2+AES ciphertext is the PIN verifier. A
        // non-null result is a correct PIN; no separate sha256 oracle exists.
        const mnemonicPlain = await decryptMnemonicWithPin(
          JSON.stringify(loginSettings.enteredPin),
        );
        if (mnemonicPlain) {
          setAccountMnemonic(mnemonicPlain);
          didNavigate.current = true;
          navigate.replace('ConnectingToNodeLoadingScreen', {
            expectedMnemonicHash: sha256Hash(mnemonicPlain),
          });
          return;
        }
      }

      await handleWrongPin();
    } finally {
      isCheckingPinRef.current = false;
    }
  }, [loginSettings, navigate, handleWrongPin, t, setAccountMnemonic]);

  useEffect(() => {
    const filteredPin = loginSettings.enteredPin.filter(pin => {
      if (typeof pin === 'number') return true;
    });
    if (filteredPin.length != 4) return;

    handlePinCheck();
  }, [loginSettings.enteredPin, handlePinCheck]);

  useEffect(() => {
    async function loadPageInformation() {
      try {
        const [
          storedSettings,
          storedPin,
          ranomkeyboardLayout,
          persistedPinEnterCount,
          storedLockProfile,
        ] = await Promise.all([
          getLocalStorageItem(LOGIN_SECUITY_MODE_KEY).then(data =>
            JSON.parse(data),
          ),
          retrieveData('pinHash'),
          getLocalStorageItem(RANDOM_LOGIN_KEYBOARD_LAYOUT_KEY).then(
            JSON.parse,
          ),
          getLocalStorageItem(PERSISTED_LOGIN_COUNT_KEY).then(JSON.parse),
          // Display-only: a bad cached value must never fail the PIN setup
          // loaded alongside it.
          getLocalStorageItem(LOCK_SCREEN_PROFILE_KEY)
            .then(JSON.parse)
            .catch(() => null),
        ]);
        setUseRandomPinLayout(ranomkeyboardLayout);
        setLockProfile(storedLockProfile || null);

        let needsToBeMigrated;
        try {
          JSON.parse(storedPin.value);
          needsToBeMigrated = true;
        } catch (err) {
          console.log('comparison value error', err);
          needsToBeMigrated = false;
        }
        setLoginSettings(prev => ({
          ...prev,
          ...storedSettings,
          savedPin: storedPin.value,
          needsToBeMigrated,
          enteredPinCount: persistedPinEnterCount || 0,
        }));
      } catch (err) {
        setLockProfile(null);
        console.log('Load pin page information error', err);
      }
    }
    loadPageInformation();
  }, []);

  // Greeting follows the time of day; no name (owner 2026-10-26).
  const hour = new Date().getHours();
  const greeting = t(
    `adminLogin.pinPage.${
      hour < 12 ? 'goodMorning' : hour < 18 ? 'goodAfternoon' : 'goodEvening'
    }`,
  );
  const showPhoto = !!lockProfile?.imageUri && !photoFailed;

  return (
    <View style={styles.contentContainer}>
      <View
        style={[styles.greeting, lockProfile === undefined && styles.hidden]}
      >
        {showPhoto ? (
          <Image
            source={{ uri: lockProfile.imageUri }}
            style={[styles.avatar, styles.photo]}
            contentFit="cover"
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <Image
            source={ICONS.logoIcon}
            style={[
              styles.avatar,
              tintStyle(scheme === 'light' ? undefined : tokens.ink),
            ]}
          />
        )}
        <ThemeText variant="title" styles={styles.header} content={greeting} />
      </View>

      {!!loginSettings.enteredPinCount && (
        <Animated.View entering={FadeIn.duration(150)}>
          <ThemeText
            styles={[styles.attemptsText, { color: tokens.danger }]}
            content={t('adminLogin.pinPage.attemptsText', {
              attempts: 8 - loginSettings.enteredPinCount,
            })}
          />
        </Animated.View>
      )}

      <Animated.View
        accessible={true}
        accessibilityRole="image"
        accessibilityLabel={`${
          loginSettings.enteredPin.filter(n => typeof n === 'number').length
        } of 4`}
        style={[
          styles.dotContainer,
          { marginTop: loginSettings.enteredPinCount ? 48 : 76 },
          dotsShakeStyle,
        ]}
      >
        {loginSettings.enteredPin.map((digit, index) => (
          <LoginPinDot
            key={index}
            filled={isShaking || typeof digit === 'number'}
            filledColor={tokens.accent}
            emptyColor={tokens.tabPill}
          />
        ))}
      </Animated.View>
      <View style={styles.keyboardContainer}>
        {keyboardLayout.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keyboard_row}>
            {row.map((num, colIndex) => (
              <KeyForKeyboard
                key={`${rowIndex}-${colIndex}`}
                num={num}
                addPin={addPin}
                redesign
                pinPad
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );

  function addPin(id) {
    if (isShakingRef.current) return;
    if (typeof id != 'number') {
      if (id === null) {
        setLoginSettings(prev => {
          let prePin = prev.enteredPin;
          const nullIndex = prePin.indexOf(null);
          const newPin = prePin.map((item, id) => {
            if (id === nullIndex - 1) {
              return null;
            } else if (nullIndex === -1 && id === 3) {
              return null;
            } else return item;
          });
          return { ...prev, enteredPin: newPin };
        });
      } else {
        setLoginSettings(prev => ({
          ...prev,
          enteredPin: [null, null, null, null],
        }));
      }
    } else {
      setLoginSettings(prev => {
        let prePin = prev.enteredPin;
        const nullIndex = prePin.indexOf(null);
        const newPin = prePin.map((number, count) => {
          if (count === nullIndex) {
            return id;
          } else return number;
        });
        return { ...prev, enteredPin: newPin };
      });
    }
  }
  function clearSettings() {
    setLoginSettings(prev => {
      return {
        ...prev,
        enteredPin: [null, null, null, null],
        enteredPinCount: 0,
      };
    });
  }
}

// Each digit fills its dot over 120 ms with the same 1.1 bounce as PinDot.
function LoginPinDot({ filled, filledColor, emptyColor }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (!filled) return;
    scale.value = withSequence(
      withTiming(1.1, { duration: 100 }),
      withTiming(1, { duration: 100 }),
    );
  }, [filled, scale]);
  const bounceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View
      style={[
        styles.dot,
        {
          backgroundColor: filled ? filledColor : emptyColor,
          transitionProperty: 'backgroundColor',
          transitionDuration: 120,
        },
        bounceStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
    alignItems: 'center',
  },
  greeting: { alignItems: 'center' },
  hidden: { opacity: 0 },
  avatar: {
    width: 72,
    height: 72,
    marginTop: 64,
  },
  photo: { borderRadius: 36 },
  header: {
    textAlign: 'center',
    marginTop: 20,
  },
  attemptsText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
    textAlign: 'center',
    includeFontPadding: false,
  },
  dotContainer: {
    flexDirection: 'row',
    gap: 24,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  keyboardContainer: {
    width: '100%',
    marginTop: 'auto',
    gap: 10,
  },
  keyboard_row: {
    flexDirection: 'row',
    gap: 10,
  },
});
