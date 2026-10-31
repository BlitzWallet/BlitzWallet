import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import { useSavings } from '../../../../../context-store/savingsContext';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import {
  CENTER,
  COLORS,
  MAX_WEB_CONTENT_WIDTH,
  SIZES,
} from '../../../../constants';
import GetThemeColors from '../../../../hooks/themeColors';
import CircularProgress from '../pools/circularProgress';
import { fromMicros, mergeAndSortSavingsActivity } from './utils';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import SavingsActivityContainer from './SavingsActivityContainer';
import SavingsActionButtons from './SavingsActionButtons';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import IconButton from '../../../../functions/CustomElements/redesign/IconButton';
import AmountHero from '../../../../functions/CustomElements/redesign/AmountHero';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import Disc from '../../../../functions/CustomElements/redesign/Disc';

export default function SavingsHome() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { tokens } = GetThemeColors();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const {
    savingsBalance,
    savingsGoals,
    allSavingsTransactions,
    initializeSavings,
    isInitializing,
    interestPayouts,
  } = useSavings();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  useFocusEffect(
    useCallback(() => {
      initializeSavings({ force: true });
    }, [initializeSavings]),
  );

  const combinedTransactions = useMemo(
    () =>
      mergeAndSortSavingsActivity(allSavingsTransactions, interestPayouts, t),
    [allSavingsTransactions, interestPayouts, t],
  );

  const formatUsd = amount =>
    displayCorrectDenomination({
      amount,
      masterInfoObject: {
        ...masterInfoObject,
        userBalanceDenomination: 'fiat',
      },
      fiatStats,
      forceCurrency: 'USD',
      convertAmount: false,
    });

  if (isInitializing) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <View style={[styles.container, { width: contentWidth }]}>
          <TopBar
            title={t('savings.home.title')}
            right={
              <IconButton
                icon={'info'}
                onPress={() =>
                  navigate.navigate('CustomWebView', {
                    webViewURL: 'https://docs.flashnet.xyz/usdb/faq',
                  })
                }
              />
            }
          />
          <FullLoadingScreen showText={false} />
        </View>
      </GlobalThemeView>
    );
  }

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={t('savings.home.title')}
          right={
            <IconButton
              icon={'info'}
              onPress={() =>
                navigate.navigate('CustomWebView', {
                  webViewURL: 'https://docs.flashnet.xyz/usdb/faq',
                })
              }
            />
          }
        />
        <CustomScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.heroCard}>
            <ThemeText
              styles={[styles.balanceLabel, { color: tokens.muted }]}
              content={t('savings.total_balance')}
            />
            <AmountHero
              amount={savingsBalance}
              fiatStats={fiatStats}
              masterInfoObject={{
                ...masterInfoObject,
                userBalanceDenomination: 'fiat',
              }}
              forceCurrency="USD"
              convertAmount={false}
              amountSize={48}
            />
          </View>

          <SavingsActionButtons savingsBalance={savingsBalance} />

          <View style={styles.goalsCard}>
            {!savingsGoals.length ? (
              <ListCard>
                <ListRow
                  onPress={() => navigate.navigate('SavingsGoalEmoji')}
                  lead={<Disc icon={'Target'} size={40} />}
                  title={t('savings.home.setGoalTitle')}
                  titleStyle={styles.rowTitle}
                  sub={t('savings.home.setGoalSubtitle')}
                  minHeight={72}
                  showChevron={true}
                />
              </ListCard>
            ) : (
              <ListCard>
                {savingsGoals.map(goal => {
                  return (
                    <ListRow
                      key={goal.id}
                      onPress={() => {
                        navigate.navigate('SavingsGoalDetails', {
                          goalId: goal.id,
                        });
                      }}
                      lead={
                        <View
                          style={[
                            styles.goalEmojiCircle,
                            { backgroundColor: tokens.disc },
                          ]}
                        >
                          <ThemeText
                            styles={styles.goalEmoji}
                            content={goal.emoji || '🎯'}
                          />
                        </View>
                      }
                      title={goal.name || t('savings.home.savingsGoalFallback')}
                      titleStyle={styles.rowTitle}
                      sub={`${formatUsd(
                        fromMicros(goal.currentAmountMicros),
                      )} ${t('wallet.pools.ofAmount', {
                        amount: formatUsd(fromMicros(goal.amountMicros)),
                      })}`}
                      subLines={1}
                      minHeight={64}
                      trailing={
                        <CircularProgress
                          current={goal.currentAmountMicros}
                          goal={goal.amountMicros}
                          size={40}
                          strokeWidth={3}
                          showPercentage={false}
                          trackColor={tokens.divider}
                          showConfirmed={
                            goal.currentAmountMicros >= goal.amountMicros
                          }
                        />
                      }
                    />
                  );
                })}
                <ListRow
                  key="createAnother"
                  onPress={() => navigate.navigate('SavingsGoalEmoji')}
                  title={t('savings.home.createAnotherGoal')}
                  titleStyle={styles.rowTitle}
                  minHeight={52}
                  showChevron={true}
                />
              </ListCard>
            )}
          </View>

          <SavingsActivityContainer transactions={combinedTransactions} />

          <ThemeText
            styles={[styles.disclaimer, { color: tokens.muted }]}
            content={t('savings.home.disclaimer')}
          />
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
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  heroCard: {
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  balanceLabel: {
    includeFontPadding: false,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  goalsCard: {
    marginTop: 20,
  },
  rowTitle: {
    fontSize: 15,
    lineHeight: 21,
  },
  balanceValue: {
    fontSize: SIZES.huge,
    flexShrink: 1,
    includeFontPadding: false,
  },
  earnedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    gap: 4,
  },
  interestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // gap: 1,
    marginBottom: 20,
  },
  interestText: {
    fontSize: SIZES.smedium,
    includeFontPadding: false,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    color: COLORS.darkModeText,
    includeFontPadding: false,
  },
  secondaryAction: {
    backgroundColor: COLORS.lightModeBackgroundOffset,
  },
  disabledAction: {
    opacity: 0.5,
  },
  sectionCard: {
    borderRadius: 16,
    padding: 0,
    overflow: 'hidden',
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  goalIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalCopyWrap: {
    flex: 1,
  },
  goalCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
  },
  goalCardRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.gray2,
  },
  goalEmojiCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalEmoji: {
    fontSize: 19,
    lineHeight: 24,
    includeFontPadding: false,
  },
  goalContent: {
    flex: 1,
  },
  goalTitle: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
  goalSubtitle: {
    fontSize: SIZES.small,
    opacity: 0.7,
    includeFontPadding: false,
  },
  updateGoalRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.gray2,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  updateGoalText: {
    includeFontPadding: false,
  },
  activityHeader: {
    fontSize: SIZES.smedium,
    marginBottom: 8,
    includeFontPadding: false,
    marginTop: 14,
  },
  emptyActivity: {
    opacity: 0.7,
    fontSize: SIZES.smedium,
    includeFontPadding: false,
    padding: 14,
  },
  activityRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomColor: COLORS.gray2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activityIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTitle: {
    fontSize: SIZES.small,
    includeFontPadding: false,
  },
  activityDate: {
    fontSize: SIZES.xSmall,
    opacity: 0.6,
    includeFontPadding: false,
  },
  activityAmount: {
    fontSize: SIZES.smedium,
    includeFontPadding: false,
  },
  activityPositive: {
    color: COLORS.dollarGreen,
  },
  activityNegative: {
    color: COLORS.cancelRed,
  },
  disclaimer: {
    fontSize: 12,
    includeFontPadding: false,
    lineHeight: 18,
    marginTop: 20,
    paddingHorizontal: 4,
  },
});
