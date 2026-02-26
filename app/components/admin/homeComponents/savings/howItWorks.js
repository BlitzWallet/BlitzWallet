import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useState, useCallback } from 'react';
import { ThemeText } from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import GetThemeColors from '../../../../hooks/themeColors';
import { COLORS, FONT, SIZES } from '../../../../constants/theme';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';

const H_PADDING = 16;
const CARD_H_PADDING = 14;

function StatsRow({
  stats,
  correctBackground,
  textColor,
  theme,
  darkModeType,
}) {
  const { width: windowWidth } = useWindowDimensions();
  const containerWidth = windowWidth - H_PADDING * 2;

  // Track measured natural widths for each card
  const [naturalWidths, setNaturalWidths] = useState({});

  const onCardLayout = useCallback((index, event) => {
    const { width } = event.nativeEvent.layout;
    setNaturalWidths(prev => {
      if (prev[index] === width) return prev;
      return { ...prev, [index]: width };
    });
  }, []);

  const allMeasured = Object.keys(naturalWidths).length === stats.length;

  const rows = (() => {
    if (!allMeasured) return [stats.map((_, i) => i)];

    const groups = [];
    let i = 0;
    while (i < stats.length) {
      let rowWidth = 0;
      let j = i;
      while (j < stats.length) {
        const cardWidth = naturalWidths[j] + CARD_H_PADDING * 2;
        if (rowWidth + cardWidth > containerWidth + 1) break;
        rowWidth += cardWidth;
        j++;
      }

      const count = Math.max(1, j - i);
      groups.push(
        stats
          .slice(i, i + count)
          .map((s, k) => ({ ...s, originalIndex: i + k })),
      );
      i += count;
    }
    return groups;
  })();

  const isTriangle =
    rows.length === 2 && rows[0].length === 2 && rows[1].length === 1;

  return (
    <View style={[styles.statsCard, { backgroundColor: correctBackground }]}>
      {!allMeasured && (
        <View style={styles.measureContainer} pointerEvents="none" aria-hidden>
          {stats.map((stat, i) => (
            <StatCell
              key={`measure-${stat.label}`}
              stat={stat}
              measuring
              onLayout={e => onCardLayout(i, e)}
              textColor={textColor}
              theme={theme}
              darkModeType={darkModeType}
            />
          ))}
        </View>
      )}

      {allMeasured &&
        rows.map((row, rowIndex) => (
          <View
            key={rowIndex}
            style={[
              styles.statsRow,
              isTriangle && rowIndex === 1 && styles.statsRowCentered,
              rowIndex < rows.length - 1 && styles.statsRowBorderBottom,
            ]}
          >
            {row.map((item, colIndex) => (
              <StatCell
                key={item.label}
                stat={item}
                showRightBorder={colIndex < row.length - 1}
                textColor={textColor}
                theme={theme}
                darkModeType={darkModeType}
                style={
                  isTriangle && rowIndex === 1 ? styles.statCellAuto : undefined
                }
              />
            ))}
          </View>
        ))}
    </View>
  );
}

function StatCell({
  stat,
  measuring,
  onLayout,
  showRightBorder,
  textColor,
  theme,
  darkModeType,
  style,
}) {
  return (
    <View
      onLayout={onLayout}
      style={[
        styles.statCell,
        !measuring && showRightBorder && styles.statCellBorderRight,
        measuring && styles.statCellMeasuring,
        style,
      ]}
    >
      <ThemeText
        styles={[
          styles.statValue,
          { color: theme && darkModeType ? textColor : COLORS.primary },
        ]}
        content={stat.value}
      />
      <ThemeText styles={styles.statLabel} content={stat.label} />
    </View>
  );
}

export default function HowSavingsWorks() {
  const { t } = useTranslation();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();

  const FEATURES = [
    {
      icon: 'TrendingUp',
      title: t('savings.howItWorks.features.earnTitle'),
      body: t('savings.howItWorks.features.earnBody'),
    },
    {
      icon: 'Zap',
      title: t('savings.howItWorks.features.accessTitle'),
      body: t('savings.howItWorks.features.accessBody'),
    },
    {
      icon: 'ShieldCheck',
      title: t('savings.howItWorks.features.backedTitle'),
      body: t('savings.howItWorks.features.backedBody'),
    },
    {
      icon: 'Sparkles',
      title: t('savings.howItWorks.features.goalTitle'),
      body: t('savings.howItWorks.features.goalBody'),
    },
  ];

  const STATS = [
    {
      label: t('savings.howItWorks.stats.currentApyLabel'),
      value: t('savings.howItWorks.stats.currentApyValue'),
    },
    {
      label: t('savings.howItWorks.stats.accrualLabel'),
      value: t('savings.howItWorks.stats.accrualValue'),
    },
    {
      label: t('constants.minimum'),
      value: displayCorrectDenomination({
        amount: 10,
        masterInfoObject: {
          ...masterInfoObject,
          userBalanceDenomination: 'fiat',
        },
        fiatStats,
        forceCurrency: 'USD',
        convertAmount: false,
      }),
    },
  ];

  const { backgroundOffset, textColor, backgroundColor } = GetThemeColors();
  const correctBackground =
    theme && darkModeType ? backgroundColor : backgroundOffset;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <ThemeText
          styles={styles.headline}
          content={t('savings.howItWorks.headline1')}
        />
        <ThemeText
          styles={styles.headline}
          content={t('savings.howItWorks.headline2')}
        />
        <ThemeText
          styles={styles.subtext}
          content={t('savings.howItWorks.subtext')}
        />
      </View>

      <StatsRow
        stats={STATS}
        correctBackground={correctBackground}
        textColor={textColor}
        theme={theme}
        darkModeType={darkModeType}
      />

      <View style={styles.featureList}>
        {FEATURES.map(feat => (
          <View key={feat.icon} style={styles.featureRow}>
            <View
              style={[
                styles.featureIconCircle,
                { backgroundColor: correctBackground },
              ]}
            >
              <ThemeIcon
                iconName={feat.icon}
                size={18}
                colorOverride={
                  theme && darkModeType ? textColor : COLORS.primary
                }
              />
            </View>
            <View style={styles.featureText}>
              <ThemeText styles={styles.featureTitle} content={feat.title} />
              <ThemeText styles={styles.featureBody} content={feat.body} />
            </View>
          </View>
        ))}
      </View>

      <View
        style={[
          styles.transparencyCard,
          { backgroundColor: correctBackground },
        ]}
      >
        <View style={styles.transparencyHeader}>
          <ThemeIcon
            iconName="BadgeCheck"
            size={18}
            colorOverride={theme && darkModeType ? textColor : COLORS.primary}
          />
          <ThemeText
            styles={styles.transparencyTitle}
            content={t('savings.howItWorks.transparencyTitle')}
          />
        </View>
        <ThemeText
          styles={styles.transparencyBody}
          content={t('savings.howItWorks.transparencyBody')}
        />
      </View>

      <ThemeText
        styles={styles.disclaimer}
        content={t('savings.howItWorks.disclaimer')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: H_PADDING,
    paddingTop: 4,
    paddingBottom: 24,
    gap: 20,
  },

  // Hero
  hero: { gap: 4, paddingBottom: 4 },
  headline: {
    fontSize: SIZES.xxLarge,
    fontFamily: FONT.Title_Regular,
    fontWeight: 500,
    lineHeight: 38,
    includeFontPadding: false,
  },
  subtext: {
    fontSize: SIZES.smedium,
    opacity: 0.65,
    lineHeight: 20,
    includeFontPadding: false,
    marginTop: 6,
  },

  // Stats card wrapper
  statsCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },

  // Each row inside the stats card
  statsRow: {
    flexDirection: 'row',
  },
  statsRowCentered: {
    justifyContent: 'center',
  },
  statsRowBorderBottom: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.gray2,
  },

  // Individual stat cell
  statCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: CARD_H_PADDING,
    gap: 2,
  },
  statCellAuto: {
    flex: 0, // don't stretch when centered on its own row
  },
  statCellBorderRight: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: COLORS.gray2,
  },
  statCellMeasuring: {
    // Sits in the hidden measure container; needs to size to content
    flex: 0,
  },

  // Measurement container — zero height, invisible
  measureContainer: {
    flexDirection: 'row',
    opacity: 0,
    height: 0,
    overflow: 'hidden',
  },

  statValue: {
    fontSize: SIZES.large,
    fontFamily: FONT.Title_Bold,
    includeFontPadding: false,
  },
  statLabel: {
    fontSize: SIZES.xSmall,
    opacity: 0.6,
    includeFontPadding: false,
  },

  // Features
  featureList: { gap: 16 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  featureIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  featureText: { flex: 1, gap: 2 },
  featureTitle: {
    fontSize: SIZES.smedium,
    fontWeight: 500,
    includeFontPadding: false,
  },
  featureBody: {
    fontSize: SIZES.small,
    opacity: 0.65,
    lineHeight: 18,
    includeFontPadding: false,
  },

  // Transparency
  transparencyCard: {
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  transparencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  transparencyTitle: {
    fontSize: SIZES.smedium,
    fontWeight: 500,
    includeFontPadding: false,
  },
  transparencyBody: {
    fontSize: SIZES.small,
    opacity: 0.65,
    lineHeight: 18,
    includeFontPadding: false,
  },

  // Disclaimer
  disclaimer: {
    fontSize: SIZES.xSmall,
    opacity: 0.45,
    lineHeight: 15,
    textAlign: 'center',
    includeFontPadding: false,
    paddingBottom: 4,
  },
});
