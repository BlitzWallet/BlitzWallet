import { useNavigation } from '@react-navigation/native';
import {
  SectionList,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../constants';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import { useTranslation } from 'react-i18next';
import { useGlobalThemeContext } from '../../../context-store/theme';
import { useGlobalContextProvider } from '../../../context-store/context';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FullLoadingScreen from '../../functions/CustomElements/loadingScreen';
import { useSparkWallet } from '../../../context-store/sparkContext';
import { useFlashnet } from '../../../context-store/flashnetContext';
import { getFilteredTransactions } from '../../functions/spark/transactions';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import TopBar from '../../functions/CustomElements/redesign/TopBar';
import IconButton from '../../functions/CustomElements/redesign/IconButton';
import EmptyState from '../../functions/CustomElements/redesign/EmptyState';
import SectionHeader from '../../functions/CustomElements/redesign/SectionHeader';
import ListCard, {
  ListDivider,
} from '../../functions/CustomElements/redesign/ListCard';
import ActivityRow, {
  buildActivitySections,
} from '../../components/admin/homeComponents/viewAllComponents/activityRow';
import { FONT } from '../../constants/theme';

const EMPTY_FILTER = { directions: [], dateRange: null, types: [] };
const NS = 'screens.inAccount.viewAllTxPage';
const DIRECTION_LABELS = { sent: 'filterSent', received: 'filterReceived' };

// Rows sit in a per-row ListCard so the SectionList stays virtualised; only
// the first/last row of a day keeps the card's rounded corners.
const ActivitySeparator = () => (
  <ListCard style={styles.middleRow}>
    <ListDivider inset={68} />
  </ListCard>
);

export default function ViewAllTxPage() {
  const navigate = useNavigation();
  const [currentFilter, setCurrentFilter] = useState(EMPTY_FILTER);
  const [rawTxs, setRawTxs] = useState(null);
  const { sparkInformation, showTokensInformation } = useSparkWallet();
  const { poolInfoRef, swapLimits } = useFlashnet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { tokens } = useGlobalThemeContext();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const requestIdRef = useRef(0);
  const { t } = useTranslation();
  const userBalanceDenomination = masterInfoObject.userBalanceDenomination;

  // sparkInformation.transactions is only the recent slice, but it changes on
  // every new or updated payment, so it doubles as the reload signal.
  useEffect(() => {
    const requestId = ++requestIdRef.current;
    getFilteredTransactions(currentFilter, {
      accountId: sparkInformation.identityPubKey,
    }).then(result => {
      if (requestId === requestIdRef.current) setRawTxs(result || []);
    });
  }, [
    currentFilter,
    sparkInformation.identityPubKey,
    sparkInformation.transactions,
  ]);

  const sections = useMemo(
    () =>
      rawTxs &&
      buildActivitySections({
        transactions: rawTxs,
        tokens: sparkInformation.tokens,
        enabledLRC20: showTokensInformation,
        t,
      }),
    [rawTxs, sparkInformation.tokens, showTokensInformation, t],
  );

  const applyFilter = useCallback(filter => {
    setRawTxs(null);
    setCurrentFilter(filter);
  }, []);

  const hasActiveFilters =
    currentFilter.directions.length > 0 ||
    currentFilter.dateRange !== null ||
    currentFilter.types.length > 0;

  const filterSummary = [
    ...currentFilter.directions.map(dir => t(`${NS}.${DIRECTION_LABELS[dir]}`)),
    ...(currentFilter.dateRange
      ? [t(`${NS}.filterDate${currentFilter.dateRange}`)]
      : []),
    ...currentFilter.types.map(type => t(`${NS}.filter${type}`)),
  ].join(' · ');

  const renderItem = useCallback(
    ({ item, index, section }) => (
      <ListCard
        style={[
          index > 0 && styles.squareTop,
          index < section.data.length - 1 && styles.squareBottom,
        ]}
      >
        <ActivityRow
          item={item}
          navigate={navigate}
          userBalanceDenomination={userBalanceDenomination}
          tokens={sparkInformation.tokens}
          poolInfoRef={poolInfoRef}
          swapLimits={swapLimits}
        />
      </ListCard>
    ),
    [
      navigate,
      userBalanceDenomination,
      sparkInformation.tokens,
      poolInfoRef,
      swapLimits,
    ],
  );

  const renderSectionHeader = useCallback(
    ({ section }) => (
      <SectionHeader
        title={section.title}
        style={
          section === sections[0] &&
          (hasActiveFilters ? styles.firstFiltered : styles.first)
        }
      />
    ),
    [sections, hasActiveFilters],
  );

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar
          title={t(`${NS}.title`)}
          right={
            <>
              <IconButton
                icon={'ChartColumn'}
                label={`${NS}.insightsLabel`}
                onPress={() => navigate.navigate('AnalyticsStack')}
              />
              <IconButton
                icon={'Ellipsis'}
                label={`${NS}.moreOptionsLabel`}
                showActiveDot={hasActiveFilters}
                onPress={() =>
                  navigate.navigate('CustomHalfModal', {
                    wantedContent: 'ExportOrFilterHalfModal',
                    currentFilter,
                    onSelectFilter: applyFilter,
                  })
                }
              />
            </>
          }
        />
        {hasActiveFilters && (
          <View style={styles.filterBar}>
            <ThemeText
              styles={[styles.filterText, { color: tokens.muted }]}
              content={
                <>
                  {t(`${NS}.filterShowing`)}{' '}
                  <ThemeText
                    styles={[styles.filterText, { color: tokens.ink }]}
                    content={filterSummary}
                  />
                </>
              }
            />
            <TouchableOpacity
              style={[styles.clearButton, { backgroundColor: tokens.surface }]}
              onPress={() => applyFilter(EMPTY_FILTER)}
            >
              <ThemeText
                styles={styles.filterText}
                content={t(`${NS}.filterClear`)}
              />
              <ThemeIcon redesign iconName="X" size={16} />
            </TouchableOpacity>
          </View>
        )}
        {!sections ? (
          <FullLoadingScreen />
        ) : !sections.length ? (
          <View style={styles.emptyContainer}>
            <EmptyState
              icon="Clock"
              title={t(
                hasActiveFilters
                  ? `${NS}.noFilterResultsTitle`
                  : `${NS}.noTxHistoryTitle`,
              )}
              sub={t(
                hasActiveFilters
                  ? `${NS}.noFilterResultsSub`
                  : `${NS}.noTxHistorySub`,
              )}
            />
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            ItemSeparatorComponent={ActivitySeparator}
            stickySectionHeadersEnabled={false}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={11}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...CENTER,
  },
  emptyContainer: {
    flex: 1,
    paddingTop: 160,
  },
  listContent: { paddingBottom: 24 },
  squareTop: { borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  squareBottom: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  middleRow: { borderRadius: 0 },
  first: { marginTop: 22 },
  firstFiltered: { marginTop: 8 },
  filterBar: {
    marginTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    rowGap: 2,
    columnGap: 12,
  },
  filterText: {
    fontFamily: FONT.Title_Regular,
    fontSize: 14,
    lineHeight: 20,
    includeFontPadding: false,
    flexShrink: 1,
  },
  clearButton: {
    minHeight: 44,
    paddingLeft: 16,
    paddingRight: 12,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
