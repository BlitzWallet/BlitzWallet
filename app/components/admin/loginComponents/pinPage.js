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

export default function PinPage() {
  const [loginSettings, setLoginSettings] = useState({
    isBiometricEnabled: null,
    isPinEnabled: null,
    isSecurityEnabled: null,
    enteredPin: [null, null, null, null],
    savedPin: [null, null, null, null],
    enteredPinCount: 0,
  });
  const {t} = useTranslation();

  const navigate = useNavigation();

  const handlePinCheck = useCallback(async () => {
    const filteredPin = loginSettings.enteredPin.filter(pin => {
      if (typeof pin === 'number') return true;
    });

    if (filteredPin.length != 4) return;

    if (
      JSON.stringify(loginSettings.enteredPin) ===
      JSON.stringify(loginSettings.savedPin)
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

      setTimeout(() => {
        navigate.replace('ConnectingToNodeLoadingScreen', {
          isInitialLoad: false,
        });
      }, 250);
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
          retrieveData('pin').then(data => JSON.parse(data)),
        ]);
        setLoginSettings(prev => ({
          ...prev,
          ...storedSettings,
          savedPin: storedPin,
        }));
        if (!storedSettings.isBiometricEnabled) return;

        const didLogIn = await handleLogin();
        if (didLogIn)
          navigate.replace('ConnectingToNodeLoadingScreen', {
            isInitialLoad: false,
          });
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
    width: '100%',
    flex: 1,
    alignItems: 'center',
    marginRight: 'auto',
    marginLeft: 'auto',
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
