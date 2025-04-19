import {COLORS, SIZES} from '../../constants';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {ThemeText} from '../../functions/CustomElements';
import {wordlist} from '@scure/bip39/wordlists/english';
import {useMemo} from 'react';

export default function SuggestedWordContainer({
  inputedKey,
  selectedKey,
  setInputedKey,
  keyRefs,
}) {
  const searchingWord = inputedKey[`key${selectedKey}`] || '';
  const suggestedWordElements = useMemo(() => {
    return wordlist
      .filter(word =>
        word.toLowerCase().startsWith(searchingWord.toLowerCase()),
      )
      .map(word => {
        return (
          <TouchableOpacity
            style={styles.keyElementContainer}
            onPress={() => {
              setInputedKey(prev => ({...prev, [`key${selectedKey}`]: word}));
              if (selectedKey === 12) {
                keyRefs.current[12].blur();
                return;
              }

              keyRefs.current[selectedKey + 1].focus();
            }}
            key={word}>
            <ThemeText
              CustomNumberOfLines={1}
              styles={styles.keyElementText}
              content={word}
            />
          </TouchableOpacity>
        );
      });
  }, [selectedKey, inputedKey, setInputedKey, keyRefs]);
  console.log(suggestedWordElements);
  return (
    <View
      style={{
        backgroundColor: COLORS.darkModeText,
        flexDirection: 'row',
        justifyContent: 'space-evenly',
      }}>
      {suggestedWordElements.length >= 3 ? (
        <>
          <View style={{borderRightWidth: 1, ...styles.wordContainer}}>
            {suggestedWordElements[0]}
          </View>
          <View style={{borderRightWidth: 1, ...styles.wordContainer}}>
            {suggestedWordElements[1]}
          </View>
          <View style={styles.wordContainer}>{suggestedWordElements[2]}</View>
        </>
      ) : suggestedWordElements.length === 2 ? (
        <>
          <View style={{borderRightWidth: 1, ...styles.wordContainer}}>
            {suggestedWordElements[0]}
          </View>
          <View style={{...styles.wordContainer}}>
            {suggestedWordElements[1]}
          </View>
        </>
      ) : (
        <View style={{...styles.wordContainer}}>
          {suggestedWordElements.length === 0 ? (
            <View style={styles.keyElementContainer} />
          ) : (
            suggestedWordElements[0]
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wordContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: COLORS.opaicityGray,
  },
  keyElementContainer: {
    minHeight: 60,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyElementText: {
    textTransform: 'capitalize',
    fontSize: SIZES.large,
    color: COLORS.lightModeText,
    includeFontPadding: false,
  },
});
