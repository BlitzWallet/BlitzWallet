import { View, StyleSheet } from 'react-native';
import { FONT } from '../../constants';
import { ThemeText } from '../../functions/CustomElements';
import { useGlobalThemeContext } from '../../../context-store/theme';

export function KeyContainer({ keys, variant = 'tiles' }) {
  const { tokens } = useGlobalThemeContext();

  if (variant === 'card') {
    const half = Math.ceil(keys.length / 2);
    const columns = [keys.slice(0, half), keys.slice(half)];

    return (
      <View style={[styles.card, { backgroundColor: tokens.surface }]}>
        {columns.map((column, columnIndex) => (
          <View key={columnIndex} style={styles.cardColumn}>
            {column.map((word, index) => {
              const number = columnIndex * half + index + 1;
              return (
                <View
                  key={number}
                  accessible
                  accessibilityLabel={`${number}, ${word}`}
                  style={[
                    styles.cardRow,
                    index > 0 && {
                      borderTopWidth: 1,
                      borderTopColor: tokens.divider,
                    },
                  ]}
                >
                  <ThemeText
                    styles={[styles.cardNumber, { color: tokens.muted }]}
                    content={`${number}`}
                  />
                  <ThemeText
                    styles={[styles.cardWord, { color: tokens.ink }]}
                    content={word}
                  />
                </View>
              );
            })}
          </View>
        ))}
      </View>
    );
  }

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
          style={[styles.seedItem, { backgroundColor: tokens.surface }]}
        >
          <ThemeText
            styles={[styles.numberText, { color: tokens.muted }]}
            content={`${number}.`}
          />
          <ThemeText
            styles={[styles.wordText, { color: tokens.ink }]}
            content={word}
          />
        </View>
      ))}
    </View>
  ));
}

const styles = StyleSheet.create({
  // Tiles: 2-column grid of white r14 cells (audit/design OnboardingWeb).
  row: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  seedItem: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  numberText: {
    width: 22,
    fontSize: 13,
    lineHeight: 19,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  wordText: {
    flexShrink: 1,
    fontFamily: FONT.Title_Regular,
    fontSize: 15,
    lineHeight: 22,
    includeFontPadding: false,
  },

  // D292: one card, numbered down each column (1–6, 7–12).
  card: {
    width: '100%',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 20,
    flexDirection: 'row',
    columnGap: 24,
  },
  cardColumn: { flex: 1, minWidth: 0 },
  cardRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardNumber: {
    width: 22,
    fontSize: 13,
    lineHeight: 19,
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  cardWord: {
    flexShrink: 1,
    fontFamily: FONT.Title_Regular,
    fontSize: 16,
    lineHeight: 22,
    includeFontPadding: false,
  },
});
