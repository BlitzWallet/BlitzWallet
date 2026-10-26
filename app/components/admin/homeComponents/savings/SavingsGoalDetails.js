import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import CustomScrollView from '../../../../functions/CustomElements/scrollView';
import { useSavings } from '../../../../../context-store/savingsContext';
import { GlobalThemeView } from '../../../../functions/CustomElements';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../../constants';
import CircularProgress from '../pools/circularProgress';
import { fromMicros } from './utils';
import SavingsActivityContainer from './SavingsActivityContainer';
import SavingsActionButtons from './SavingsActionButtons';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import EmptyState from '../../../../functions/CustomElements/redesign/EmptyState';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../functions/CustomElements/redesign/ListRow';
import Disc from '../../../../functions/CustomElements/redesign/Disc';
import GetThemeColors from '../../../../hooks/themeColors';

export default function SavingsGoalDetails(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const goalIdFromRoute = props?.route?.params?.goalId;
  const {
    savingsGoals,
    allSavingsTransactions,
    getGoalBalanceMicros,
    refreshSavings,
    refreshBalances,
  } = useSavings();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { tokens } = GetThemeColors();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const selectedGoal = useMemo(() => {
    if (goalIdFromRoute) {
      return savingsGoals.find(goal => goal.id === goalIdFromRoute) || null;
    }
  }, [goalIdFromRoute, savingsGoals]);

  const goalBalanceMicros = selectedGoal
    ? getGoalBalanceMicros(selectedGoal.id)
    : 0;
  const goalTransactions = selectedGoal
    ? allSavingsTransactions.filter(tx => tx.goalId === selectedGoal.id)
    : [];

  useFocusEffect(
    useCallback(() => {
      refreshSavings();
    }, [refreshSavings]),
  );

  if (!selectedGoal) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <View style={[styles.container, { width: contentWidth }]}>
          <TopBar title={t('savings.goalDetails.screenTitleFallback')} />
          <View style={styles.emptyWrap}>
            <EmptyState
              icon={'CircleAlert'}
              iconTone="danger"
              title={t('savings.goalDetails.emptyState')}
              // need to come up with a sub title
              // sub={}
            />
          </View>
        </View>
      </GlobalThemeView>
    );
  }

  const goalProgress =
    selectedGoal?.amountMicros > 0
      ? Math.min(1, goalBalanceMicros / selectedGoal.amountMicros)
      : 0;

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={`${selectedGoal?.emoji} ${
            selectedGoal?.name || t('savings.goalDetails.screenTitleFallback')
          }`}
        />
        <CustomScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.progressWrap}>
            <CircularProgress
              current={goalProgress * 100}
              goal={100}
              size={232}
              strokeWidth={10}
              showPercentage={false}
              trackColor={tokens.divider}
              fundedAmount={displayCorrectDenomination({
                amount: fromMicros(goalBalanceMicros),
                masterInfoObject: {
                  ...masterInfoObject,
                  userBalanceDenomination: 'fiat',
                },
                fiatStats,
                forceCurrency: 'USD',
                convertAmount: false,
              })}
              goalAmount={displayCorrectDenomination({
                amount: fromMicros(selectedGoal?.amountMicros),
                masterInfoObject: {
                  ...masterInfoObject,
                  userBalanceDenomination: 'fiat',
                },
                fiatStats,
                forceCurrency: 'USD',
                convertAmount: false,
              })}
              useFillAnimation={true}
            />
          </View>

          <SavingsActionButtons
            selectedGoalUUID={selectedGoal.id}
            savingsBalance={goalBalanceMicros}
          />
          <ListCard style={styles.updateCard}>
            <ListRow
              lead={<Disc icon={'Target'} size={40} />}
              titleStyle={styles.rowTitle}
              minHeight={64}
              onPress={() => {
                navigate.navigate('SavingsUpdateGoal', {
                  goalId: selectedGoal?.id,
                });
              }}
              title={t('savings.goalDetails.updateGoalButton')}
              showChevron={true}
            />
          </ListCard>
          <SavingsActivityContainer transactions={goalTransactions} />
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
    paddingBottom: 20,
  },
  progressWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  updateCard: {
    marginTop: 20,
  },
  rowTitle: {
    fontSize: 15,
    lineHeight: 21,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
