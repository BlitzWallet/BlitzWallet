import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { setLocalStorageItem } from '../../../functions';
import { CENTER, SIZES } from '../../../constants';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { GlobalThemeView, ThemeText } from '../../../functions/CustomElements';
import KeyForKeyboard from '../../../functions/CustomElements/key';
import PinDot from '../../../functions/CustomElements/pinDot';
import factoryResetWallet from '../../../functions/factoryResetWallet';
import RNRestart from 'react-native-restart-newarch';
import { useKeysContext } from '../../../../context-store/keys';
import { storeMnemonicWithPinSecurity } from '../../../functions/handleMnemonic';
import { privateKeyFromSeedWords } from '../../../functions/nostrCompatability';
import { getPublicKey } from 'nostr-tools';
import { initializeFirebase } from '../../../../db/initializeFirebase';
import sha256Hash from '../../../functions/hash';
import PasswordCreateForm from '../../../components/admin/loginComponents/passwordCreateForm';

import PasskeyIcon from '../../../components/admin/loginComponents/passkeyIcon';
import CustomButton from '../../../functions/CustomElements/button';
import {
  createPasskey,
  forgetPasskey,
  isPasskeySupported,
  storeMnemonicWithPasskey,
} from '../../../functions/passkeyMnemonic';
import CustomSettingsTopBar from '../../../functions/CustomElements/settingsTopBar';

function WebCreatePassword(props) {
  const { accountMnemoinc } = useKeysContext();
  const navigate = useNavigation();
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 'checking' until the capability check resolves, then 'offer' (passkey
  // step), 'confirm-failed' (created but the confirm prompt failed) or
  // 'password' (today's form).
  const [step, setStep] = useState('checking');
  const [passkeyUnsupported, setPasskeyUnsupported] = useState(false);
  // A created passkey: [Try again] reuses it so a second one is never
  // registered.
  const credentialIdRef = useRef(null);
  // An uncertain write may have persisted this credential as the active unlock.
  const mayHaveStoredPasskeyRef = useRef(false);
  // Ref, not state: a double tap must not open a second create prompt.
  const isPasskeyBusyRef = useRef(false);
  const didRestoreWallet = props.route.params?.didRestoreWallet;
  const restoreExpectedHash = props.route.params?.expectedMnemonicHash;

  useEffect(() => {
    async function preConnectToFirebase() {
      const privateKey = await privateKeyFromSeedWords(accountMnemoinc);
      const publicKey = privateKey ? getPublicKey(privateKey) : null;
      if (privateKey && publicKey) {
        initializeFirebase(publicKey, privateKey);
      }
    }
    preConnectToFirebase();
  }, []);

  useEffect(() => {
    let active = true;
    isPasskeySupported().then(
      supported => active && setStep(supported ? 'offer' : 'password'),
      () => active && setStep('password'),
    );
    return () => {
      active = false;
    };
  }, []);

  const showSaveError = () => {
    navigate.navigate('ErrorScreen', {
      errorMessage: t('createAccount.keySetup.pin.savePinError'),
      customNavigator: () => {
        factoryResetWallet();
        setTimeout(() => {
          RNRestart.restart();
        }, 300);
      },
    });
  };

  // Same exit for both unlock methods. The loading screen's wipe keeps
  // encryptedMnemonic + pinHash, so either envelope survives it.
  const finishSetup = async () => {
    await setLocalStorageItem(
      'didViewSeedPhrase',
      JSON.stringify(!!didRestoreWallet),
    );
    navigate.reset({
      index: 0,
      routes: [
        {
          name: 'ConnectingToNodeLoadingScreen',
          params: {
            shouldWipeLocalData: true,
            expectedMnemonicHash:
              restoreExpectedHash || sha256Hash(accountMnemoinc),
          },
        },
      ],
    });
  };

  const handleSubmit = async password => {
    if (isPasskeyBusyRef.current) return;
    isPasskeyBusyRef.current = true;
    setIsSubmitting(true);
    try {
      const response = await storeMnemonicWithPinSecurity(
        accountMnemoinc,
        password,
      );
      if (!response) {
        showSaveError();
        return;
      }
      if (credentialIdRef.current) {
        await forgetPasskey(credentialIdRef.current);
        credentialIdRef.current = null;
      }
      await finishSetup();
    } catch {
      showSaveError();
    } finally {
      isPasskeyBusyRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Falls back to the password form. A created passkey that will never be
  // used is dropped from the password manager (best-effort).
  const showPasswordForm = unsupported => {
    if (credentialIdRef.current && !mayHaveStoredPasskeyRef.current) {
      forgetPasskey(credentialIdRef.current);
      credentialIdRef.current = null;
    }
    setPasskeyUnsupported(unsupported);
    setStep('password');
  };

  const handlePasskey = async () => {
    if (isPasskeyBusyRef.current) return;
    isPasskeyBusyRef.current = true;
    setIsSubmitting(true);
    try {
      if (!credentialIdRef.current) {
        const created = await createPasskey();
        if (created.status === 'cancelled') return;
        if (created.status !== 'ok') {
          showPasswordForm(true);
          return;
        }
        credentialIdRef.current = created.credentialId;
      }
      const previouslyStored = mayHaveStoredPasskeyRef.current;
      mayHaveStoredPasskeyRef.current = true;
      const result = await storeMnemonicWithPasskey(
        accountMnemoinc,
        credentialIdRef.current,
      );
      if (result === 'confirm-failed' || result === 'unsupported') {
        mayHaveStoredPasskeyRef.current = previouslyStored;
      }
      if (result === 'ok') {
        await finishSetup();
      } else if (result === 'confirm-failed') {
        setStep('confirm-failed');
      } else if (result === 'unsupported') {
        showPasswordForm(true);
      } else {
        showSaveError();
      }
    } catch {
      showSaveError();
    } finally {
      isPasskeyBusyRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleGoBack = () => {
    if (step === 'password' && !passkeyUnsupported) {
      setStep('offer');
    } else {
      navigate.goBack();
    }
  };

  if (step === 'checking') {
    return (
      <GlobalThemeView
        styles={styles.contentContainer}
        useStandardWidth={true}
      />
    );
  }

  if (step === 'password') {
    return (
      <GlobalThemeView styles={styles.contentContainer} useStandardWidth={true}>
        <CustomSettingsTopBar customBackFunction={handleGoBack} />
        <PasswordCreateForm
          headerText={t(
            'createAccount.keySetup.password.createHeader',
            'Create Password',
          )}
          subtitleText={
            passkeyUnsupported
              ? t(
                  'createAccount.keySetup.passkey.unsupported',
                  "Your password manager can't protect a wallet with a passkey yet. Set a password instead.",
                )
              : t(
                  'createAccount.keySetup.password.createSubtitle',
                  'Choose a strong password to protect your wallet.',
                )
          }
          buttonText={t(
            'createAccount.keySetup.password.createButton',
            'Create Wallet',
          )}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      </GlobalThemeView>
    );
  }

  return (
    <GlobalThemeView styles={styles.contentContainer} useStandardWidth={true}>
      <CustomSettingsTopBar customBackFunction={handleGoBack} />
      <View style={styles.passkeyContent}>
        <PasskeyIcon />
        <ThemeText
          styles={styles.passkeyHeader}
          content={t('createAccount.keySetup.passkey.offerHeader')}
        />
        <ThemeText
          styles={styles.passkeySubtitle}
          content={t(
            'createAccount.keySetup.passkey.offerSubtitle',
            'Unlock with your face, fingerprint, or device PIN instead of a password. If you ever lose your passkey, you can restore your wallet with your recovery phrase.',
          )}
        />
        {step === 'confirm-failed' && (
          <ThemeText
            styles={styles.passkeyError}
            content={t('createAccount.keySetup.passkey.confirmFailed')}
          />
        )}
      </View>
      <View style={styles.passkeyButtons}>
        <CustomButton
          textContent={
            step === 'confirm-failed'
              ? t('createAccount.keySetup.passkey.tryAgain')
              : t('createAccount.keySetup.passkey.createButton')
          }
          actionFunction={handlePasskey}
          disabled={isSubmitting}
          useLoading={isSubmitting}
        />
        <TouchableOpacity
          testID="use-password-instead"
          style={styles.usePasswordButton}
          onPress={() => {
            if (!isPasskeyBusyRef.current) showPasswordForm(false);
          }}
          disabled={isSubmitting}
        >
          <ThemeText
            content={t('createAccount.keySetup.passkey.usePassword')}
          />
        </TouchableOpacity>
      </View>
    </GlobalThemeView>
  );
}

function PinPageNative(props) {
  const { accountMnemoinc } = useKeysContext();
  const [pin, setPin] = useState([null, null, null, null]);
  const [confirmPin, setConfirmPin] = useState([]);
  const [pinNotMatched, setPinNotMatched] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [pinEnterCount, setPinEnterCount] = useState(0);
  const navigate = useNavigation();
  const { t } = useTranslation();
  const didNavigate = useRef(null);
  // const fromGiftPath = props.route.params?.from === 'giftPath';
  const didRestoreWallet = props.route.params?.didRestoreWallet;
  // For restore this is the hash of the seed the user typed (source of truth).
  // For create it's undefined and we hash the committed context seed below.
  const restoreExpectedHash = props.route.params?.expectedMnemonicHash;

  useEffect(() => {
    // begin initializing firebase to speed up loading time
    async function preConnectToFirebase() {
      const privateKey = await privateKeyFromSeedWords(accountMnemoinc);
      const publicKey = privateKey ? getPublicKey(privateKey) : null;
      if (privateKey && publicKey) {
        initializeFirebase(publicKey, privateKey);
      }
    }
    preConnectToFirebase();
  }, []);

  useEffect(() => {
    const filteredPin = pin.filter(pin => {
      if (typeof pin === 'number') return true;
    });
    if (filteredPin.length != 4) return;
    if (confirmPin.length === 0) {
      setConfirmPin(pin);
      setPin([null, null, null, null]);
      setIsConfirming(true);
      return;
    }
    if (didNavigate.current) return;
    (async () => {
      if (pin.toString() === confirmPin.toString()) {
        // Latch navigation before the async window (keychain write) so a second
        // PIN entry during the await can't re-enter this flow.
        didNavigate.current = true;
        const resposne = await storeMnemonicWithPinSecurity(
          accountMnemoinc,
          confirmPin,
        );
        if (!resposne) {
          didNavigate.current = false;
          navigate.navigate('ErrorScreen', {
            errorMessage: t('createAccount.keySetup.pin.savePinError'),
            customNavigator: () => {
              factoryResetWallet();
              setTimeout(() => {
                RNRestart.restart();
              }, 300);
            },
          });
          return;
        }

        await setLocalStorageItem(
          'didViewSeedPhrase',
          JSON.stringify(!!didRestoreWallet),
        );

        clearSettings();
        navigate.reset({
          index: 0,
          routes: [
            {
              name: 'ConnectingToNodeLoadingScreen',
              params: {
                // Wipe any previous wallet's local data on the loading screen
                // (not here) so a hang is covered by its watchdog and the user
                // waits on the loading screen, not this PIN page.
                shouldWipeLocalData: true,
                // Pin the loading screen's identity derivation to the exact seed
                // just stored, so it can't derive from a stale/empty context seed
                // during the navigation race.
                expectedMnemonicHash:
                  restoreExpectedHash || sha256Hash(accountMnemoinc),
              },
            },
          ],
        });
      } else {
        if (pinEnterCount === 7) {
          const deleted = await factoryResetWallet();
          if (deleted) {
            clearSettings();
            RNRestart.restart();
          } else {
            navigate.navigate('ErrorScreen', {
              errorMessage: t('createAccount.keySetup.pin.removeWalletError'),
            });
          }
        } else {
          setPinNotMatched(true);
          setPinEnterCount(prev => (prev += 1));
          setPinNotMatched(false);
          setPin([null, null, null, null]);
        }
      }
    })();
  }, [pin]);

  return (
    <GlobalThemeView styles={styles.contentContainer} useStandardWidth={true}>
      <ThemeText
        styles={styles.header}
        content={
          isConfirming
            ? pinNotMatched
              ? t('createAccount.keySetup.pin.wrongPinError')
              : t('createAccount.keySetup.pin.confirmPin')
            : t('createAccount.keySetup.pin.enterPinMessage')
        }
      />
      {!!pinEnterCount && (
        <ThemeText
          styles={styles.enterText}
          content={t('createAccount.keySetup.pin.attemptsText', {
            number: 8 - pinEnterCount,
          })}
        />
      )}

      <View
        style={[styles.dotContainer, { marginTop: pinEnterCount ? 0 : 30 }]}
      >
        <PinDot pin={pin} dotNum={0} />
        <PinDot pin={pin} dotNum={1} />
        <PinDot pin={pin} dotNum={2} />
        <PinDot pin={pin} dotNum={3} />
      </View>

      <View style={styles.keyboardContainer}>
        <View style={styles.keyboard_row}>
          <KeyForKeyboard num={1} addPin={addPin} />
          <KeyForKeyboard num={2} addPin={addPin} />
          <KeyForKeyboard num={3} addPin={addPin} />
        </View>
        <View style={styles.keyboard_row}>
          <KeyForKeyboard num={4} addPin={addPin} />
          <KeyForKeyboard num={5} addPin={addPin} />
          <KeyForKeyboard num={6} addPin={addPin} />
        </View>
        <View style={styles.keyboard_row}>
          <KeyForKeyboard num={7} addPin={addPin} />
          <KeyForKeyboard num={8} addPin={addPin} />
          <KeyForKeyboard num={9} addPin={addPin} />
        </View>
        <View style={styles.keyboard_row}>
          <KeyForKeyboard num={'C'} addPin={addPin} />
          <KeyForKeyboard num={0} addPin={addPin} />
          <KeyForKeyboard num={'back'} addPin={addPin} />
        </View>
      </View>
    </GlobalThemeView>
  );

  function addPin(id) {
    if (typeof id != 'number') {
      if (id === null) {
        setPin(prev => {
          const nullIndex = pin.indexOf(null);

          return prev.map((item, id) => {
            if (id === nullIndex - 1) {
              return null;
            } else if (nullIndex === -1 && id === 3) {
              return null;
            } else return item;
          });
        });
      } else setPin([null, null, null, null]);
    } else {
      setPin(prev => {
        const nullIndex = pin.indexOf(null);

        return prev.map((number, count) => {
          if (count === nullIndex) {
            return id;
          } else return number;
        });
      });
    }
  }
  function clearSettings() {
    setPin([null, null, null, null]);
    setConfirmPin([]);
    setIsConfirming(false);
    setPinEnterCount(0);
  }
}

export default function PinPage(props) {
  if (Platform.OS === 'web') {
    return <WebCreatePassword {...props} />;
  }
  return <PinPageNative {...props} />;
}

const styles = StyleSheet.create({
  contentContainer: {
    alignItems: 'center',
  },
  header: {
    fontSize: SIZES.xLarge,
    marginTop: 50,
  },
  enterText: {
    fontSize: SIZES.large,
    marginBottom: 30,
  },

  dotContainer: {
    width: 150,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dot: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  dot_active: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  keyboardContainer: {
    width: '100%',
    maxWidth: 400,
    marginTop: 'auto',
  },
  keyboard_row: {
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  key: {
    width: '33.33333333333333%',
    height: 70,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: SIZES.xLarge,
  },
  passkeyContent: {
    width: '100%',
    alignItems: 'center',
    marginTop: 50,
  },
  passkeyHeader: {
    fontSize: SIZES.large,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  passkeySubtitle: {
    opacity: 0.6,
    fontSize: SIZES.smedium,
    lineHeight: 22,
    textAlign: 'center',
  },
  passkeyError: {
    fontSize: SIZES.small,
    color: '#e74c3c',
    textAlign: 'center',
    marginTop: 12,
  },
  passkeyButtons: {
    width: '100%',
    marginTop: 'auto',
  },
  usePasswordButton: {
    marginTop: 15,
    padding: 5,
    ...CENTER,
  },
});
