import { useNavigation } from '@react-navigation/native';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import {
  COLORS,
  FONT,
  NEAR_BUDGET_LIMIT,
  OVER_BUDGET_LIMIT,
  SIZES,
} from '../../../../constants';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useMemo } from 'react';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import NoContentSceen from '../../../../functions/CustomElements/noContentScreen';
import GetThemeColors from '../../../../hooks/themeColors';
import {
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../constants/theme';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useAnalytics } from '../../../../../context-store/analyticsContext';
import { useTranslation } from 'react-i18next';

const CIRCLE_SIZE = 220;
const STROKE_WIDTH = 16;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CX = CIRCLE_SIZE / 2;
const CY = CIRCLE_SIZE / 2;

export default function AnalyticsBudgetPage() {
  const navigate = useNavigation();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { bottomPadding } = useGlobalInsets();
  const { textColor, backgroundOffset, backgroundColor } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { spentTotal, spentTxCount } = useAnalytics();
  const { t } = useTranslation();

  const budget = masterInfoObject?.monthlyBudget;
  const budgetAmount = budget?.amount || 0;
  const userBalanceDenomination = masterInfoObject.userBalanceDenomination;
  const leftToSpend = Math.max(budgetAmount - spentTotal, 0);
  const spentPercent =
    budgetAmount > 0 ? Math.min(spentTotal / budgetAmount, 1) : 0;

  const budgetStatus = useMemo(() => {
    if (spentPercent >= OVER_BUDGET_LIMIT)
      return {
        label: t('analytics.overBudget'),
        color: theme && darkModeType ? textColor : COLORS.cancelRed,
      };
    if (spentPercent >= NEAR_BUDGET_LIMIT)
      return {
        label: t('analytics.nearLimit'),
        color: theme && darkModeType ? textColor : COLORS.bitcoinOrange,
      };
    return {
      label: t('analytics.onTrack'),
      color: theme && darkModeType ? textColor : COLORS.primary,
    };
  }, [spentPercent]);

  const dashOffset = CIRCUMFERENCE * (1 - spentPercent);

  const navigateToRemoveBudget = () => {
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'RemoveBudgetHalfModal',
    });
  };

  if (!budget) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <CustomSettingsTopBar label={t('analytics.budget.budget')} />
        <NoContentSceen
          iconName="Wallet"
          titleText={t('analytics.budget.noBudgetSet')}
          subTitleText={t('analytics.budget.noBudgetSetSub')}
          showButton={true}
          buttonText={t('analytics.budget.noBudgetSetButton')}
          buttonFunction={() => navigate.navigate('AnalyticsCreateBudgetPage')}
        />
      </GlobalThemeView>
    );
  }

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar
        label={t('analytics.budget.budget')}
        showLeftImage={true}
        iconNew="Trash2"
        leftImageFunction={navigateToRemoveBudget}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomPadding + 20 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Status badge */}
        <View style={styles.statusContainer}>
          <View
            style={[styles.statusDot, { backgroundColor: budgetStatus.color }]}
          />
          <Text style={[styles.statusText, { color: budgetStatus.color }]}>
            {budgetStatus.label}
          </Text>
          <Text style={[styles.statusDivider, { color: textColor }]}> · </Text>
          <Text
            style={[styles.statusPeriod, { color: textColor, opacity: 0.5 }]}
          >
            {t('analytics.thisMonth')}
          </Text>
        </View>

        {/* Circular progress */}
        <View style={styles.circleContainer}>
          <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
            {/* Track */}
            <Circle
              cx={CX}
              cy={CY}
              r={RADIUS}
              fill="none"
              stroke={backgroundOffset}
              strokeWidth={STROKE_WIDTH}
            />
            {/* Progress arc */}
            <Circle
              cx={CX}
              cy={CY}
              r={RADIUS}
              fill="none"
              stroke={budgetStatus.color}
              strokeWidth={STROKE_WIDTH}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              rotation="-90"
              origin={`${CX}, ${CY}`}
            />
          </Svg>
          {/* Center label */}
          <View style={styles.circleCenter} pointerEvents="none">
            <ThemeText
              styles={styles.centerText}
              content={displayCorrectDenomination({
                amount: leftToSpend,
                masterInfoObject,
                fiatStats,
              })}
              CustomNumberOfLines={1}
              adjustsFontSizeToFit={true}
            />

            <ThemeText
              styles={styles.centerTextLabel}
              content={t('analytics.budget.leftToSpend')}
              CustomNumberOfLines={1}
              adjustsFontSizeToFit={true}
            />
          </View>
        </View>

        {/* Stats rows */}
        <View style={[styles.statsCard, { backgroundColor: backgroundOffset }]}>
          {/* Budget row with edit */}
          <View style={styles.statsRow}>
            <View style={styles.statsRowLeft}>
              <ThemeIcon iconName="PieChart" size={20} />
              <View style={styles.statsRowText}>
                <ThemeText
                  styles={styles.statsLabel}
                  content={t('analytics.budget.budget')}
                />
              </View>
            </View>
            <View style={styles.statsRowRight}>
              <TouchableOpacity
                onPress={() => navigate.navigate('AnalyticsCreateBudgetPage')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <ThemeIcon iconName="Edit" size={16} />
              </TouchableOpacity>
              <FormattedSatText
                balance={budgetAmount}
                globalBalanceDenomination={userBalanceDenomination}
                styles={styles.statsValue}
                neverHideBalance={true}
              />
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor }]} />

          {/* Spent this month */}
          <View style={styles.statsRow}>
            <View style={styles.statsRowLeft}>
              <ThemeIcon iconName="Coins" size={20} />
              <View style={styles.statsRowText}>
                <ThemeText
                  styles={styles.statsLabel}
                  content={t('analytics.budget.spentThisMonth')}
                />
                <ThemeText
                  styles={styles.statsSubLabel}
                  content={t('analytics.numberOfTxs', {
                    count: spentTxCount,
                  })}
                />
              </View>
            </View>
            <FormattedSatText
              balance={spentTotal}
              globalBalanceDenomination={userBalanceDenomination}
              styles={styles.statsValue}
              neverHideBalance={true}
            />
          </View>

          <View style={[styles.divider, { backgroundColor }]} />

          {/* Left to spend */}
          <View style={styles.statsRow}>
            <View style={styles.statsRowLeft}>
              <ThemeIcon iconName="Gauge" size={20} />
              <View style={styles.statsRowText}>
                <ThemeText
                  styles={styles.statsLabel}
                  content={t('analytics.budget.leftToSpend')}
                />
              </View>
            </View>
            <View style={styles.statsRowRight}>
              <FormattedSatText
                balance={leftToSpend}
                globalBalanceDenomination={userBalanceDenomination}
                styles={styles.statsValue}
                neverHideBalance={true}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    width: INSET_WINDOW_WIDTH,
    alignSelf: 'center',
    alignItems: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: SIZES.smedium,
    fontFamily: FONT.Title_Regular,
    includeFontPadding: false,
  },
  statusDivider: {
    fontSize: SIZES.smedium,
    fontFamily: FONT.Title_Regular,
    includeFontPadding: false,
  },
  statusPeriod: {
    fontSize: SIZES.smedium,
    fontFamily: FONT.Title_Regular,
    includeFontPadding: false,
  },
  circleContainer: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  circleCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    maxWidth: '85%',
    fontSize: SIZES.large,
    textAlign: 'center',
    includeFontPadding: false,
  },
  centerTextLabel: {
    fontSize: SIZES.small,
    textAlign: 'center',
    includeFontPadding: false,
    opacity: HIDDEN_OPACITY,
  },
  statsCard: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  statsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statsRowText: {
    marginLeft: 12,
    flex: 1,
  },
  statsLabel: {
    fontSize: SIZES.smedium,
    includeFontPadding: false,
  },
  statsSubLabel: {
    fontSize: SIZES.small,
    opacity: 0.5,
    marginTop: 2,
    includeFontPadding: false,
  },
  statsRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statsValue: {
    textAlign: 'right',
    includeFontPadding: false,
  },
  divider: {
    height: 2,
    marginHorizontal: 16,
  },
});
