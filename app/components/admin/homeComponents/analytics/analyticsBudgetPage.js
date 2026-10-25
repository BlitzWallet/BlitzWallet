import { useNavigation } from '@react-navigation/native';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import Svg, { Circle } from 'react-native-svg';
import { CENTER, FONT, MAX_WEB_CONTENT_WIDTH } from '../../../../constants';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useAnalytics } from '../../../../../context-store/analyticsContext';
import { useTranslation } from 'react-i18next';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import EmptyState from '../../../../functions/CustomElements/redesign/EmptyState';
import CustomButton from '../../../../functions/CustomElements/button';
import IconButton from '../../../../functions/CustomElements/redesign/IconButton';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import Disc from '../../../../functions/CustomElements/redesign/Disc';
import getBudgetStatus from './budgetStatus';

const CIRCLE_SIZE = 220;
const STROKE_WIDTH = 12;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CX = CIRCLE_SIZE / 2;
const CY = CIRCLE_SIZE / 2;

export default function AnalyticsBudgetPage() {
  const navigate = useNavigation();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { bottomPadding } = useGlobalInsets();
  const { tokens } = useGlobalThemeContext();
  const { spentTotal, spentTxCountBTC, spentTxCountUSD } = useAnalytics();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const budget = masterInfoObject?.monthlyBudget;
  const budgetAmount = budget?.amount || 0;
  const userBalanceDenomination = masterInfoObject.userBalanceDenomination;
  const leftToSpend = Math.max(budgetAmount - spentTotal, 0);
  const spentPercent =
    budgetAmount > 0 ? Math.min(spentTotal / budgetAmount, 1) : 0;

  const budgetStatus = getBudgetStatus(spentPercent, t, tokens);

  const dashOffset = CIRCUMFERENCE * (1 - spentPercent);

  const navigateToRemoveBudget = () => {
    navigate.navigate('CustomHalfModal', {
      wantedContent: 'RemoveBudgetHalfModal',
    });
  };

  if (!budget) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <View style={[styles.container, { width: contentWidth }]}>
          <TopBar title={t('analytics.budget.budget')} />
          <View style={styles.emptyContainer}>
            <EmptyState
              icon={'Wallet'}
              title={t('analytics.budget.noBudgetSet')}
              sub={t('analytics.budget.noBudgetSetSub')}
            />
          </View>
          <CustomButton
            size={'regular'}
            textContent={t('analytics.budget.noBudgetSetButton')}
            actionFunction={() =>
              navigate.navigate('AnalyticsCreateBudgetPage')
            }
          />
        </View>
      </GlobalThemeView>
    );
  }

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={t('analytics.budget.budget')}
          right={
            <IconButton
              icon={'Trash2'}
              label="analytics.budget.removeBudgetLabel"
              onPress={navigateToRemoveBudget}
            />
          }
        />
        <CustomScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: bottomPadding },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Circular progress */}
          <View style={styles.circleContainer}>
            <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
              {/* Track */}
              <Circle
                cx={CX}
                cy={CY}
                r={RADIUS}
                fill="none"
                stroke={tokens.divider}
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
                styles={[styles.centerTextLabel, { color: tokens.muted }]}
                content={t('analytics.thisMonth')}
                CustomNumberOfLines={1}
                adjustsFontSizeToFit={true}
              />
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
                styles={[styles.centerTextLabel, { color: tokens.muted }]}
                content={t('analytics.budget.leftToSpendRing')}
                CustomNumberOfLines={1}
                adjustsFontSizeToFit={true}
              />
            </View>
          </View>

          <ListCard style={styles.statsCard} dividerInset={64}>
            <ListRow
              titleStyle={styles.rowTitle}
              onPress={() => navigate.navigate('AnalyticsCreateBudgetPage')}
              lead={<Disc icon={'Target'} />}
              title={t('analytics.budget.budget')}
              trailing={
                <View style={styles.statsRowRight}>
                  <FormattedSatText
                    balance={budgetAmount}
                    globalBalanceDenomination={userBalanceDenomination}
                    styles={styles.statsValue}
                    neverHideBalance={true}
                  />

                  <ThemeIcon
                    redesign
                    iconName="Pencil"
                    size={16}
                    colorOverride={tokens.link}
                  />
                </View>
              }
            />
            <ListRow
              titleStyle={styles.rowTitle}
              minHeight={64}
              lead={<Disc icon={'Coins'} />}
              title={t('analytics.budget.spentThisMonth')}
              sub={t('analytics.numberOfTxs', {
                count: spentTxCountUSD + spentTxCountBTC,
              })}
              trailing={
                <FormattedSatText
                  balance={spentTotal}
                  globalBalanceDenomination={userBalanceDenomination}
                  styles={styles.statsValue}
                  neverHideBalance={true}
                />
              }
            />
            <ListRow
              titleStyle={styles.rowTitle}
              lead={<Disc icon={'Wallet'} />}
              title={t('analytics.budget.leftToSpend')}
              trailing={
                <FormattedSatText
                  balance={leftToSpend}
                  globalBalanceDenomination={userBalanceDenomination}
                  styles={styles.statsValue}
                  neverHideBalance={true}
                />
              }
            />
          </ListCard>
        </CustomScrollView>
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...CENTER,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: { alignItems: 'center', paddingTop: 20 },
  circleContainer: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  circleCenter: {
    position: 'absolute',
    width: CIRCLE_SIZE - STROKE_WIDTH * 2 - 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    fontFamily: FONT.Title_Medium,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.96,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    includeFontPadding: false,
  },
  centerTextLabel: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    includeFontPadding: false,
  },
  statsCard: {
    width: '100%',
  },
  rowTitle: { fontSize: 15, lineHeight: 21 },
  statsRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statsValue: {
    fontSize: 15,
    textAlign: 'right',
    includeFontPadding: false,
  },
});
