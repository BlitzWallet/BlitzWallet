import {Image, StyleSheet, TouchableOpacity, View} from 'react-native';
import {SATSPERBITCOIN, SIZES} from '../../constants';
import KeyForKeyboard from './key';
import {useCallback} from 'react';
import numberConverter from '../numberConverter';

export default function CustomNumberKeyboard({
  setInputValue,
  frompage,
  showDot,
  usingForBalance,
  fiatStats,
}) {
  const addPin = useCallback(
    id => {
      console.log(id);
      if (id === null) {
        setInputValue(prev => {
          return frompage === 'sendingPage'
            ? String(prev / 1000).slice(0, String(prev / 1000).length - 1) *
                1000
            : String(prev).slice(0, String(prev).length - 1);
        });
        // } else setInputValue(0);
      } else if (id === 'C') {
        setInputValue('');
      } else {
        setInputValue(prev => {
          let newNumber = '';

          if (frompage === 'sendingPage') {
            newNumber = (String(prev / 1000) + id) * 1000;
          } else if (prev?.includes('.') && id === '.')
            newNumber = prev; //making sure only one decimal is in number
          else if (prev?.includes('.') && prev.split('.')[1].length > 1) {
            //controling length to max 2 digits after decimal
            newNumber = prev;
          } else {
            newNumber = String(prev) + id;
          }

          if (usingForBalance) {
            const convertedValue =
              showDot || showDot === undefined
                ? (SATSPERBITCOIN / (fiatStats?.value || 65000)) * newNumber
                : newNumber;

            numberConverter(
              newNumber,
              showDot || showDot === undefined ? 'fiat' : 'sats',
              undefined,
              fiatStats,
            );
            console.log(fiatStats?.value);
            console.log(convertedValue, 'CONVERTED VAL');
            const numberLength = integerPartLength(convertedValue);
            console.log(numberLength, 'NUMBER LENGTH');
            if (convertedValue > 25_000_000) return prev;
          }

          return newNumber;
        });
      }
    },
    [frompage, setInputValue, showDot, usingForBalance, fiatStats],
  );
  return (
    <View
      style={[
        styles.keyboardContainer,
        {
          marginTop:
            frompage === 'sendContactsPage' ||
            frompage === 'contactsAutomatedPayments' ||
            frompage === 'sendSMSPage'
              ? 0
              : 'auto',
        },
      ]}>
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
        {(showDot || showDot === undefined) && (
          <KeyForKeyboard
            frompage={frompage}
            isDot={true}
            num={'.'}
            addPin={addPin}
          />
        )}
        {!showDot && <KeyForKeyboard num={'C'} addPin={addPin} />}
        <KeyForKeyboard num={0} addPin={addPin} />
        <KeyForKeyboard num={'back'} addPin={addPin} />
      </View>
    </View>
  );
}
function integerPartLength(num) {
  const match = num.toString().match(/^(\d+)/);
  return match ? match[1].length : 0;
}

const styles = StyleSheet.create({
  keyboardContainer: {
    width: '100%',
    // marginTop: 'auto',
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
  keyText: {
    fontSize: SIZES.xLarge,
  },
});
