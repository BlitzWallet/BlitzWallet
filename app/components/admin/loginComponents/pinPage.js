import {useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import auth from '@react-native-firebase/auth';
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

export default function PinPage(props) {
  const [pin, setPin] = useState([null, null, null, null]);
  const [error, setError] = useState(false);
  const [pinEnterCount, setPinEnterCount] = useState(0);
  const [loginSettings, setLoginSettings] = useState({});
  const {t} = useTranslation();

  const fromBackground = props.fromBackground;
  const navigate = useNavigation();

  useEffect(() => {
    const filteredPin = pin.filter(pin => {
      if (typeof pin === 'number') return true;
    });

    if (filteredPin.length != 4) return;

    (async () => {
      const stored = JSON.parse(await retrieveData('pin'));

      if (JSON.stringify(pin) === JSON.stringify(stored)) {
        if (loginSettings.isBiometricEnabled) {
          navigate.navigate('ConfirmActionPage', {
            confirmMessage:
              'Since biometric setting are enabled you cannot use the deafult pin login method. Would you like to terminate your account?',
            confirmFunction: async () => {
              const deleted = await terminateAccount();
              if (deleted) {
                clearSettings();
                try {
                  await auth().signOut();
                } catch (err) {
                  console.log('pin page sign out error', err);
                }
                RNRestart.restart();
              } else console.log('ERRROR');
            },
          });
          return;
        }

        clearSettings();

        if (fromBackground) {
          if (navigate.canGoBack()) navigate.goBack();
          else navigate.replace('ConnectingToNodeLoadingScreen');
        } else
          navigate.replace('ConnectingToNodeLoadingScreen', {
            isInitialLoad: false,
          });
      } else {
        if (pinEnterCount === 7) {
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
          if (error) return;
          setError(true);
          setPinEnterCount(prev => (prev += 1));
          setError(false);
          setPin([null, null, null, null]);
        }
      }
    })();
  }, [pin, pinEnterCount, fromBackground, navigate]);

  useEffect(() => {
    (async () => {
      const storedSettings = JSON.parse(
        await getLocalStorageItem(LOGIN_SECUITY_MODE_KEY),
      );

      setLoginSettings(storedSettings);

      if (!storedSettings.isBiometricEnabled) return;

      const didLogIn = await handleLogin();
      if (didLogIn) navigate.replace('ConnectingToNodeLoadingScreen');
    })();
  }, []);

  return (
    <View style={styles.contentContainer}>
      <ThemeText
        styles={{...styles.header}}
        content={
          error
            ? t('adminLogin.pinPage.wrongPinError')
            : t('adminLogin.pinPage.enterPinMessage')
        }
      />
      <ThemeText
        styles={{...styles.enterText}}
        content={8 - pinEnterCount + ' ' + t('adminLogin.pinPage.attemptsText')}
      />

      <View style={styles.dotContainer}>
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
    </View>
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
    setError(false);
    setPinEnterCount(0);
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
