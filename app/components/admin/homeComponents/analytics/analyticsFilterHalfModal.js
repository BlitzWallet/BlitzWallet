import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../../../context-store/theme';
import SheetHeader from '../../../../functions/CustomElements/redesign/SheetHeader';
import ListCard from '../../../../functions/CustomElements/redesign/ListCard';
import PickRow from '../../../../functions/CustomElements/redesign/PickRow';
import { ANALYTICS_TIMEFRAMES } from '../../../../functions/analytics/periods';

// Same layout as NWCBudgetPeriodHalfModal: title, one card of radio rows.
// Picking a row applies it and closes the sheet.
export default function AnalyticsFilterHalfModal({
  timeframe,
  onChange,
  handleBackPressFunction,
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const title = t('analytics.filter.title');

  return (
    <View>
      <SheetHeader first title={title} />
      <View accessibilityRole="radiogroup" accessibilityLabel={title}>
        <ListCard dividerInset={16} style={{ backgroundColor: tokens.surface }}>
          {Object.values(ANALYTICS_TIMEFRAMES).map(option => (
            <PickRow
              key={option}
              title={t(`analytics.filter.timeframe_${option}`)}
              minHeight={52}
              paddingVertical={12}
              titleStyle={styles.optionTitle}
              selected={timeframe === option}
              onPress={() => {
                onChange?.(option);
                handleBackPressFunction?.();
              }}
            />
          ))}
        </ListCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  optionTitle: { fontSize: 15, lineHeight: 21 },
});
