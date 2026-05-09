import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemeText } from '../../../../../functions/CustomElements';
import { shuffleArray } from '../../../../../functions';
import GetThemeColors from '../../../../../hooks/themeColors';
import { useTranslation } from 'react-i18next';
import { SIZES } from '../../../../../constants';

function QuestionDiscoveryGridComponent() {
  const { backgroundOffset } = GetThemeColors();
  const { t } = useTranslation();

  const examples = t('apps.chatGPT.exampleSearchCards.examples', {
    returnObjects: true,
  });

  const items = useMemo(() => {
    if (!Array.isArray(examples) || examples.length < 6) return [];
    return shuffleArray([...examples]).slice(0, 6);
  }, [examples]);

  if (items.length < 6) return null;

  return (
    <View style={styles.container}>
      {/* Row group 1: tall-left, two-small-right */}
      <View style={styles.rowGroup}>
        <View style={styles.column}>
          <QuestionCard
            item={items[0]}
            tall
            backgroundColor={backgroundOffset}
          />
        </View>
        <View style={styles.column}>
          <QuestionCard
            item={items[1]}
            backgroundColor={backgroundOffset}
            style={styles.smallCardGap}
          />
          <QuestionCard item={items[2]} backgroundColor={backgroundOffset} />
        </View>
      </View>

      {/* Row group 2: two-small-left, tall-right */}
      <View style={styles.rowGroup}>
        <View style={styles.column}>
          <QuestionCard
            item={items[3]}
            backgroundColor={backgroundOffset}
            style={styles.smallCardGap}
          />
          <QuestionCard item={items[4]} backgroundColor={backgroundOffset} />
        </View>
        <View style={styles.column}>
          <QuestionCard
            item={items[5]}
            tall
            backgroundColor={backgroundOffset}
          />
        </View>
      </View>
    </View>
  );
}

const QuestionCard = memo(function QuestionCard({
  item,
  tall,
  backgroundColor,
  style,
}) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor },
        tall ? styles.tallCard : styles.smallCard,
        style,
      ]}
    >
      <ThemeText styles={styles.categoryLabel} content={item.category} />
      <ThemeText styles={styles.questionText} content={item.topLine} />
      {tall && (
        <ThemeText styles={styles.contextText} content={item.bottomLine} />
      )}
    </View>
  );
});

export default memo(QuestionDiscoveryGridComponent);

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  rowGroup: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  column: {
    flex: 1,
  },
  tallCard: {
    flex: 1,
    justifyContent: 'space-between',
  },
  smallCard: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  smallCardGap: {
    marginBottom: 8,
  },
  card: {
    borderRadius: 12,
    padding: 12,
  },
  categoryLabel: {
    fontSize: SIZES.small,
    opacity: 0.55,
  },
  questionText: {
    fontSize: SIZES.small,
    fontWeight: '600',
    marginTop: 4,
  },
  contextText: {
    fontSize: SIZES.small,
    opacity: 0.5,
  },
});
