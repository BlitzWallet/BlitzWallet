import { useCallback, useMemo, useState } from 'react';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../../../constants';
import {
  CustomKeyboardAvoidingView,
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { usePOSTransactions } from '../../../../../../context-store/pos';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import { useGlobalInsets } from '../../../../../../context-store/insetsProvider';
import { useTranslation } from 'react-i18next';
import { keyboardNavigate } from '../../../../../functions/customNavigation';
import TopBar from '../../../../../functions/CustomElements/redesign/TopBar';
import SearchField from '../../../../../functions/CustomElements/redesign/SearchField';
import EmptyState from '../../../../../functions/CustomElements/redesign/EmptyState';
import ListCard from '../../../../../functions/CustomElements/redesign/ListCard';
import HideOnScrollView from '../../../../../functions/CustomElements/redesign/HideOnScrollView';
import ListRow from '../../../../../functions/CustomElements/redesign/ListRow';
import { SkeletonRow } from '../../../../../functions/CustomElements/redesign/Skeleton';
import Disc from '../../../../../functions/CustomElements/redesign/Disc';
import { FADE_TOP } from '../../../../../functions/CustomElements/redesign/TopFade';

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
          key={name}
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

  // Same shell as the loaded page so the header and search don't jump.
  if (isLoading) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <View style={[styles.container, { width: contentWidth }]}>
          <TopBar title={t('settings.posPath.transactions.title')} />
          {/* Shown, not usable, until transactions load. */}
          <View style={styles.search} pointerEvents="none">
            <SearchField
              pill
              value=""
              onChangeText={() => {}}
              placeholder={t(
                'settings.posPath.transactions.empNamePlaceholder',
              )}
            />
          </View>
          <ListCard dividerInset={52} style={styles.card}>
            {[0, 1, 2, 3, 4, 5].map(key => (
              <SkeletonRow key={key} sub={90} trailing={18} />
            ))}
          </ListCard>
        </View>
      </GlobalThemeView>
    );
  }

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
          fade
          title={t('settings.posPath.transactions.title')}
          shouldDismissKeyboard={true}
        />
        <HideOnScrollView
          topInset={FADE_TOP}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: bottomPadding }}
          header={
            <SearchField
              pill
              value={employeeName}
              onChangeText={setEmployeeName}
              placeholder={t(
                'settings.posPath.transactions.empNamePlaceholder',
              )}
            />
          }
        >
          {filteredList.length ? (
            <ListCard dividerInset={52}>
              {filteredList.map(item => transactionItem({ item }))}
            </ListCard>
          ) : (
            <ThemeText
              styles={styles.emptyText}
              content={t('settings.posPath.transactions.noTips')}
            />
          )}
        </HideOnScrollView>
      </View>
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  globalContainer: { paddingBottom: 0 },
  container: { flex: 1, ...CENTER },
  card: { marginTop: 16, flexShrink: 1 },
  title: { fontSize: 15 },
  sub: { fontSize: 13 },
  empty: { flex: 1, justifyContent: 'center' },
  emptyText: {
    textAlign: 'center',
    marginTop: 24,
  },
});
