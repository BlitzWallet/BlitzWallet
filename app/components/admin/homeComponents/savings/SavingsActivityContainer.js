import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemeText } from '../../../../functions/CustomElements';
import { SIZES } from '../../../../constants';
import GetThemeColors from '../../../../hooks/themeColors';
import SavingsTransactionComponenet from './transactionContainer';

export default function SavingsActivityContainer({ transactions = [] }) {
  const { t } = useTranslation();
  const { backgroundOffset } = GetThemeColors();
  return (
    <View style={styles.container}>
      <ThemeText styles={styles.activityHeader} content={t('savings.activity.title')} />
      <View style={[styles.sectionCard, { backgroundColor: backgroundOffset }]}>
        {!transactions.length ? (
          <ThemeText
            styles={styles.emptyActivity}
            content={t('savings.activity.emptyState')}
          />
        ) : (
          transactions.map((item, index) => (
            <SavingsTransactionComponenet
              isLastIndex={index === transactions.length - 1}
              key={item.txId}
              item={item}
            />
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  sectionCard: {
    borderRadius: 16,
    padding: 0,
    overflow: 'hidden',
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
});
