import React from 'react';
import { StyleSheet, View } from 'react-native';
import { TriangleAlert } from 'lucide-react-native';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useAnalytics } from '../../../../../../context-store/analyticsContext';
import { COLORS, SIZES } from '../../../../../constants';
import { INSET_WINDOW_WIDTH } from '../../../../../constants/theme';
import { ThemeText } from '../../../../../functions/CustomElements';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import CustomButton from '../../../../../functions/CustomElements/button';
import GetThemeColors from '../../../../../hooks/themeColors';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import { computeBudgetWarning } from '../../../../../hooks/useBudgetWarning';
import { useTranslation } from 'react-i18next';

export default function BudgetWarningModal({ handleBackPressFunction }) {
  const { masterInfoObject } = useGlobalContextProvider();
  const { spentTotal } = useAnalytics();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundColor, backgroundOffset } = GetThemeColors();
  const { t } = useTranslation();

  const budget = masterInfoObject?.monthlyBudget ?? null;
  const { isOverBudget, leftToSpend } = computeBudgetWarning(
    budget,
    spentTotal,
  );

  const accentColor =
    theme && darkModeType
      ? COLORS.darkModeText
      : isOverBudget
      ? COLORS.cancelRed
      : COLORS.primary;
  const subheader = isOverBudget
    ? t('analytics.budget.ovoverBudgetWarninger')
    : t('analytics.budget.nearBudgetWarning');

  return (
    <View style={[styles.sheet]}>
      {/* Icon */}
      <View style={styles.iconContainer}>
        <TriangleAlert color={accentColor} size={40} />
      </View>

      {/* Header */}
      <ThemeText
        styles={styles.header}
        content={t('analytics.budget.budgetWarningHeadsUp')}
      />

      {/* Subheader */}
      <ThemeText styles={styles.subheader} content={subheader} />

      {/* Amount remaining */}
      <View
        style={[
          styles.amountContainer,
          {
            backgroundColor:
              theme && darkModeType ? backgroundColor : backgroundOffset,
          },
        ]}
      >
        <ThemeText
          styles={styles.amountLabel}
          content={t('analytics.budget.reamaining')}
        />
        <FormattedSatText
          containerStyles={styles.amountValue}
          styles={{ fontSize: SIZES.large }}
          balance={leftToSpend}
        />
      </View>

      {/* Continue button */}
      <CustomButton
        buttonStyles={styles.continueButton}
        textContent={t('constnats.continue')}
        actionFunction={handleBackPressFunction}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
  },

  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  header: {
    fontSize: SIZES.xLarge,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 8,
  },
  subheader: {
    fontSize: SIZES.medium,
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 24,
    lineHeight: 22,
    width: INSET_WINDOW_WIDTH,
    alignSelf: 'center',
  },
  amountContainer: {
    width: INSET_WINDOW_WIDTH,
    alignSelf: 'center',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 'auto',
  },
  amountLabel: {
    fontSize: SIZES.small,
    opacity: 0.6,
    marginBottom: 4,
  },
  amountValue: {
    alignSelf: 'center',
  },
  continueButton: {
    alignSelf: 'center',
  },
});
