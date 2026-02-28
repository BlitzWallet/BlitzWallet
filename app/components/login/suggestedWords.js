import React, {
  useMemo,
  useCallback,
  useState,
  useRef,
  useEffect,
} from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { wordlist } from '@scure/bip39/wordlists/english';
import { COLORS, SIZES } from '../../constants';
import { ThemeText } from '../../functions/CustomElements';
import useDebounce from '../../hooks/useDebounce';
import customUUID from '../../functions/customUUID';
import GetThemeColors from '../../hooks/themeColors';

const MAX_SUGGESTIONS = 3;

export default function SuggestedWordContainer({
  inputedKey,
  selectedKey,
  setInputedKey,
  keyRefs,
}) {
  const { backgroundColor } = GetThemeColors();
  const searchingWord = inputedKey[`key${selectedKey}`] || '';
  const [debouncedSearchword, setDebouncedSearchWord] = useState('');
  const searchTrackerRef = useRef(null);

  const handleSearchTrackerRef = () => {
    const requestUUID = customUUID();
    searchTrackerRef.current = requestUUID;
    return requestUUID;
  };

  const debouncedSearch = useDebounce(async (term, requestUUID) => {
    if (searchTrackerRef.current !== requestUUID) {
      return;
    }
    setDebouncedSearchWord(term);
  }, 150);

  useEffect(() => {
    const requestUUID = handleSearchTrackerRef();
    debouncedSearch(searchingWord, requestUUID);
  }, [searchingWord, debouncedSearch]);

  // Smart alphabetical search with binary search + early termination
  const suggestedWords = useMemo(() => {
    const lowerSearchWord = debouncedSearchword.toLowerCase();
    const results = [];

    // Binary search to find the starting position
    const findStartIndex = () => {
      let left = 0;
      let right = wordlist.length - 1;
      let startIndex = -1;

      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const midWord = wordlist[mid].toLowerCase();

        if (midWord.startsWith(lowerSearchWord)) {
          startIndex = mid;
          // Continue searching left to find the first occurrence
          right = mid - 1;
        } else if (midWord < lowerSearchWord) {
          left = mid + 1;
        } else {
          right = mid - 1;
        }
      }

      return startIndex;
    };

    const startIndex = findStartIndex();

    if (startIndex === -1) return [];

    for (
      let i = startIndex;
      i < wordlist.length && results.length < MAX_SUGGESTIONS;
      i++
    ) {
      const word = wordlist[i];
      const lowerWord = word.toLowerCase();

      if (lowerWord.startsWith(lowerSearchWord)) {
        results.push(word);
      } else {
        break;
      }
    }

    return results;
  }, [debouncedSearchword]);

  const handleWordPress = useCallback(
    word => {
      setInputedKey(prev => ({ ...prev, [`key${selectedKey}`]: word }));
      if (selectedKey === 12) {
        keyRefs.current[12].blur();
      } else {
        keyRefs.current[selectedKey + 1].focus();
      }
    },
    [selectedKey, setInputedKey, keyRefs],
  );

  const renderWordButton = useCallback(
    (word, showBorder = false) => (
      <View
        key={word}
        style={[
          styles.wordContainer,
          showBorder && styles.borderRight,
          { borderTopWidth: 2, borderColor: backgroundColor },
        ]}
      >
        <TouchableOpacity
          style={styles.keyElementContainer}
          onPress={() => handleWordPress(word)}
          activeOpacity={0.7}
        >
          <ThemeText
            CustomNumberOfLines={1}
            styles={styles.keyElementText}
            content={word}
          />
        </TouchableOpacity>
      </View>
    ),
    [handleWordPress, backgroundColor],
  );

  const renderSuggestions = () => {
    const count = suggestedWords.length;

    if (count === 0) {
      return (
        <View
          style={[
            styles.wordContainer,
            { borderTopWidth: 2, borderTopColor: backgroundColor },
          ]}
        >
          <View style={styles.keyElementContainer} />
        </View>
      );
    }

    if (count === 1) {
      return renderWordButton(suggestedWords[0]);
    }

    if (count === 2) {
      return (
        <>
          {renderWordButton(suggestedWords[0], true)}
          {renderWordButton(suggestedWords[1])}
        </>
      );
    }

    return (
      <>
        {renderWordButton(suggestedWords[0], true)}
        {renderWordButton(suggestedWords[1], true)}
        {renderWordButton(suggestedWords[2])}
      </>
    );
  };

  return <View style={styles.wordsContainer}>{renderSuggestions()}</View>;
}

const styles = StyleSheet.create({
  wordContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: COLORS.opaicityGray,
  },
  borderRight: {
    borderRightWidth: 1,
  },
  wordsContainer: {
    backgroundColor: COLORS.darkModeText,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
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
