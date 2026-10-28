import React, { memo, useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemeText } from '../../../../../functions/CustomElements';
import { shuffleArray } from '../../../../../functions';
import { useTheme } from '../../../../../../context-store/theme';
import { useTranslation } from 'react-i18next';

// "Try asking" 2x2 card grid: Unlock AI (display only) and the empty chat,
// where `onSelect(text)` sends the example.
function QuestionDiscoveryGridComponent({ onSelect }) {
  const { tokens } = useTheme();
  const { t } = useTranslation();

  const examples = t('apps.chatGPT.exampleSearchCards.examples', {
    returnObjects: true,
  });

  const items = useMemo(() => {
    if (!Array.isArray(examples) || examples.length < 4) return [];
    return shuffleArray([...examples]).slice(0, 4);
  }, [examples]);

  if (!items.length) return null;

  return (
    <View>
      <ThemeText
        styles={[styles.label, { color: tokens.muted }]}
        content={t('apps.chatGPT.exampleSearchCards.tryAsking')}
      />
      <View style={styles.grid}>
        {items.map((item, index) => (
          <TouchableOpacity
            key={index}
            disabled={!onSelect}
            activeOpacity={0.7}
            accessibilityRole={onSelect ? 'button' : undefined}
            onPress={() => onSelect(`${item.topLine} ${item.bottomLine}`)}
            style={[styles.card, { backgroundColor: tokens.surface }]}
          >
            <ThemeText
              styles={[styles.category, { color: tokens.muted }]}
              content={item.category}
            />
            <ThemeText styles={styles.question} content={item.topLine} />
            <ThemeText
              styles={[styles.context, { color: tokens.muted }]}
              content={item.bottomLine}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default memo(QuestionDiscoveryGridComponent);

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 24,
    marginHorizontal: 4,
    marginBottom: 8,
    includeFontPadding: false,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    width: '47%',
    flexGrow: 1,
    minHeight: 112,
    padding: 14,
    borderRadius: 20,
    gap: 4,
  },
  category: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
  },
  question: {
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
  },
  context: {
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
  },
});
