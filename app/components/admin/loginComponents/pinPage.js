import {useCallback, useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {getAuth} from '@react-native-firebase/auth';
import {
  getLocalStorageItem,
  handleLogin,
  retrieveData,
  terminateAccount,
} from '../../../functions';
import {LOGIN_SECUITY_MODE_KEY, SIZES} from '../../../constants';
import {useTranslation} from 'react-i18next';
import {ThemeText} from '../../../functions/CustomElements';
import KeyForKeyboard from '../../../functions/CustomElements/key';
import RNRestart from 'react-native-restart';
import PinDot from '../../../functions/CustomElements/pinDot';
import {useNavigation} from '@react-navigation/native';
import factoryResetWallet from '../../../functions/factoryResetWallet';
import sha256Hash from '../../../functions/hash';
import {useKeysContext} from '../../../../context-store/keys';
import {storeData} from '../../../functions/secureStore';
import {
  decryptMnemonicWithBiometrics,
  decryptMnemonicWithPin,
  handleLoginSecuritySwitch,
} from '../../../functions/handleMnemonic';

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
  const {setAccountMnemonic} = useKeysContext();
  const {t} = useTranslation();

  const navigate = useNavigation();

  const handlePinCheck = useCallback(async () => {
    const filteredPin = loginSettings.enteredPin.filter(pin => {
      if (typeof pin === 'number') return true;
    });

    if (filteredPin.length != 4) return;

    let comparisonHash = '';
    if (loginSettings.needsToBeMigrated) {
      comparisonHash = sha256Hash(loginSettings.savedPin);
    } else {
      comparisonHash = loginSettings.savedPin;
    }

    console.log(
      loginSettings,
      sha256Hash(JSON.stringify(loginSettings.enteredPin)),
      comparisonHash,
    );

    if (
      comparisonHash === sha256Hash(JSON.stringify(loginSettings.enteredPin))
    ) {
      if (loginSettings.isBiometricEnabled) {
        navigate.navigate('ConfirmActionPage', {
          confirmMessage:
            'Since biometric setting are enabled you cannot use the deafult pin login method. Would you like to terminate your account?',
          confirmFunction: async () => {
            const deleted = await terminateAccount();
            if (deleted) {
              clearSettings();
              try {
                await getAuth().signOut();
              } catch (err) {
                console.log('pin page sign out error', err);
              }
              RNRestart.restart();
            } else {
              navigate.navigate('ErrorScreen', {
                errorMessage: 'Error deleting account.',
              });
            }
          },
        });
        return;
      }

      if (loginSettings.needsToBeMigrated) {
        const savedMnemonic = await retrieveData('encryptedMnemonic');
        const migrationResponse = await handleLoginSecuritySwitch(
          savedMnemonic.value,
          loginSettings.enteredPin,
          'pin',
        );
        if (migrationResponse) {
          setAccountMnemonic(savedMnemonic.value);
          navigate.replace('ConnectingToNodeLoadingScreen', {
            isInitialLoad: false,
          });
        } else
          navigate.navigate('ErrorScreen', {
            errorMessage: 'Failed to decrypt pin',
          });
        return;
      } else {
        const mnemonicPlain = await decryptMnemonicWithPin(
          JSON.stringify(loginSettings.enteredPin),
        );
        setAccountMnemonic(mnemonicPlain);

        setTimeout(() => {
          navigate.replace('ConnectingToNodeLoadingScreen', {
            isInitialLoad: false,
          });
        }, 250);
      }
    } else {
      if (loginSettings.enteredPinCount >= 7) {
        const deleted = await factoryResetWallet();
        if (deleted) {
          clearSettings();
          RNRestart.restart();
        } else {
          navigate.navigate('ErrorScreen', {
            errorMessage: 'Error removing wallet',
          });
        }
      } else {
        setLoginSettings(prev => {
          return {
            ...prev,
            enteredPinCount: (prev.enteredPinCount += 1),
            enteredPin: [null, null, null, null],
          };
        });
      }
    }
  }, [loginSettings, navigate]);

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
        const [storedSettings, storedPin] = await Promise.all([
          getLocalStorageItem(LOGIN_SECUITY_MODE_KEY).then(data =>
            JSON.parse(data),
          ),
          retrieveData('pinHash'),
        ]);

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
        }));
        if (!storedSettings.isBiometricEnabled) return;

        if (needsToBeMigrated) {
          console.log('before login security switch');
          const savedMnemonic = await retrieveData('encryptedMnemonic');
          const migrationResponse = await handleLoginSecuritySwitch(
            savedMnemonic.value,
            '',
            'biometric',
          );
          console.log('after login security switch');
          if (migrationResponse) {
            storeData('pinHash', sha256Hash(storedPin.value));
            setAccountMnemonic(savedMnemonic.value);
            navigate.replace('ConnectingToNodeLoadingScreen', {
              isInitialLoad: false,
            });
          } else {
            navigate.navigate('ErrorScreen', {
              errorMessage: 'Unable to decode pin with biometrics',
            });
          }
          return;
        }

        const decryptResponse = await decryptMnemonicWithBiometrics();

        if (decryptResponse) {
          setAccountMnemonic(decryptResponse);
          navigate.replace('ConnectingToNodeLoadingScreen', {
            isInitialLoad: false,
          });
        } else {
          navigate.navigate('ErrorScreen', {
            errorMessage: 'Unable to decode pin with biometrics',
          });
        }
      } catch (err) {
        console.log('Load pin page information error', err);
      }
    }
    loadPageInformation();
  }, []);

  return (
    <View style={styles.contentContainer}>
      <ThemeText
        styles={{...styles.header}}
        content={t('adminLogin.pinPage.enterPinMessage')}
      />
      <ThemeText
        styles={{...styles.enterText}}
        content={
          8 -
          loginSettings.enteredPinCount +
          ' ' +
          t('adminLogin.pinPage.attemptsText')
        }
      />

      <View style={styles.dotContainer}>
        <PinDot pin={loginSettings.enteredPin} dotNum={0} />
        <PinDot pin={loginSettings.enteredPin} dotNum={1} />
        <PinDot pin={loginSettings.enteredPin} dotNum={2} />
        <PinDot pin={loginSettings.enteredPin} dotNum={3} />
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
    </View>
  );

  function addPin(id) {
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
          return {...prev, enteredPin: newPin};
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
        return {...prev, enteredPin: newPin};
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

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
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

  keyboardContainer: {
    width: '100%',
    marginTop: 'auto',
  },
  keyboard_row: {
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  key: {
    width: '33.33333333333333%',
    height: 80,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
