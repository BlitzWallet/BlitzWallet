import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../../functions/CustomElements';
import CheckMarkCircle from '../../../../functions/CustomElements/checkMarkCircle';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { INSET_WINDOW_WIDTH, SIZES } from '../../../../constants/theme';
import { CENTER } from '../../../../constants';

const FILTER_KEYS = [
  'All',
  'Lightning',
  'Bitcoin',
  'Spark',
  'Contacts',
  'Gifts',
  'Swaps',
  'Savings',
  'Pools',
];

export default function TxFilterHalfModal({
  currentFilter,
  onSelectFilter,
  handleBackPressFunction,
}) {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <ThemeText
        styles={styles.title}
        content={t('screens.inAccount.viewAllTxPage.filterModalTitle')}
      />
      {FILTER_KEYS.map(key => {
        const isActive = currentFilter === key;
        return (
          <TouchableOpacity
            key={key}
            style={styles.row}
            onPress={() => {
              onSelectFilter(key);
              handleBackPressFunction();
            }}
            activeOpacity={0.7}
          >
            <ThemeText
              styles={styles.rowLabel}
              content={t(
                `screens.inAccount.viewAllTxPage.filter${key}`,
              )}
            />
            <CheckMarkCircle
              isActive={isActive}
              containerSize={24}
              switchDarkMode={theme && darkModeType}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    paddingBottom: 8,
  },
  title: {
    fontSize: SIZES.large,
    textAlign: 'center',
    marginBottom: 16,
    includeFontPadding: false,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowLabel: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
});
