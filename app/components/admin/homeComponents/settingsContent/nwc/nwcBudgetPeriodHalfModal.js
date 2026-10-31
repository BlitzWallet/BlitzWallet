import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FONT } from '../../../../../constants';
import { useTheme } from '../../../../../../context-store/theme';
import ThemeText from '../../../../../functions/CustomElements/textTheme';
import ListCard from '../../../../../functions/CustomElements/redesign/ListCard';
import PickRow from '../../../../../functions/CustomElements/redesign/PickRow';

const BUDGET_RENEWAL_OPTIONS = [
  { label: 'timeLabels.daily', value: 'Daily' },
  { label: 'timeLabels.weekly', value: 'Weekly' },
  { label: 'timeLabels.monthly', value: 'Monthly' },
  { label: 'timeLabels.yearly', value: 'Yearly' },
];

export default function NWCBudgetPeriodHalfModal({
  selectedOption,
  onSelectOption,
  handleBackPressFunction,
}) {
  const { t } = useTranslation();
  const { tokens } = useTheme();

  const selectOption = option => {
    onSelectOption?.(option);
    handleBackPressFunction?.();
  };

  return (
    <View style={styles.container}>
      <ThemeText
        content={t('settings.nwc.createNWCAmount.resetTitle')}
        styles={styles.title}
      />
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('settings.nwc.createNWCAmount.resetTitle')}
        style={styles.options}
      >
        <ListCard dividerInset={16} style={{ backgroundColor: tokens.surface }}>
          {BUDGET_RENEWAL_OPTIONS.map(option => (
            <PickRow
              key={option.value}
              title={t(option.label)}
              minHeight={52}
              paddingVertical={12}
              titleStyle={styles.optionTitle}
              selected={selectedOption === option.value}
              onPress={() => selectOption(option.value)}
            />
          ))}
        </ListCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
  },
  title: {
    marginTop: 20,
    fontFamily: FONT.Title_Regular,
    fontSize: 20,
    lineHeight: 26,
    includeFontPadding: false,
  },
  options: {
    marginTop: 12,
  },
  optionTitle: {
    fontSize: 15,
    lineHeight: 21,
  },
});
