import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import ThemeIcon from '../../../../functions/CustomElements/themeIcon';
import {
  APPROXIMATE_SYMBOL,
  CENTER,
  ICONS,
  SIZES,
} from '../../../../constants';
import {
  COLORS,
  HIDDEN_OPACITY,
  WINDOWWIDTH,
} from '../../../../constants/theme';
import {
  BTC_ASSET_ADDRESS,
  currentPriceAinBToPriceDollars,
  getUserSwapHistory,
} from '../../../../functions/spark/flashnet';
import { useActiveCustodyAccount } from '../../../../../context-store/activeAccount';
import ThemeImage from '../../../../functions/CustomElements/themeImage';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import GetThemeColors from '../../../../hooks/themeColors';
import { useTranslation } from 'react-i18next';
import { formatBalanceAmount } from '../../../../functions';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import CustomButton from '../../../../functions/CustomElements/button';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import { getTimeDisplay } from '../../../../functions/contacts';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';

export default function ConversionHistory() {
  const { theme, darkModeType } = useGlobalThemeContext();
  const { backgroundColor, backgroundOffset } = GetThemeColors();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { bottomPadding } = useGlobalInsets();
  const { fiatStats } = useNodeContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { t } = useTranslation();
  const navigate = useNavigation();
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [finishedInitialLoad, setFinishedInitialLoad] = useState(false);
  const [data, setData] = useState({ swaps: [], totalCount: 0 });

  const displayedData = data.swaps;
  const hasMore = data.swaps.length < data.totalCount;

  const handleLoadMore = async () => {
    setIsLoadingMore(true);
    try {
      const swaps = await getUserSwapHistory(
        currentWalletMnemoinc,
        20,
        data.swaps.length,
      );

      if (swaps.didWork) {
        setData({
          swaps: [...data.swaps, ...swaps.swaps],
          totalCount: swaps.totalCount,
        });
      }
    } catch (err) {
      navigate.navigate('ErrorScreen', {
        errorMessage: t(
          'screens.inAccount.swapHistory.loadingSwapHistoryError',
        ),
      });
    } finally {
      setIsLoadingMore(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    async function loadSwapHistory() {
      try {
        const swaps = await getUserSwapHistory(currentWalletMnemoinc, 20);
        if (swaps.didWork && mounted) {
          setData({ swaps: swaps.swaps, totalCount: swaps.totalCount });
        }
      } catch (err) {
        navigate.navigate('ErrorScreen', {
          errorMessage: t(
            'screens.inAccount.swapHistory.loadingSwapHistoryError',
          ),
        });
      } finally {
        setFinishedInitialLoad(true);
      }
    }
    loadSwapHistory();
    return () => {
      mounted = false;
    };
  }, []);

  const formatDate = timestamp => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());

    const timeDifferenceMinutes = diffTime / (1000 * 60);
    const timeDifferenceHours = diffTime / (1000 * 60 * 60);
    const timeDifferenceDays = diffTime / (1000 * 60 * 60 * 24);
    const timeDifferenceYears = diffTime / (1000 * 60 * 60 * 24 * 365);

    return getTimeDisplay(
      timeDifferenceMinutes,
      timeDifferenceHours,
      timeDifferenceDays,
      timeDifferenceYears,
    );
  };

  const renderItem = ({ item }) => {
    const isBtcToUsdSwap = item.assetInAddress === BTC_ASSET_ADDRESS;
    const amountOut = item.amountOut;
    const formattedAmountOut = isBtcToUsdSwap
      ? formatBalanceAmount(
          amountOut / Math.pow(10, 6),
          false,
          masterInfoObject,
        )
      : amountOut;

    const price = currentPriceAinBToPriceDollars(item.price).toFixed(2);
    const date = formatDate(item.timestamp);

    return (
      <View
        style={[styles.transactionRow, { backgroundColor: backgroundOffset }]}
      >
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor:
                theme && darkModeType
                  ? darkModeType
                    ? backgroundColor
                    : backgroundOffset
                  : isBtcToUsdSwap
                  ? COLORS.bitcoinOrange
                  : COLORS.dollarGreen,
              width: 39,
              height: 39,
              borderRadius: 26,
              borderWidth: 2,
              borderColor: backgroundOffset,
              zIndex: 99,
              marginRight: -5,
            },
          ]}
        >
          <ThemeImage
            styles={{ width: 20, height: 20 }}
            lightModeIcon={
              isBtcToUsdSwap ? ICONS.bitcoinIcon : ICONS.dollarIcon
            }
            darkModeIcon={isBtcToUsdSwap ? ICONS.bitcoinIcon : ICONS.dollarIcon}
            lightsOutIcon={
              isBtcToUsdSwap ? ICONS.bitcoinIcon : ICONS.dollarIcon
            }
          />
        </View>
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor:
                theme && darkModeType
                  ? darkModeType
                    ? backgroundColor
                    : backgroundOffset
                  : isBtcToUsdSwap
                  ? COLORS.dollarGreen
                  : COLORS.bitcoinOrange,
              marginRight: 5,
            },
          ]}
        >
          <ThemeImage
            styles={{ width: 20, height: 20 }}
            lightModeIcon={
              isBtcToUsdSwap ? ICONS.dollarIcon : ICONS.bitcoinIcon
            }
            darkModeIcon={isBtcToUsdSwap ? ICONS.dollarIcon : ICONS.bitcoinIcon}
            lightsOutIcon={
              isBtcToUsdSwap ? ICONS.dollarIcon : ICONS.bitcoinIcon
            }
          />
        </View>

        <View style={styles.transactionContent}>
          <ThemeText
            styles={styles.transactionTitle}
            content={`${
              isBtcToUsdSwap
                ? t('screens.inAccount.swapsPage.swapDirection_btcusd')
                : t('screens.inAccount.swapsPage.swapDirection_usdbtc')
            }`}
          />
          <ThemeText styles={styles.transactionSubtext} content={date} />
        </View>

        <View style={styles.amountContainer}>
          <ThemeText
            styles={styles.amountText}
            content={displayCorrectDenomination({
              amount: formattedAmountOut,
              fiatStats: fiatStats,
              masterInfoObject: {
                ...masterInfoObject,
                userBalanceDenomination: isBtcToUsdSwap ? 'fiat' : 'sats',
              },
              convertAmount: !isBtcToUsdSwap,
              forceCurrency: 'USD',
            })}
          />
          <ThemeText
            styles={styles.transactionSubtext}
            content={`${APPROXIMATE_SYMBOL}${displayCorrectDenomination({
              amount: price,
              fiatStats: fiatStats,
              masterInfoObject: {
                ...masterInfoObject,
                userBalanceDenomination: 'fiat',
              },
              convertAmount: false,
              forceCurrency: 'USD',
            })}`}
          />
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <ThemeIcon iconName={'ArrowUpDown'} />
      <ThemeText
        styles={styles.emptyTitle}
        content={t('screens.inAccount.swapHistory.noHisotorytitle')}
      />
      <ThemeText
        styles={styles.emptySubtext}
        content={t('screens.inAccount.swapHistory.noHisotorydesc')}
      />
    </View>
  );

  const renderFooter = () => {
    if (!hasMore) return null;

    return (
      <View style={styles.footerContainer}>
        <CustomButton
          useLoading={isLoadingMore}
          textContent={t('constants.loadMore')}
          disabled={isLoadingMore}
          actionFunction={handleLoadMore}
        />
      </View>
    );
  };

  return (
    <GlobalThemeView styles={{ paddingBottom: 0 }} useStandardWidth={true}>
      <CustomSettingsTopBar
        label={t('screens.inAccount.swapHistory.pageTitle')}
      />

      {finishedInitialLoad ? (
        <FlatList
          data={displayedData}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          contentContainerStyle={
            data.totalCount === 0
              ? styles.emptyListContainer
              : { ...styles.listContainer, paddingBottom: bottomPadding }
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FullLoadingScreen />
      )}
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  listContainer: {
    gap: 10,
  },
  emptyListContainer: {
    flexGrow: 1,
  },
  transactionRow: {
    width: WINDOWWIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 10,
    ...CENTER,
    borderRadius: 8,
  },
  iconContainer: {
    width: 35,
    height: 35,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transactionContent: {
    flex: 1,
    justifyContent: 'center',
    marginLeft: 5,
  },
  transactionTitle: {
    marginBottom: 2,
    includeFontPadding: false,
  },
  transactionSubtext: {
    fontSize: SIZES.small,
    opacity: HIDDEN_OPACITY,
    includeFontPadding: false,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amountText: {
    marginBottom: 2,
    includeFontPadding: false,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
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
  footerContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
});
