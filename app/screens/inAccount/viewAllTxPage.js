import { useNavigation } from '@react-navigation/native';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CENTER,
  COLORS,
  CONTENT_KEYBOARD_OFFSET,
  SIZES,
} from '../../constants';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import { useTranslation } from 'react-i18next';
import { useGlobalThemeContext } from '../../../context-store/theme';
import CustomSettingsTopBar from '../../functions/CustomElements/settingsTopBar';
import { useUpdateHomepageTransactions } from '../../hooks/updateHomepageTransactions';
import { useGlobalContextProvider } from '../../../context-store/context';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FullLoadingScreen from '../../functions/CustomElements/loadingScreen';
import getFormattedHomepageTxsForSpark from '../../functions/combinedTransactionsSpark';
import { useSparkWallet } from '../../../context-store/sparkContext';
import { useGlobalInsets } from '../../../context-store/insetsProvider';
import { useFlashnet } from '../../../context-store/flashnetContext';
import GetThemeColors from '../../hooks/themeColors';
import { getFilteredTransactions } from '../../functions/spark/transactions';
import customUUID from '../../functions/customUUID';
import ThemeIcon from '../../functions/CustomElements/themeIcon';
import NoContentSceen from '../../functions/CustomElements/noContentScreen';
import { HIDDEN_OPACITY, INSET_WINDOW_WIDTH } from '../../constants/theme';

const FILTER_DEBOUNCE_MS = 500;

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

export default function ViewAllTxPage() {
  const navigate = useNavigation();
  const [currentFilter, setCurrentFilter] = useState({
    item: 'All',
    searchUUID: '',
  });
  const [isLoadingNewTxs, setIsLoadingNewTxs] = useState(false);
  const { sparkInformation, showTokensInformation } = useSparkWallet();
  const { poolInfoRef } = useFlashnet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { theme, darkModeType } = useGlobalThemeContext();
  const [txs, setTxs] = useState([]);
  const searchUUIDRef = useRef('');
  const isInitialLoad = useRef(true);
  const scrollViewRef = useRef(null);
  const pillLayoutsRef = useRef({}); // { [key]: { x, width } }
  const scrollViewWidthRef = useRef(0);
  const scrollOffsetRef = useRef(0);
  const currentTime = useUpdateHomepageTransactions();
  const { t } = useTranslation();
  const { backgroundOffset, textColor } = GetThemeColors();
  const userBalanceDenomination = masterInfoObject.userBalanceDenomination;
  const enabledLRC20 = showTokensInformation;
  const { bottomPadding } = useGlobalInsets();

  useEffect(() => {
    const debounceTimer = setTimeout(
      () => {
        async function handleLoadTxs() {
          try {
            let transactions;
            if (currentFilter.item === 'All') {
              transactions = sparkInformation.transactions;
            } else {
              transactions = await getFilteredTransactions(currentFilter.item, {
                accountId: sparkInformation.identityPubKey,
              });
            }

            const formattedTxs = getFormattedHomepageTxsForSpark({
              currentTime,
              sparkInformation: {
                ...sparkInformation,
                transactions,
              },
              navigate,
              frompage: 'viewAllTx',
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
              enabledLRC20,
              poolInfoRef,
              t,
            });

            if (searchUUIDRef.current === currentFilter.searchUUID) {
              setTxs(formattedTxs);
            }
          } finally {
            isInitialLoad.current = false;
            if (searchUUIDRef.current === currentFilter.searchUUID) {
              setIsLoadingNewTxs(false);
            }
          }
        }
        handleLoadTxs();
      },
      isInitialLoad.current ? 0 : FILTER_DEBOUNCE_MS,
    );

    return () => clearTimeout(debounceTimer);
  }, [
    currentTime,
    sparkInformation,
    t,
    navigate,
    theme,
    darkModeType,
    userBalanceDenomination,
    enabledLRC20,
    currentFilter,
  ]);

  const handleFilterSwitch = useCallback(item => {
    searchUUIDRef.current = customUUID();
    setIsLoadingNewTxs(true);
    setCurrentFilter({ item, searchUUID: searchUUIDRef.current });

    // Scroll the pill into full view
    const layout = pillLayoutsRef.current[item];
    if (!layout || !scrollViewRef.current) return;

    const { x, width } = layout;
    const visibleLeft = scrollOffsetRef.current;
    const visibleRight = scrollOffsetRef.current + scrollViewWidthRef.current;

    const rightEdge = x + width;
    const PADDING = 8;

    if (rightEdge > visibleRight) {
      // Pill overflows on the right — scroll right so it's fully visible
      scrollViewRef.current.scrollTo({
        x: rightEdge - scrollViewWidthRef.current + PADDING,
        animated: true,
      });
    } else if (x < visibleLeft) {
      // Pill overflows on the left — scroll left so it's fully visible
      scrollViewRef.current.scrollTo({
        x: Math.max(0, x - PADDING),
        animated: true,
      });
    }
  }, []);

  const filterOptions = useMemo(() => {
    return FILTER_KEYS.map(key => {
      const label = t(`screens.inAccount.viewAllTxPage.filter${key}`);
      return (
        <TouchableOpacity
          style={[
            styles.filterPillContainer,
            {
              backgroundColor:
                currentFilter.item === key
                  ? COLORS.darkModeText
                  : backgroundOffset,
            },
          ]}
          key={key}
          onPress={() => handleFilterSwitch(key)}
          onLayout={e => {
            const { x, width } = e.nativeEvent.layout;
            pillLayoutsRef.current[key] = { x, width };
          }}
        >
          <ThemeText
            styles={[
              styles.pillText,
              {
                color:
                  currentFilter.item === key ? COLORS.lightModeText : textColor,
              },
            ]}
            content={label}
          />
        </TouchableOpacity>
      );
    });
  }, [backgroundOffset, currentFilter, handleFilterSwitch, t]);

  const doesNotHaveTransactions = txs.length === 1 && txs[0].key === 'noTx';

  return (
    <GlobalThemeView useStandardWidth={true} styles={styles.globalContainer}>
      <CustomSettingsTopBar
        showLeftImage={true}
        iconNew="Share"
        label={t('screens.inAccount.viewAllTxPage.title')}
        leftImageFunction={() => {
          navigate.navigate('CustomHalfModal', {
            wantedContent: 'exportTransactions',
            sliderHight: 0.5,
          });
        }}
      />
      {(!doesNotHaveTransactions || currentFilter.item !== 'All') && (
        <View>
          <ScrollView
            ref={scrollViewRef}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterPillScroll}
            horizontal
            onScroll={e => {
              scrollOffsetRef.current = e.nativeEvent.contentOffset.x;
            }}
            scrollEventThrottle={16}
            onLayout={e => {
              scrollViewWidthRef.current = e.nativeEvent.layout.width;
            }}
          >
            {filterOptions}
          </ScrollView>
        </View>
      )}

      {!txs.length || isLoadingNewTxs ? (
        <FullLoadingScreen />
      ) : doesNotHaveTransactions ? (
        <NoContentSceen
          iconName="Clock"
          titleText={t('screens.inAccount.viewAllTxPage.noTxHistoryTitle')}
          subTitleText={t('screens.inAccount.viewAllTxPage.noTxHistorySub')}
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
          ListFooterComponent={
            <View
              style={{
                width: '100%',
                height: bottomPadding,
              }}
            />
          }
        />
      )}
    </GlobalThemeView>
  );
}
const styles = StyleSheet.create({
  globalContainer: { paddingBottom: 0 },
  filterPillScroll: {
    gap: 8,
    marginVertical: CONTENT_KEYBOARD_OFFSET,
  },
  filterPillContainer: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  pillText: {
    includeFontPadding: false,
  },
  noTxContainer: {
    width: INSET_WINDOW_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...CENTER,
  },
  emptyTitle: {
    fontSize: SIZES.large,
    fontWeight: '500',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: SIZES.smedium,
    opacity: HIDDEN_OPACITY,
    textAlign: 'center',
  },
});
