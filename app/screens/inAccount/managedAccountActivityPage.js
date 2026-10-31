import { useRoute } from '@react-navigation/native';
import {
  SectionList,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../constants';
import { GlobalThemeView } from '../../functions/CustomElements';
import { useTranslation } from 'react-i18next';
import { useGlobalContextProvider } from '../../../context-store/context';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FullLoadingScreen from '../../functions/CustomElements/loadingScreen';
import { useFlashnet } from '../../../context-store/flashnetContext';
import CustomButton from '../../functions/CustomElements/button';
import { useKeysContext } from '../../../context-store/keys';
import { deriveChildMnemonic } from '../../functions/accounts/childAccounts';
import { getSparkAddress, getSparkIdentityPubKey } from '../../functions/spark';
import {
  getBitcoinWithdrawls,
  getTokenTransactions,
  initializeSparkWalletViewer,
} from '../../functions/spark/walletViewer';
import {
  mapTokenTxToRow,
  mapTransferToRow,
} from '../../functions/spark/walletViewerTransactions';
import { USDB_TOKEN_ID } from '../../constants';
import { useSparkWallet } from '../../../context-store/sparkContext';
import { useActiveCustodyAccount } from '../../../context-store/activeAccount';
import TopBar from '../../functions/CustomElements/redesign/TopBar';
import EmptyState from '../../functions/CustomElements/redesign/EmptyState';
import SectionHeader from '../../functions/CustomElements/redesign/SectionHeader';
import ListCard, {
  ListDivider,
} from '../../functions/CustomElements/redesign/ListCard';
import ActivityRow, {
  buildActivitySections,
} from '../../components/admin/homeComponents/viewAllComponents/activityRow';

const PAGE = 20;

// Rows sit in a per-row ListCard so the SectionList stays virtualised; only
// the first/last row of a day keeps the card's rounded corners.
const ActivitySeparator = () => (
  <ListCard style={styles.middleRow}>
    <ListDivider inset={68} />
  </ListCard>
);

export default function ManagedAccountActivityPage() {
  const route = useRoute();
  const { accountId, childIndex } = route.params || {};
  const { sparkInformation } = useSparkWallet();
  const { poolInfoRef, swapLimits } = useFlashnet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { accountMnemoinc } = useKeysContext();
  const { getAccountMnemonic, custodyAccountsList } = useActiveCustodyAccount();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const userBalanceDenomination = masterInfoObject.userBalanceDenomination;

  const isChild = childIndex !== undefined;

  const accountInformation = useMemo(() => {
    if (isChild) {
      return (masterInfoObject?.childAccounts || []).find(
        item => item.uuid === accountId,
      );
    }
    return custodyAccountsList?.find(item => item.uuid === accountId) || {};
  }, [
    isChild,
    accountId,
    custodyAccountsList,
    masterInfoObject?.childAccounts,
  ]);

  const [rawRows, setRawRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const sparkAddressRef = useRef(null);
  const identityPubKeyRef = useRef(null);
  const btcOffsetRef = useRef(0);
  const tokenCursorRef = useRef('');
  const hasMoreBtcRef = useRef(true);
  const hasMoreTokenRef = useRef(true);
  const loadUUIDRef = useRef(0);

  const loadNextPage = useCallback(async () => {
    const loadUUID = ++loadUUIDRef.current;
    setIsLoadingMore(true);
    try {
      const sparkAddress = sparkAddressRef.current;
      if (!sparkAddress) return;

      const fetches = [];
      if (hasMoreBtcRef.current) {
        fetches.push(
          getBitcoinWithdrawls(sparkAddress, {
            limit: PAGE,
            offset: btcOffsetRef.current,
          }).then(result => ({ kind: 'btc', result })),
        );
      }
      if (hasMoreTokenRef.current) {
        fetches.push(
          getTokenTransactions(sparkAddress, {
            pageSize: PAGE,
            cursor: tokenCursorRef.current,
          }).then(result => ({ kind: 'token', result })),
        );
      }
      if (!fetches.length) return;

      const results = await Promise.all(fetches);
      if (loadUUIDRef.current !== loadUUID) return;

      const newRows = [];
      for (const { kind, result } of results) {
        if (!result) continue;
        if (kind === 'btc') {
          const { transfers = [], offset } = result;
          hasMoreBtcRef.current = transfers.length === PAGE;
          btcOffsetRef.current =
            offset ?? btcOffsetRef.current + transfers.length;
          for (const transfer of transfers) {
            newRows.push(mapTransferToRow(transfer, identityPubKeyRef.current));
          }
        } else {
          const { transactions = [], pageResponse } = result;
          tokenCursorRef.current = pageResponse?.nextCursor;
          hasMoreTokenRef.current = !!pageResponse?.hasNextPage;
          for (const tokenTx of transactions) {
            newRows.push(mapTokenTxToRow(tokenTx, identityPubKeyRef.current));
          }
        }
      }

      if (newRows.length) {
        setRawRows(prev =>
          [...prev, ...newRows].sort(
            (a, b) => JSON.parse(b.details).time - JSON.parse(a.details).time,
          ),
        );
      }
      setHasMore(hasMoreBtcRef.current || hasMoreTokenRef.current);
      setIsLoading(false);
    } finally {
      if (loadUUIDRef.current === loadUUID) {
        setIsLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const mnemonic = isChild
          ? await deriveChildMnemonic(accountMnemoinc, childIndex)
          : await getAccountMnemonic(accountInformation);
        const addressResponse = await getSparkAddress(mnemonic);
        if (!addressResponse?.didWork) {
          throw new Error('Unable to derive managed account spark address');
        }
        const identityPublicKeyHex = await getSparkIdentityPubKey(mnemonic);
        sparkAddressRef.current = addressResponse.response;
        identityPubKeyRef.current = identityPublicKeyHex;
        await initializeSparkWalletViewer(mnemonic);
        if (!isMounted) return;
        await loadNextPage();
      } catch (err) {
        console.log('error loading managed account activity', err);
        if (isMounted) setIsLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [
    accountMnemoinc,
    childIndex,
    isChild,
    accountInformation?.uuid,
    loadNextPage,
  ]);

  // Same rows and day sections as the Activity page. The account's token
  // metadata isn't loaded here, so USDB falls back to its known decimals.
  const tokens = useMemo(
    () => ({
      ...sparkInformation.tokens,
      [USDB_TOKEN_ID]: sparkInformation.tokens?.[USDB_TOKEN_ID] ?? {
        tokenMetadata: { decimals: 6, tokenTicker: 'USDB' },
      },
    }),
    [sparkInformation.tokens],
  );

  const sections = useMemo(
    () =>
      buildActivitySections({
        transactions: rawRows,
        tokens,
        enabledLRC20: true,
        t,
      }),
    [rawRows, tokens, t],
  );

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
          // Rows belong to another account, so taps stay inert (as before).
          navigate={NO_OP_NAVIGATE}
          userBalanceDenomination={userBalanceDenomination}
          tokens={tokens}
          poolInfoRef={poolInfoRef}
          swapLimits={swapLimits}
          // Memo saves only update the active account's tx list.
          canEditMemo={false}
        />
      </ListCard>
    ),
    [userBalanceDenomination, tokens, poolInfoRef, swapLimits],
  );

  const renderSectionHeader = useCallback(
    ({ section }) => (
      <SectionHeader
        title={section.title}
        style={section === sections[0] && styles.first}
      />
    ),
    [sections],
  );

  // Also shown on the empty state: a page whose rows are all filtered out
  // must still be able to load the next page.
  const loadMoreButton = hasMore ? (
    <CustomButton
      buttonStyles={styles.loadMoreButton}
      actionFunction={loadNextPage}
      textContent={t('constants.loadMore')}
      useLoading={isLoadingMore}
      size={'regular'}
      tone={'secondary'}
    />
  ) : null;

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar title={t('settings.childAccounts.transactions.title')} />
        {isLoading ? (
          <FullLoadingScreen />
        ) : !sections.length ? (
          <View style={styles.emptyContainer}>
            <EmptyState
              icon={'Clock'}
              title={t('settings.childAccounts.page.noTransactions')}
              sub={t('settings.childAccounts.transactions.noTxHistorySub', {
                name: accountInformation?.name,
              })}
            />
            {loadMoreButton}
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
            ListFooterComponent={loadMoreButton}
          />
        )}
      </View>
    </GlobalThemeView>
  );
}

const NO_OP_NAVIGATE = { navigate: () => {} };

const styles = StyleSheet.create({
  container: { flex: 1, ...CENTER },
  emptyContainer: {
    flex: 1,
    paddingTop: 160,
  },
  listContent: { paddingBottom: 24 },
  squareTop: { borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  squareBottom: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  middleRow: { borderRadius: 0 },
  first: { marginTop: 22 },
  loadMoreButton: {
    width: '100%',
    marginTop: 16,
  },
});
