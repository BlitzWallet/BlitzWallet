import { useCallback, useMemo, useState } from 'react';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../../../constants';
import {
  CustomKeyboardAvoidingView,
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { usePOSTransactions } from '../../../../../../context-store/pos';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import { useGlobalInsets } from '../../../../../../context-store/insetsProvider';
import { useTranslation } from 'react-i18next';
import { keyboardNavigate } from '../../../../../functions/customNavigation';
import TopBar from '../../../../../functions/CustomElements/redesign/TopBar';
import SearchField from '../../../../../functions/CustomElements/redesign/SearchField';
import EmptyState from '../../../../../functions/CustomElements/redesign/EmptyState';
import ListCard, {
  ListDivider,
} from '../../../../../functions/CustomElements/redesign/ListCard';
import ListRow from '../../../../../functions/CustomElements/redesign/ListRow';
import Disc from '../../../../../functions/CustomElements/redesign/Disc';

export default function ViewPOSTransactions() {
  const { groupedTxs, isLoading } = usePOSTransactions();
  const [employeeName, setEmployeeName] = useState('');
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const navigate = useNavigation();
  const { bottomPadding } = useGlobalInsets();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;

  const filteredList = useMemo(() => {
    return !groupedTxs.length
      ? []
      : groupedTxs.filter(tx => {
          const [name] = tx;
          return name.toLowerCase()?.startsWith(employeeName.toLowerCase());
        });
  }, [groupedTxs, employeeName]);

  const transactionItem = useCallback(
    ({ item }) => {
      const [name, { totalTipAmount }] = item;
      if (!name || totalTipAmount === undefined) return null;
      return (
        <ListRow
          lead={<Disc icon="Users" size={40} />}
          title={name}
          titleLines={1}
          subLines={1}
          minHeight={64}
          titleStyle={styles.title}
          subStyle={styles.sub}
          sub={
            totalTipAmount
              ? t('settings.posPath.transactions.unpaidtips', {
                  number: displayCorrectDenomination({
                    amount: totalTipAmount,
                    masterInfoObject,
                    fiatStats,
                  }),
                })
              : t('settings.posPath.transactions.allPaid')
          }
          showChevron={true}
          chevronSize={18}
          onPress={() =>
            keyboardNavigate(() =>
              navigate.navigate('TotalTipsScreen', {
                wantedContent: 'posTipsDetail',
                name,
              }),
            )
          }
        />
      );
    },
    [masterInfoObject, fiatStats, t, navigate],
  );

  if (isLoading) return <FullLoadingScreen />;

  if (!groupedTxs.length) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <View style={[styles.container, { width: contentWidth }]}>
          <TopBar title={t('settings.posPath.transactions.title')} />
          <View style={styles.empty}>
            <EmptyState
              icon="Receipt"
              iconTone="ink"
              title={t('settings.posPath.transactions.noEmployeeTitle')}
              sub={t('settings.posPath.transactions.noEmployeeSubTitle')}
            />
          </View>
        </View>
      </GlobalThemeView>
    );
  }

  return (
    <CustomKeyboardAvoidingView
      styles={styles.globalContainer}
      useStandardWidth={true}
    >
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={t('settings.posPath.transactions.title')}
          shouldDismissKeyboard={true}
        />
        <View style={styles.search}>
          <SearchField
            pill
            value={employeeName}
            onChangeText={setEmployeeName}
            placeholder={t('settings.posPath.transactions.empNamePlaceholder')}
          />
        </View>
        {filteredList.length ? (
          <ListCard dividerInset={52} style={styles.card}>
            <FlatList
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 4 }}
              showsVerticalScrollIndicator={false}
              data={filteredList}
              renderItem={transactionItem}
              keyExtractor={([name]) => name}
              ItemSeparatorComponent={TipsSeparator}
            />
          </ListCard>
        ) : (
          <ThemeText
            styles={styles.emptyText}
            content={t('settings.posPath.transactions.noTips')}
          />
        )}
        <View style={{ height: bottomPadding }} />
      </View>
    </CustomKeyboardAvoidingView>
  );
}

function TipsSeparator() {
  return <ListDivider inset={52} />;
}

const styles = StyleSheet.create({
  globalContainer: { paddingBottom: 0 },
  container: { flex: 1, ...CENTER },
  search: { marginTop: 16 },
  card: { marginTop: 16, flexShrink: 1 },
  title: { fontSize: 15, lineHeight: 21 },
  sub: { fontSize: 13, lineHeight: 19 },
  empty: { flex: 1, justifyContent: 'center' },
  emptyText: {
    textAlign: 'center',
    marginTop: 24,
  },
});
