import { useNavigation } from '@react-navigation/native';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { CENTER, CONTENT_KEYBOARD_OFFSET, SIZES } from '../../constants';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import { useTranslation } from 'react-i18next';
import { useGlobalThemeContext } from '../../../context-store/theme';
import CustomSettingsTopBar from '../../functions/CustomElements/settingsTopBar';
import { useUpdateHomepageTransactions } from '../../hooks/updateHomepageTransactions';
import { useGlobalContextProvider } from '../../../context-store/context';
import { useCallback, useEffect, useRef, useState } from 'react';
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
import {
  COLORS,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  WINDOWWIDTH,
} from '../../constants/theme';
import CustomButton from '../../functions/CustomElements/button';

const FILTER_DEBOUNCE_MS = 500;

export default function ViewAllTxPage() {
  const navigate = useNavigation();
  const [currentFilter, setCurrentFilter] = useState({
    directions: [],
    dateRange: null,
    types: [],
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
  const currentTime = useUpdateHomepageTransactions();
  const { t } = useTranslation();
  const { backgroundOffset } = GetThemeColors();
  const userBalanceDenomination = masterInfoObject.userBalanceDenomination;
  const enabledLRC20 = showTokensInformation;
  const { bottomPadding } = useGlobalInsets();

  useEffect(() => {
    const debounceTimer = setTimeout(
      () => {
        async function handleLoadTxs() {
          try {
            const hasActiveFilters =
              currentFilter.directions.length > 0 ||
              currentFilter.dateRange !== null ||
              currentFilter.types.length > 0;

            let transactions;
            if (!hasActiveFilters) {
              transactions = sparkInformation.transactions;
            } else {
              transactions = await getFilteredTransactions(
                {
                  directions: currentFilter.directions,
                  dateRange: currentFilter.dateRange,
                  types: currentFilter.types,
                },
                { accountId: sparkInformation.identityPubKey },
              );
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

  const handleFilterApply = useCallback(filters => {
    searchUUIDRef.current = customUUID();
    setIsLoadingNewTxs(true);
    setCurrentFilter({ ...filters, searchUUID: searchUUIDRef.current });
  }, []);

  const doesNotHaveTransactions = txs.length === 1 && txs[0].key === 'noTx';

  const badgeCount =
    currentFilter.directions.length +
    (currentFilter.dateRange ? 1 : 0) +
    currentFilter.types.length;

  return (
    <GlobalThemeView useStandardWidth={true} styles={styles.globalContainer}>
      <View style={styles.contentContainer}>
        <CustomSettingsTopBar
          showLeftImage={true}
          iconNew="SlidersHorizontal"
          badgeCount={badgeCount}
          label={t('screens.inAccount.viewAllTxPage.title')}
          leftImageFunction={() => {
            navigate.navigate('CustomHalfModal', {
              wantedContent: 'txFilter',
              sliderHight: 0.65,
              currentFilter: {
                directions: currentFilter.directions,
                dateRange: currentFilter.dateRange,
                types: currentFilter.types,
              },
              onSelectFilter: filters => handleFilterApply(filters),
            });
          }}
        />

        <View style={{ flex: 1 }}>
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
            />
          )}
        </View>
      </View>
      <TouchableOpacity
        style={styles.exportButton}
        onPress={() => {
          navigate.navigate('CustomHalfModal', {
            wantedContent: 'exportTransactions',
            sliderHight: 0.5,
          });
        }}
      >
        <View style={styles.paddingContainer}>
          <ThemeIcon
            colorOverride={
              theme && darkModeType ? COLORS.lightModeText : COLORS.primary
            }
            iconName="Share"
            size={18}
          />
          <ThemeText
            styles={styles.exportButtonText}
            content={t('screens.inAccount.viewAllTxPage.exportButton')}
          />
        </View>
      </TouchableOpacity>
    </GlobalThemeView>
  );
}
const styles = StyleSheet.create({
  globalContainer: { width: '100%' },
  contentContainer: {
    width: WINDOWWIDTH,
    flex: 1,
    ...CENTER,
  },
  filterName: {
    textAlign: 'center',
    opacity: HIDDEN_OPACITY,
    marginBottom: CONTENT_KEYBOARD_OFFSET,
  },
  exportButton: {
    minHeight: 50,
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: CONTENT_KEYBOARD_OFFSET,
    borderRadius: 12,
    backgroundColor: COLORS.darkModeText,
  },
  paddingContainer: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exportButtonText: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
    color: COLORS.lightModeText,
  },
});
