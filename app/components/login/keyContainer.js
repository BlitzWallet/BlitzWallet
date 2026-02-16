import { View, StyleSheet } from 'react-native';
import { COLORS, FONT, SIZES } from '../../constants';
import { ThemeText } from '../../functions/CustomElements';
import GetThemeColors from '../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../context-store/theme';

export function KeyContainer({ keys }) {
  const { theme } = useGlobalThemeContext();
  const { backgroundOffset } = GetThemeColors();

  const groupedKeys = [];
  let tempArr = [];

  keys.forEach((word, index) => {
    tempArr.push([word, index + 1]);
    if (tempArr.length === 2) {
      groupedKeys.push(tempArr);
      tempArr = [];
    }
  });
  if (tempArr.length > 0) {
    groupedKeys.push(tempArr);
  }

  return groupedKeys.map((pair, pairIndex) => (
    <View style={styles.row} key={pairIndex}>
      {pair.map(([word, number]) => (
        <View
          key={number}
          style={[
            styles.seedItem,
            {
              backgroundColor: theme ? backgroundOffset : COLORS.darkModeText,
            },
          ]}
        >
          <ThemeText styles={styles.numberText} content={`${number}.`} />
          <ThemeText
            styles={[
              styles.wordText,
              { color: theme ? COLORS.darkModeText : COLORS.lightModeText },
            ]}
            content={word}
          />
        </View>
      ))}
    </View>
  ));
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  seedItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  numberText: {
    marginRight: 10,
    includeFontPadding: false,
  },
  wordText: {
    flexShrink: 1,
    includeFontPadding: false,
    fontSize: SIZES.smedium,
  },
});
