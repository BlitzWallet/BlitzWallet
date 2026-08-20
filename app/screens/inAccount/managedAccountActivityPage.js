import { useRoute } from '@react-navigation/native';
import { FlatList, StyleSheet, View } from 'react-native';
import { CENTER, CONTENT_KEYBOARD_OFFSET } from '../../constants';
import { GlobalThemeView } from '../../functions/CustomElements';
import { useTranslation } from 'react-i18next';
import { useGlobalThemeContext } from '../../../context-store/theme';
import CustomSettingsTopBar from '../../functions/CustomElements/settingsTopBar';
import { useUpdateHomepageTransactions } from '../../hooks/updateHomepageTransactions';
import { useGlobalContextProvider } from '../../../context-store/context';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FullLoadingScreen from '../../functions/CustomElements/loadingScreen';
import getFormattedHomepageTxsForSpark from '../../functions/combinedTransactionsSpark';
import { useFlashnet } from '../../../context-store/flashnetContext';
import NoContentSceen from '../../functions/CustomElements/noContentScreen';
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
import { INSET_WINDOW_WIDTH } from '../../constants/theme';

const PAGE = 20;

export default function ManagedAccountActivityPage() {
  const route = useRoute();
  const { accountId, childIndex } = route.params || {};
  const { sparkInformation } = useSparkWallet();
  const { poolInfoRef, swapLimits } = useFlashnet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { accountMnemoinc } = useKeysContext();
  const { getAccountMnemonic, custodyAccountsList } = useActiveCustodyAccount();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { t } = useTranslation();
  const currentTime = useUpdateHomepageTransactions();
  const userBalanceDenomination = masterInfoObject.userBalanceDenomination;

  const isChild = childIndex !== undefined;

  const accountInformation = useMemo(() => {
    if (isChild) {
      return (masterInfoObject?.childAccounts || []).find(
        item => item.uuid === accountId,
      );
    }
    return custodyAccountsList?.find(item => item.uuid === accountId) || {};
  }, [isChild, accountId, custodyAccountsList, masterInfoObject?.childAccounts]);

  const [rawRows, setRawRows] = useState([]);
  const [txs, setTxs] = useState([]);
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

  useEffect(() => {
    if (!rawRows.length) return;
    const formattedTxs = getFormattedHomepageTxsForSpark({
      currentTime,
      sparkInformation: {
        didConnect: true,
        identityPubKey: identityPubKeyRef.current,
        transactions: rawRows,
        tokens: {
          ...sparkInformation.tokens,
          [USDB_TOKEN_ID]: sparkInformation.tokens?.[USDB_TOKEN_ID] ?? {
            tokenMetadata: { decimals: 6, tokenTicker: 'USDB' },
          },
        },
      },
      navigate: { navigate: () => {} },
      frompage: 'managedAccount',
      viewAllTxText: t('wallet.see_all_txs'),
      noTransactionHistoryText: t('wallet.no_transaction_history'),
      todayText: t('constants.today'),
      yesterdayText: t('constants.yesterday'),
      dayText: t('constants.day'),
      monthText: t('constants.month'),
      yearText: t('constants.year'),
      agoText: t('transactionLabelText.ago'),
      theme,
      darkModeType,
      userBalanceDenomination,
      didGetToHomepage: true,
      enabledLRC20: true,
      poolInfoRef,
      t,
      swapLimits,
      showFailedTransactions: true,
    });
    setTxs(formattedTxs);
  }, [
    currentTime,
    rawRows,
    sparkInformation.tokens,
    t,
    theme,
    darkModeType,
    userBalanceDenomination,
    poolInfoRef,
    swapLimits.bitcoin,
  ]);

  const doesNotHaveTransactions = txs.length === 1 && txs[0].key === 'noTx';

  return (
    <GlobalThemeView useStandardWidth={true} style={styles.container}>
      <View style={styles.contentContainer}>
        <CustomSettingsTopBar
          showLeftImage={false}
          label={t('settings.childAccounts.transactions.title')}
        />
        <View style={{ flex: 1 }}>
          {isLoading ? (
            <FullLoadingScreen />
          ) : doesNotHaveTransactions || !rawRows.length ? (
            <NoContentSceen
              iconName="Clock"
              titleText={t('screens.inAccount.viewAllTxPage.noTxHistoryTitle')}
              subTitleText={t(
                'settings.childAccounts.transactions.noTxHistorySub',
              )}
            />
          ) : (
            <FlatList
              initialNumToRender={20}
              maxToRenderPerBatch={20}
              windowSize={3}
              style={{ flex: 1, width: '100%' }}
              showsVerticalScrollIndicator={false}
              data={txs}
              renderItem={({ item }) => item?.item}
            />
          )}
        </View>
        {hasMore && (
          <CustomButton
            buttonStyles={styles.loadMoreButton}
            actionFunction={loadNextPage}
            textContent={t('constants.loadMore')}
            useLoading={isLoadingMore}
          />
        )}
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', height: 100 },
  contentContainer: {
    width: '100%',
    flex: 1,
    ...CENTER,
  },
  loadMoreButton: {
    marginTop: CONTENT_KEYBOARD_OFFSET,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
  },
});
