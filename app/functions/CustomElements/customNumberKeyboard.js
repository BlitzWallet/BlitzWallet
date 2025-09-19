import {StyleSheet, View} from 'react-native';
import {SATSPERBITCOIN} from '../../constants';
import KeyForKeyboard from './key';
import {useCallback, useMemo} from 'react';
import numberConverter from '../numberConverter';

export default function CustomNumberKeyboard({
  setInputValue,
  frompage,
  showDot,
  usingForBalance,
  fiatStats,
  useMaxBalance = true,
}) {
  const addPin = useCallback(
    id => {
      if (id === null) {
        setInputValue(prev => {
          return frompage === 'sendingPage'
            ? String(prev / 1000).slice(0, -1) * 1000
            : String(prev).slice(0, -1);
        });
      } else if (id === 'C') {
        setInputValue('');
      } else {
        setInputValue(prev => {
          let newNumber = '';
          if (frompage === 'sendingPage') {
            newNumber = (String(prev / 1000) + id) * 1000;
          } else if (prev?.includes('.') && id === '.') {
            newNumber = prev;
          } else if (prev?.includes('.') && prev.split('.')[1].length > 1) {
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

            if (convertedValue > 25_000_000 && useMaxBalance) return prev;
          }

          return newNumber;
        });
      }
    },
    [
      frompage,
      setInputValue,
      showDot,
      usingForBalance,
      fiatStats,
      useMaxBalance,
    ],
  );

  const keyboardContainerStyles = useMemo(
    () => [
      styles.keyboardContainer,
      {
        marginTop:
          frompage === 'sendContactsPage' || frompage === 'sendSMSPage'
            ? 0
            : 'auto',
      },
    ],
    [frompage],
  );

  const numbers = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ];

  return (
    <View style={keyboardContainerStyles}>
      {numbers.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.keyboard_row}>
          {row.map(num => (
            <KeyForKeyboard key={num} num={num} addPin={addPin} />
          ))}
        </View>
      ))}
      <View style={styles.keyboard_row}>
        {(showDot || showDot === undefined) && (
          <KeyForKeyboard frompage={frompage} isDot num="." addPin={addPin} />
        )}
        {!showDot && <KeyForKeyboard num="C" addPin={addPin} />}
        <KeyForKeyboard num={0} addPin={addPin} />
        <KeyForKeyboard num="back" addPin={addPin} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {width: '100%'},
  keyboard_row: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
