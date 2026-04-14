import { useNavigation } from '@react-navigation/native';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { CENTER, COLORS, FONT, SIZES } from '../../constants';
import { useGlobalContextProvider } from '../../../context-store/context';
import { useEffect, useState } from 'react';
import { useSparkWallet } from '../../../context-store/sparkContext';
import { useGlobalInsets } from '../../../context-store/insetsProvider';
import { getMonthlyTransactions, buildDailyBalances } from '../../functions/spark/transactions';
import PortfolioChart from '../../functions/CustomElements/portfolioChart';
import FormattedSatText from '../../functions/CustomElements/satTextDisplay';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import { HIDDEN_OPACITY, WINDOWWIDTH } from '../../constants/theme';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import CustomSettingsTopBar from '../../functions/CustomElements/settingsTopBar';
import GetThemeColors from '../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../context-store/theme';
import displayCorrectDenomination from '../../functions/displayCorrectDenomination';
import { useNodeContext } from '../../../context-store/nodeContext';
import NoContentSceen from '../../functions/CustomElements/noContentScreen';

export default function AnalyticsPage() {
  const navigate = useNavigation();
  const { masterInfoObject } = useGlobalContextProvider();
  const { sparkInformation } = useSparkWallet();
  const { fiatStats } = useNodeContext();
  const [incomeTotal, setIncomeTotal] = useState(0);
  const [spentTotal, setSpentTotal] = useState(0);
  const [incomeTxCount, setIncomeTxCount] = useState(0);
  const [spentTxCount, setSpentTxCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [dailyBalances, setDailyBalances] = useState([]);
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const chartWidth = Dimensions.get('screen').width * 0.95;

  const budget = masterInfoObject?.monthlyBudget;
  const budgetAmount = budget?.amount || 0;
  const leftToSpend = Math.max(budgetAmount - spentTotal, 0);
  const spentPercent = budgetAmount > 0 ? spentTotal / budgetAmount : 0;

  const budgetStatus =
    spentPercent >= 1
      ? { label: 'Over budget', color: COLORS.cancelRed }
      : spentPercent >= 0.75
      ? { label: 'Near limit', color: COLORS.bitcoinOrange }
      : { label: 'On track', color: COLORS.primary };

  const startBalanceSats = dailyBalances.length > 0 ? dailyBalances[0].balanceSats : sparkInformation.balance;
  const currentBalanceSats = sparkInformation.balance;
  const deltaBalanceSats = currentBalanceSats - startBalanceSats;
  const deltaPercent = startBalanceSats > 0 ? (deltaBalanceSats / startBalanceSats) * 100 : 0;
  const deltaIsPositive = deltaBalanceSats >= 0;

  const deltaDisplay = displayCorrectDenomination({
    amount: Math.abs(deltaBalanceSats),
    masterInfoObject,
    fiatStats,
  });
  const deltaSign = deltaIsPositive ? '+' : '-';
  const deltaColor = deltaIsPositive ? COLORS.primary : COLORS.cancelRed;

  const userBalanceDenomination = masterInfoObject.userBalanceDenomination;

  useEffect(() => {
    async function load() {
      if (!sparkInformation.identityPubKey) return;
      setIsLoading(true);
      try {
        const [inTxs, outTxs] = await Promise.all([
          getMonthlyTransactions(sparkInformation.identityPubKey, 'INCOMING'),
          getMonthlyTransactions(sparkInformation.identityPubKey, 'OUTGOING'),
        ]);
        const totalIn = inTxs.reduce((sum, tx) => {
          try {
            return sum + (JSON.parse(tx.details).amount || 0);
          } catch {
            return sum;
          }
        }, 0);
        const totalOut = outTxs.reduce((sum, tx) => {
          try {
            return sum + (JSON.parse(tx.details).amount || 0);
          } catch {
            return sum;
          }
        }, 0);
        setIncomeTotal(totalIn);
        setSpentTotal(totalOut);
        setIncomeTxCount(inTxs.length);
        setSpentTxCount(outTxs.length);
        const allTxs = [...inTxs, ...outTxs];
        const balances = buildDailyBalances(allTxs, sparkInformation.balance);
        setDailyBalances(balances);
      } catch (e) {
        console.error('AnalyticsPage load error', e);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [sparkInformation.identityPubKey]);

  return (
    <GlobalThemeView useStandardWidth={true}>
      {/* Header */}
      <CustomSettingsTopBar
        label={'Analytics'}
        containerStyles={{ marginBottom: 0 }}
      />
      <ThemeText content={'This month'} styles={styles.durationCard} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scrollContent,
          { width: WINDOWWIDTH, alignSelf: 'center' },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Portfolio value header */}
        <View style={styles.portfolioHeader}>
          {isLoading ? (
            <View style={styles.portfolioLoadingContainer}>
              <ActivityIndicator color={COLORS.darkModeText} size="small" />
            </View>
          ) : (
            <>
              <ThemeText
                styles={styles.portfolioBalance}
                content={displayCorrectDenomination({
                  amount: sparkInformation.balance,
                  masterInfoObject,
                  fiatStats,
                })}
              />
              <View style={styles.portfolioDeltaRow}>
                <ThemeText
                  styles={[styles.portfolioDelta, { color: deltaColor }]}
                  content={`${deltaSign}${deltaDisplay}  ${deltaSign}${Math.abs(deltaPercent).toFixed(2)}%`}
                />
              </View>
              <PortfolioChart
                data={dailyBalances.map(d => d.balanceSats)}
                width={chartWidth}
                height={120}
                strokeColor={COLORS.primary}
              />
            </>
          )}
        </View>

        {/* Income + Spent row */}
        <View style={styles.metricsRow}>
          <TouchableOpacity
            style={[styles.metricCard, { backgroundColor: backgroundOffset }]}
            onPress={() => navigate.navigate('AnalyticsIncomePage')}
            activeOpacity={0.8}
          >
            <ThemeText styles={styles.metricLabel} content={'Income'} />
            {isLoading ? (
              <ActivityIndicator color={COLORS.darkModeText} size="small" />
            ) : incomeTotal === 0 ? (
              <>
                <ThemeText
                  CustomNumberOfLines={1}
                  adjustsFontSizeToFit={true}
                  styles={styles.metricAmount}
                  content={displayCorrectDenomination({
                    amount: 0,
                    masterInfoObject,
                    fiatStats,
                  })}
                />
                <ThemeText
                  styles={styles.metricSubText}
                  content={'No income yet'}
                />
              </>
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
                  content={`${incomeTxCount} transaction${
                    incomeTxCount !== 1 ? 's' : ''
                  }`}
                />
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.metricCard, { backgroundColor: backgroundOffset }]}
            onPress={() => navigate.navigate('AnalyticsSpentPage')}
            activeOpacity={0.8}
          >
            <ThemeText styles={styles.metricLabel} content={'Spent'} />

            {isLoading ? (
              <ActivityIndicator color={COLORS.darkModeText} size="small" />
            ) : spentTotal === 0 ? (
              <>
                <ThemeText
                  CustomNumberOfLines={1}
                  adjustsFontSizeToFit={true}
                  styles={styles.metricAmount}
                  content={displayCorrectDenomination({
                    amount: 0,
                    masterInfoObject,
                    fiatStats,
                  })}
                />
                <ThemeText
                  styles={styles.metricSubText}
                  content={'Make your first payment'}
                />
              </>
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
                  content={`${spentTxCount} transaction${
                    spentTxCount !== 1 ? 's' : ''
                  }`}
                />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Budget section */}
        <ThemeText styles={styles.sectionTitle} content={'Budget'} />

        {!budget ? (
          <TouchableOpacity
            style={[
              styles.budgetEmptyCard,
              { backgroundColor: backgroundOffset },
            ]}
            onPress={() => navigate.navigate('AnalyticsCreateBudgetPage')}
            activeOpacity={0.8}
          >
            <NoContentSceen
              iconName="Wallet"
              titleText="No budget set"
              subTitleText="Tap to create a monthly budget"
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.budgetCard, { backgroundColor: backgroundOffset }]}
            onPress={() => navigate.navigate('AnalyticsBudgetPage')}
            activeOpacity={0.8}
          >
            <ThemeText styles={styles.budgetCardLabel} content="Personal" />
            <ThemeText
              styles={styles.budgetLeftAmount}
              content={`${displayCorrectDenomination({
                amount: spentTotal,
                masterInfoObject,
                fiatStats,
              })} left to spend`}
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
                content={`${Math.round(
                  Math.min((1 - spentPercent) * 100, 100),
                )}% remaining`}
              />
              <ThemeText
                styles={styles.budgetLeftAmount}
                content={`${displayCorrectDenomination({
                  amount: budgetAmount,
                  masterInfoObject,
                  fiatStats,
                })}`}
              />
            </View>
          </TouchableOpacity>
        )}
      </ScrollView>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  durationCard: {
    fontSize: SIZES.smedium,
    opacity: HIDDEN_OPACITY,
    textAlign: 'center',
  },

  scrollContent: {
    paddingTop: 40,
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
    fontWeight: '500',
    marginBottom: 4,
  },
  metricSubText: {
    fontSize: SIZES.smedium,
    opacity: 0.4,
  },
  sectionTitle: {
    fontSize: SIZES.large,
    fontWeight: '500',
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
  budgetCardLabel: {
    fontSize: SIZES.smedium,
    opacity: 0.6,
    marginBottom: 4,
  },
  budgetLeftAmount: {
    fontSize: SIZES.xLarge,
    // fontWeight: '500',
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
  portfolioHeader: {
    marginBottom: 32,
  },
  portfolioLoadingContainer: {
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
  },
  portfolioBalance: {
    fontSize: SIZES.xxLarge,
    fontWeight: '600',
    textAlign: 'left',
    marginBottom: 4,
  },
  portfolioDeltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  portfolioDelta: {
    fontSize: SIZES.medium,
    fontWeight: '500',
  },
});
