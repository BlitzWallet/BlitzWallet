import { useNavigation } from '@react-navigation/native';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  CENTER,
  COLORS,
  NEAR_BUDGET_LIMIT,
  OVER_BUDGET_LIMIT,
  SIZES,
} from '../../constants';
import { useGlobalContextProvider } from '../../../context-store/context';
import { useGlobalInsets } from '../../../context-store/insetsProvider';
import BalancePieChart from '../../components/admin/homeComponents/analytics/balancePieChart';
import { INSET_WINDOW_WIDTH } from '../../constants/theme';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import CustomSettingsTopBar from '../../functions/CustomElements/settingsTopBar';
import GetThemeColors from '../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../context-store/theme';
import displayCorrectDenomination from '../../functions/displayCorrectDenomination';
import { useNodeContext } from '../../../context-store/nodeContext';
import FullLoadingScreen from '../../functions/CustomElements/loadingScreen';
import { useAnalytics } from '../../../context-store/analyticsContext';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import { useTranslation } from 'react-i18next';

export default function AnalyticsPage() {
  const navigate = useNavigation();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { bottomPadding } = useGlobalInsets();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor, textColor } = GetThemeColors();
  const { incomeTotal, spentTotal, incomeTxCount, spentTxCount, isLoading } =
    useAnalytics();
  const { t } = useTranslation();

  const budget = masterInfoObject?.monthlyBudget;
  const budgetAmount = budget?.amount || 0;
  const leftToSpend = Math.max(budgetAmount - spentTotal, 0);
  const spentPercent = budgetAmount > 0 ? spentTotal / budgetAmount : 0;

  const budgetStatus =
    spentPercent >= OVER_BUDGET_LIMIT
      ? {
          label: t('analytics.overBudget'),
          color: theme && darkModeType ? textColor : COLORS.cancelRed,
        }
      : spentPercent >= NEAR_BUDGET_LIMIT
      ? {
          label: t('analytics.nearLimit'),
          color: theme && darkModeType ? textColor : COLORS.bitcoinOrange,
        }
      : {
          label: t('analytics.onTrack'),
          color: theme && darkModeType ? textColor : COLORS.primary,
        };

  return (
    <GlobalThemeView styles={{ paddingBottom: 0 }} useStandardWidth={true}>
      <CustomSettingsTopBar
        label={t('analytics.home.title')}
        containerStyles={{ marginBottom: 0 }}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          {
            alignSelf: 'center',
            paddingBottom: bottomPadding,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <BalancePieChart />

        <ThemeText
          styles={styles.sectionTitle}
          content={t('analytics.home.activityHead')}
        />
        {/* Income + Spent row */}
        <View style={styles.metricsRow}>
          <TouchableOpacity
            style={[styles.metricCard, { backgroundColor: backgroundOffset }]}
            onPress={() => navigate.navigate('AnalyticsIncomePage')}
            activeOpacity={0.8}
          >
            <ThemeText
              styles={styles.metricLabel}
              content={t('constants.received')}
            />
            {isLoading ? (
              <FullLoadingScreen size="small" showText={false} />
            ) : (
              <>
                <ThemeText
                  CustomNumberOfLines={1}
                  adjustsFontSizeToFit={true}
                  styles={styles.metricAmount}
                  content={displayCorrectDenomination({
                    amount: incomeTotal,
                    masterInfoObject,
                    fiatStats,
                  })}
                />
                <ThemeText
                  styles={styles.metricSubText}
                  content={
                    incomeTxCount === 0
                      ? t('analytics.home.noPaymentsReceived')
                      : t('numberOfTxs', { count: incomeTxCount })
                  }
                />
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.metricCard, { backgroundColor: backgroundOffset }]}
            onPress={() => navigate.navigate('AnalyticsSpentPage')}
            activeOpacity={0.8}
          >
            <ThemeText
              styles={styles.metricLabel}
              content={t('constants.sent')}
            />
            {isLoading ? (
              <FullLoadingScreen size="small" showText={false} />
            ) : (
              <>
                <ThemeText
                  CustomNumberOfLines={1}
                  adjustsFontSizeToFit={true}
                  styles={styles.metricAmount}
                  content={displayCorrectDenomination({
                    amount: spentTotal,
                    masterInfoObject,
                    fiatStats,
                  })}
                />
                <ThemeText
                  styles={styles.metricSubText}
                  content={
                    spentTxCount === 0
                      ? t('analytics.home.noPaymentsSent')
                      : t('numberOfTxs', { count: spentTxCount })
                  }
                />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Budget section */}
        <ThemeText
          styles={styles.sectionTitle}
          content={t('analytics.home.budget')}
        />

        {!budget ? (
          <TouchableOpacity
            style={[
              styles.budgetEmptyCard,
              { backgroundColor: backgroundOffset },
            ]}
            onPress={() => navigate.navigate('AnalyticsCreateBudgetPage')}
            activeOpacity={0.8}
          >
            <View style={styles.emptyContactsContainer}>
              <ThemeIcon iconName={'ClipboardClock'} />
              <ThemeText
                styles={styles.emptyTitle}
                content={t('analytics.home.noBudgetTitle')}
              />
              <ThemeText
                styles={styles.emptySubtext}
                content={t('analytics.home.noBudgetSub')}
              />
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.budgetCard, { backgroundColor: backgroundOffset }]}
            onPress={() => navigate.navigate('AnalyticsBudgetPage')}
            activeOpacity={0.8}
          >
            <ThemeText
              styles={styles.budgetLeftAmount}
              content={t('analytics.home.leftToSpend', {
                amount: displayCorrectDenomination({
                  amount: leftToSpend,
                  masterInfoObject,
                  fiatStats,
                }),
              })}
            />
            <View style={styles.budgetStatusRow}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: budgetStatus.color },
                ]}
              />
              <ThemeText
                styles={[
                  styles.budgetStatusLabel,
                  { color: budgetStatus.color },
                ]}
                content={budgetStatus.label}
              />
            </View>

            {/* Progress bar */}
            <View style={[styles.progressBarTrack, { backgroundColor }]}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.min(spentPercent * 100, 100)}%`,
                    backgroundColor:
                      theme && darkModeType
                        ? COLORS.darkModeText
                        : budgetStatus.color,
                  },
                ]}
              />
            </View>
            <View style={styles.progressBarLabels}>
              <ThemeText
                styles={styles.progressBarLabelText}
                content={t('analytics.home.percentRemaining', {
                  percent: Math.round(Math.min((1 - spentPercent) * 100, 100)),
                })}
              />
              <ThemeText
                styles={styles.budgetLeftAmount}
                content={displayCorrectDenomination({
                  amount: budgetAmount,
                  masterInfoObject,
                  fiatStats,
                })}
              />
            </View>
          </TouchableOpacity>
        )}
      </ScrollView>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    width: INSET_WINDOW_WIDTH,
    paddingTop: 20,
    ...CENTER,
  },
  metricsRow: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
  },
  metricCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    minHeight: 130,
  },
  metricLabel: {
    fontSize: SIZES.smedium,
    opacity: 0.6,
    marginBottom: 8,
  },
  metricAmount: {
    fontSize: SIZES.xLarge,
    marginBottom: 4,
  },
  metricSubText: {
    fontSize: SIZES.small,
    opacity: 0.4,
  },
  miniChart: {
    marginTop: 8,
    marginLeft: -16,
    marginBottom: -20,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  budgetEmptyCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  budgetCard: {
    borderRadius: 16,
    padding: 16,
  },
  budgetLeftAmount: {
    fontSize: SIZES.xLarge,
    marginBottom: 6,
  },
  budgetStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  budgetStatusLabel: {
    fontSize: SIZES.smedium,
    fontWeight: '500',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressBarLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressBarLabelText: {
    fontSize: SIZES.smedium,
    opacity: 0.4,
  },
  emptyContactsContainer: {
    flex: 1,
    alignItems: 'center',
  },
  emptyTitle: {
    // fontSize: SIZES.large,
    // fontWeight: '500',
    marginTop: 16,
    marginBottom: 5,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: SIZES.small,
    opacity: 0.6,
    textAlign: 'center',
  },
});
