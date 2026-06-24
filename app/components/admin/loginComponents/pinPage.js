import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  getLocalStorageItem,
  retrieveData,
  setLocalStorageItem,
} from '../../../functions';
import {
  LOGIN_SECUITY_MODE_KEY,
  PERSISTED_LOGIN_COUNT_KEY,
  RANDOM_LOGIN_KEYBOARD_LAYOUT_KEY,
  SIZES,
} from '../../../constants';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../functions/CustomElements';
import KeyForKeyboard from '../../../functions/CustomElements/key';
import RNRestart from 'react-native-restart-newarch';
import PinDot from '../../../functions/CustomElements/pinDot';
import { useNavigation } from '@react-navigation/native';
import factoryResetWallet from '../../../functions/factoryResetWallet';
import sha256Hash from '../../../functions/hash';
import { useKeysContext } from '../../../../context-store/keys';
import {
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
  const [useRanomPinLayout, setUseRandomPinLayout] = useState(false);
  const numRetriesBiometric = useRef(0);
  const { setAccountMnemonic } = useKeysContext();
  const { t } = useTranslation();
  const didNavigate = useRef(null);

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

  const handlePinCheck = useCallback(async () => {
    const filteredPin = loginSettings.enteredPin.filter(pin => {
      if (typeof pin === 'number') return true;
    });

    if (filteredPin.length != 4) return;
    if (didNavigate.current) return;

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
    if (loginSettings.isBiometricEnabled) return;
    if (
      comparisonHash === sha256Hash(JSON.stringify(loginSettings.enteredPin))
    ) {
      if (loginSettings.needsToBeMigrated) {
        const savedMnemonic = await retrieveData('encryptedMnemonic');
        const migrationResponse = await handleLoginSecuritySwitch(
          savedMnemonic.value,
          loginSettings.enteredPin,
          'pin',
        );
        if (migrationResponse) {
          setAccountMnemonic(savedMnemonic.value);
          didNavigate.current = true;
          navigate.replace('ConnectingToNodeLoadingScreen');
        } else
          navigate.navigate('ErrorScreen', {
            errorMessage: t('errormessages.failedToDecryptPin'),
          });
        return;
      } else {
        const mnemonicPlain = await decryptMnemonicWithPin(
          JSON.stringify(loginSettings.enteredPin),
        );
        setAccountMnemonic(mnemonicPlain);

        didNavigate.current = true;
        navigate.replace('ConnectingToNodeLoadingScreen');
      }
    } else {
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
        setLocalStorageItem(
          PERSISTED_LOGIN_COUNT_KEY,
          JSON.stringify(loginSettings.enteredPinCount + 1),
        );
        setLoginSettings(prev => {
          return {
            ...prev,
            enteredPinCount: prev.enteredPinCount + 1,
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
        const [
          storedSettings,
          storedPin,
          ranomkeyboardLayout,
          persistedPinEnterCount,
        ] = await Promise.all([
          getLocalStorageItem(LOGIN_SECUITY_MODE_KEY).then(data =>
            JSON.parse(data),
          ),
          retrieveData('pinHash'),
          getLocalStorageItem(RANDOM_LOGIN_KEYBOARD_LAYOUT_KEY).then(
            JSON.parse,
          ),
          getLocalStorageItem(PERSISTED_LOGIN_COUNT_KEY).then(JSON.parse),
        ]);
        setUseRandomPinLayout(ranomkeyboardLayout);

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
        console.log('Load pin page information error', err);
      }
    }
    loadPageInformation();
  }, []);

  return (
    <View style={styles.contentContainer}>
      <ThemeText
        styles={styles.header}
        content={t('adminLogin.pinPage.enterPinMessage')}
      />

      {!!loginSettings.enteredPinCount && (
        <ThemeText
          styles={styles.enterText}
          content={t('adminLogin.pinPage.attemptsText', {
            attempts: 8 - loginSettings.enteredPinCount,
          })}
        />
      )}

      <View
        style={[
          styles.dotContainer,
          { marginTop: loginSettings.enteredPinCount ? 0 : 30 },
        ]}
      >
        <PinDot pin={loginSettings.enteredPin} dotNum={0} />
        <PinDot pin={loginSettings.enteredPin} dotNum={1} />
        <PinDot pin={loginSettings.enteredPin} dotNum={2} />
        <PinDot pin={loginSettings.enteredPin} dotNum={3} />
      </View>
      <View style={styles.keyboardContainer}>
        {keyboardLayout.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keyboard_row}>
            {row.map((num, colIndex) => (
              <KeyForKeyboard
                key={`${rowIndex}-${colIndex}`}
                num={num}
                addPin={addPin}
              />
            ))}
          </View>
        ))}
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
    width: '33.333333333%',
    height: 70,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
