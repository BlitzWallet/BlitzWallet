import { useNavigation } from '@react-navigation/native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSavings } from '../../../../../context-store/savingsContext';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import { CENTER, COLORS, SIZES } from '../../../../constants';
import GetThemeColors from '../../../../hooks/themeColors';
import CircularProgress from '../pools/circularProgress';
import { fromMicros } from './utils';
import { WINDOWWIDTH } from '../../../../constants/theme';
import SavingsActivityContainer from './SavingsActivityContainer';
import SavingsActionButtons from './SavingsActionButtons';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';

export default function SavingsGoalDetails(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const goalIdFromRoute = props?.route?.params?.goalId;
  const { backgroundOffset } = GetThemeColors();
  const { savingsGoals, allSavingsTransactions, getGoalBalanceMicros } =
    useSavings();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();

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

  if (!selectedGoal) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <CustomSettingsTopBar
          label={t('savings.goalDetails.screenTitleFallback')}
        />
        <View style={styles.emptyWrap}>
          <ThemeText content={t('savings.goalDetails.emptyState')} />
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
      <CustomSettingsTopBar
        label={
          selectedGoal?.name || t('savings.goalDetails.screenTitleFallback')
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.progressWrap}>
          <CircularProgress
            current={goalProgress * 100}
            goal={100}
            size={280}
            strokeWidth={10}
            showPercentage={false}
            useAltBackground={false}
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

        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.updateGoalCard, { backgroundColor: backgroundOffset }]}
          onPress={() => {
            navigate.navigate('SavingsUpdateGoal', {
              goalId: selectedGoal?.id,
            });
          }}
        >
          <View style={styles.updateGoalLeft}>
            <ThemeIcon iconName={'Target'} size={18} />
            <ThemeText
              styles={{ includeFontPadding: false }}
              content={t('savings.goalDetails.updateGoalButton')}
            />
          </View>
          <ThemeIcon iconName={'ChevronRight'} size={16} />
        </TouchableOpacity>

        <SavingsActivityContainer transactions={goalTransactions} />
      </ScrollView>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    width: WINDOWWIDTH,
    ...CENTER,
    gap: 16,
  },
  progressWrap: {
    alignItems: 'center',
    justifyContent: 'center',
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
  primaryAction: {
    backgroundColor: COLORS.black,
  },
  primaryActionText: {
    color: COLORS.white,
    includeFontPadding: false,
  },
  secondaryAction: {
    backgroundColor: COLORS.lightModeBackgroundOffset,
  },
  disabledAction: {
    opacity: 0.5,
  },
  updateGoalCard: {
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  updateGoalLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activityHeader: {
    fontSize: SIZES.smedium,
    marginBottom: 8,
    includeFontPadding: false,
  },
  activityCard: {
    borderRadius: 16,
    padding: 0,
    overflow: 'hidden',
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
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
