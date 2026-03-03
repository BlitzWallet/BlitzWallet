import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { setLocalStorageItem } from '../../../functions';
import { SIZES } from '../../../constants';
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

export default function PinPage(props) {
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
        const resposne = await storeMnemonicWithPinSecurity(
          accountMnemoinc,
          confirmPin,
        );
        if (!resposne) {
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
        didNavigate.current = true;
        navigate.reset({
          index: 0,
          routes: [
            {
              name: 'ConnectingToNodeLoadingScreen',
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
});
