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
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../../constants';
import GetThemeColors from '../../../../hooks/themeColors';
import CircularProgress from '../pools/circularProgress';
import { fromMicros, mergeAndSortSavingsActivity } from './utils';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import SavingsActivityContainer from './SavingsActivityContainer';
import SavingsActionButtons from './SavingsActionButtons';
import SectionHeader from '../../../../functions/CustomElements/redesign/SectionHeader';
import {
  SkeletonAmount,
  SkeletonButtons,
  SkeletonRow,
} from '../../../../functions/CustomElements/redesign/Skeleton';
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
          {/* Same layout as the loaded page: hero, buttons, goals, activity. */}
          <View style={styles.heroCard}>
            <SkeletonAmount />
          </View>
          <SkeletonButtons />
          <View style={styles.goalsCard}>
            <ListCard>
              <SkeletonRow sub={100} trailing={0} minHeight={72} />
            </ListCard>
          </View>
          <View>
            <SectionHeader
              title={t('savings.activity.title')}
              style={styles.skeletonActivityHeader}
            />
            <ListCard dividerInset={68}>
              {[0, 1, 2].map(key => (
                <SkeletonRow key={key} />
              ))}
            </ListCard>
          </View>
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
  // Same spacing as SavingsActivityContainer's header.
  skeletonActivityHeader: { marginTop: 20, marginBottom: 8 },
  rowTitle: {
    fontSize: 15,
    lineHeight: 21,
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
  disclaimer: {
    fontSize: 12,
    includeFontPadding: false,
    lineHeight: 18,
    marginTop: 20,
    paddingHorizontal: 4,
  },
});
