import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useMemo } from 'react';
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
import { fromMicros, mergeAndSortSavingsActivity } from './utils';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { WINDOWWIDTH } from '../../../../constants/theme';
import SavingsActivityContainer from './SavingsActivityContainer';
import SavingsActionButtons from './SavingsActionButtons';

export default function SavingsHome() {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { backgroundOffset } = GetThemeColors();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const {
    savingsBalance,
    savingsGoals,
    allSavingsTransactions,
    refreshInterestPayouts,
    refreshBalances,
    interestPayouts,
  } = useSavings();

  useFocusEffect(
    useCallback(() => {
      refreshBalances();
      refreshInterestPayouts();
    }, [refreshBalances, refreshInterestPayouts]),
  );

  const combinedTransactions = useMemo(
    () => mergeAndSortSavingsActivity(allSavingsTransactions, interestPayouts),
    [allSavingsTransactions, interestPayouts],
  );

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar label={t('savings.home.title')} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.heroCard}>
          <ThemeText
            adjustsFontSizeToFit={true}
            styles={styles.balanceValue}
            content={displayCorrectDenomination({
              amount: savingsBalance,
              masterInfoObject: {
                ...masterInfoObject,
                userBalanceDenomination: 'fiat',
              },
              fiatStats,
              forceCurrency: 'USD',
              convertAmount: false,
            })}
          />
          <TouchableOpacity
            style={styles.interestRow}
            activeOpacity={0.7}
            onPress={() => {
              navigate.navigate('CustomHalfModal', {
                wantedContent: 'howSavingsWorks',
                sliderHight: 0.9,
              });
            }}
          >
            <ThemeText
              styles={styles.interestText}
              content={t('savings.home.howItWorksLink')}
            />
            <ThemeIcon iconName={'ChevronRight'} size={18} />
          </TouchableOpacity>
        </View>

        <SavingsActionButtons savingsBalance={savingsBalance} />

        <View
          style={[styles.sectionCard, { backgroundColor: backgroundOffset }]}
        >
          {!savingsGoals.length ? (
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.goalRow}
              onPress={() => navigate.navigate('SavingsGoalEmoji')}
            >
              <View
                style={[
                  styles.goalIconCircle,
                  { backgroundColor: backgroundOffset },
                ]}
              >
                <ThemeIcon iconName={'Target'} size={18} />
              </View>
              <View style={styles.goalCopyWrap}>
                <ThemeText
                  styles={styles.goalTitle}
                  content={t('savings.home.setGoalTitle')}
                />
                <ThemeText
                  styles={styles.goalSubtitle}
                  content={t('savings.home.setGoalSubtitle')}
                />
              </View>
              <ThemeIcon iconName={'ChevronRight'} size={18} />
            </TouchableOpacity>
          ) : (
            <>
              {savingsGoals.map((goal, index) => {
                const goalProgress =
                  goal?.amountMicros > 0
                    ? Math.min(1, goal.currentAmountMicros / goal.amountMicros)
                    : 0;

                return (
                  <TouchableOpacity
                    key={goal.id}
                    activeOpacity={0.7}
                    style={[
                      styles.goalCardRow,
                      index > 0 && styles.goalCardRowBorder,
                    ]}
                    onPress={() => {
                      navigate.navigate('SavingsGoalDetails', {
                        goalId: goal.id,
                      });
                    }}
                  >
                    <View
                      style={[
                        styles.goalEmojiCircle,
                        { backgroundColor: backgroundOffset },
                      ]}
                    >
                      <ThemeText
                        styles={styles.goalEmoji}
                        content={goal.emoji || '🎯'}
                      />
                    </View>

                    <View style={styles.goalContent}>
                      <ThemeText
                        styles={styles.goalTitle}
                        content={
                          goal.name || t('savings.home.savingsGoalFallback')
                        }
                      />
                      <ThemeText
                        styles={styles.goalSubtitle}
                        content={`${displayCorrectDenomination({
                          amount: fromMicros(goal.currentAmountMicros),
                          masterInfoObject: {
                            ...masterInfoObject,
                            userBalanceDenomination: 'fiat',
                          },
                          fiatStats,
                          forceCurrency: 'USD',
                          convertAmount: false,
                        })} / ${displayCorrectDenomination({
                          amount: fromMicros(goal.amountMicros),
                          masterInfoObject: {
                            ...masterInfoObject,
                            userBalanceDenomination: 'fiat',
                          },
                          fiatStats,
                          forceCurrency: 'USD',
                          convertAmount: false,
                        })}`}
                      />
                    </View>

                    <CircularProgress
                      current={goalProgress * 100}
                      goal={100}
                      size={46}
                      strokeWidth={4}
                      showPercentage={false}
                      useAltBackground={true}
                    />
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                activeOpacity={0.7}
                style={styles.updateGoalRow}
                onPress={() => navigate.navigate('SavingsGoalEmoji')}
              >
                <ThemeText
                  styles={styles.updateGoalText}
                  content={t('savings.home.createAnotherGoal')}
                />
                <ThemeIcon iconName={'ChevronRight'} size={16} />
              </TouchableOpacity>
            </>
          )}
        </View>

        <SavingsActivityContainer transactions={combinedTransactions} />

        <ThemeText
          styles={styles.disclaimer}
          content={t('savings.home.disclaimer')}
        />
      </ScrollView>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    width: WINDOWWIDTH,
    gap: 16,
    flexGrow: 1,
    ...CENTER,
  },
  heroCard: {
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceValue: {
    fontSize: SIZES.huge,
    includeFontPadding: false,
    marginTop: 20,
  },
  interestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
    fontSize: 22,
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
    fontSize: SIZES.xSmall,
    opacity: 0.55,
    includeFontPadding: false,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 'auto',
  },
});
