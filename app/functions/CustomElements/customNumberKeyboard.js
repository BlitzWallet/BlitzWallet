import { StyleSheet, View } from 'react-native';
import { CENTER, SATSPERBITCOIN } from '../../constants';
import KeyForKeyboard from './key';
import { useCallback, useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import { HIDDEN_OPACITY } from '../../constants/theme';

export default function CustomNumberKeyboard({
  setInputValue,
  frompage,
  showDot,
  usingForBalance,
  fiatStats,
  useMaxBalance = true,
  customFunction,
  disabled = false,
  disabledMessage = '',
  usingForInput = false,
  redesign = false,
  bottomLeftEmpty = false,
}) {
  const navigate = useNavigation();
  const addPin = useCallback(
    id => {
      if (disabled) {
        if (disabledMessage) {
          navigate.navigate('ErrorScreen', { errorMessage: disabledMessage });
        }
        return;
      }
      if (customFunction) {
        customFunction(id);
        return;
      }
      if (id === null) {
        setInputValue(prev => {
          return String(prev).slice(0, -1);
        });
      } else if (id === 'C') {
        setInputValue('');
      } else {
        setInputValue(prev => {
          let previousNumber = typeof prev !== 'string' ? String(prev) : prev;
          let newNumber = '';

          if (previousNumber?.includes('.') && id === '.') {
            newNumber = previousNumber;
          } else if (
            previousNumber?.includes('.') &&
            previousNumber.split('.')[1].length > 1
          ) {
            newNumber = previousNumber;
          } else {
            newNumber = String(previousNumber) + id;
          }

          if (usingForInput) return newNumber;

          // Add leading 0 if the number starts with a decimal point
          if (newNumber.startsWith('.')) {
            newNumber = '0' + newNumber;
          }

          // Remove leading zeros before digits (but keep single 0 before decimal)
          newNumber = newNumber.replace(/^(-?)0+(?=\d)/, '$1');

          if (usingForBalance) {
            const convertedValue =
              showDot || showDot === undefined
                ? (SATSPERBITCOIN / (fiatStats?.value || 65000)) * newNumber
                : newNumber;

            if (convertedValue > 25_000_000 && useMaxBalance)
              return previousNumber;
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
      customFunction,
      disabled,
      disabledMessage,
      usingForInput,
    ],
  );

  const keyboardContainerStyles = useMemo(
    () => [
      styles.keyboardContainer,
      redesign && styles.keyboardContainerRedesign,
      {
        marginTop:
          frompage === 'sendContactsPage' ||
          frompage === 'sendSMSPage' ||
          frompage === 'accountsPayments'
            ? 0
            : 'auto',
      },
      disabled && styles.disabledKeyboard,
    ],
    [frompage, disabled, redesign],
  );

  const numbers = useMemo(
    () => [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ],
    [],
  );

  return (
    <View style={keyboardContainerStyles}>
      {numbers?.map((row, rowIndex) => {
        if (!row || !Array.isArray(row)) return null;
        return (
          <View
            key={rowIndex}
            style={[styles.keyboard_row, redesign && styles.keyboardRowRedesign]}
          >
            {row.map(num => {
              if (num === undefined || num === null) return null;

              return (
                <KeyForKeyboard
                  key={num}
                  num={num}
                  addPin={addPin}
                  redesign={redesign}
                />
              );
            })}
          </View>
        );
      })}
      <View
        style={[styles.keyboard_row, redesign && styles.keyboardRowRedesign]}
      >
        {(showDot || showDot === undefined) && (
          <KeyForKeyboard
            frompage={frompage}
            isDot
            num="."
            addPin={addPin}
            redesign={redesign}
          />
        )}
        {!showDot &&
          (bottomLeftEmpty ? (
            <View style={styles.emptyKey} />
          ) : (
            <KeyForKeyboard num="C" addPin={addPin} redesign={redesign} />
          ))}
        <KeyForKeyboard num={0} addPin={addPin} redesign={redesign} />
        <KeyForKeyboard num="back" addPin={addPin} redesign={redesign} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: { width: '100%', maxWidth: 400, ...CENTER },
  keyboardContainerRedesign: { gap: 8 },
  keyboardRowRedesign: { gap: 8 },
  disabledKeyboard: { opacity: HIDDEN_OPACITY },
  emptyKey: { flex: 1, minHeight: 54 },
  keyboard_row: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
