import { useNavigation } from '@react-navigation/native';
import { FlatList, StyleSheet, View } from 'react-native';
import { COLORS, SIZES } from '../../../../constants';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import { useMemo, useState } from 'react';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { useGlobalInsets } from '../../../../../context-store/insetsProvider';
import NoContentSceen from '../../../../functions/CustomElements/noContentScreen';
import GetThemeColors from '../../../../hooks/themeColors';
import { WINDOWWIDTH } from '../../../../constants/theme';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import getFormattedHomepageTxsForSpark from '../../../../functions/combinedTransactionsSpark';
import { useUpdateHomepageTransactions } from '../../../../hooks/updateHomepageTransactions';
import { useFlashnet } from '../../../../../context-store/flashnetContext';
import { useTranslation } from 'react-i18next';
import { LineChart } from 'react-native-wagmi-charts';
import { useAppStatus } from '../../../../../context-store/appStatus';
import displayCorrectDenomination from '../../../../functions/displayCorrectDenomination';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useAnalytics } from '../../../../../context-store/analyticsContext';

export default function AnalyticsSpentPage(props) {
  const navigate = useNavigation();
  const { localDenomination } = props.route.params || {};
  const { masterInfoObject } = useGlobalContextProvider();
  const { sparkInformation } = useSparkWallet();
  const { poolInfoRef } = useFlashnet();
  const { fiatStats } = useNodeContext();
  const { bottomPadding } = useGlobalInsets();
  const { backgroundOffset, backgroundColor } = GetThemeColors();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { t } = useTranslation();
  const currentTime = useUpdateHomepageTransactions();
  const [selectedDay, setSelectedDay] = useState(null);
  const { screenDimensions } = useAppStatus();
  const {
    outTxsBTC,
    outTxsUSD,
    spentTotalBTC,
    spentTotalUSD,
    cumulativeSpentDataBTC,
    cumulativeSpentDataUSD,
    isLoading,
  } = useAnalytics();

  const isFiat = localDenomination === 'fiat';
  const txs = isFiat ? outTxsUSD : outTxsBTC;
  const totalSpent = isFiat ? spentTotalUSD : spentTotalBTC;
  const cumulativeData = isFiat
    ? cumulativeSpentDataUSD
    : cumulativeSpentDataBTC;

  const displayAmount = selectedDay ? selectedDay.value : totalSpent;

  const chartColor =
    theme && darkModeType ? COLORS.darkModeText : COLORS.primary;

  const formattedTxs = useMemo(() => {
    if (!txs.length) return [];
    return getFormattedHomepageTxsForSpark({
      currentTime,
      sparkInformation: { ...sparkInformation, transactions: txs },
      navigate,
      frompage: 'viewAllTx',
      viewAllTxText: '',
      noTransactionHistoryText: '',
      todayText: t('constants.today'),
      yesterdayText: t('constants.yesterday'),
      dayText: t('constants.day'),
      monthText: t('constants.month'),
      yearText: t('constants.year'),
      agoText: t('transactionLabelText.ago'),
      theme,
      darkModeType,
      userBalanceDenomination: localDenomination,
      didGetToHomepage: true,
      enabledLRC20: false,
      poolInfoRef,
      t,
    });
  }, [txs, currentTime, theme, darkModeType, localDenomination]);

  return (
    <GlobalThemeView styles={{ paddingBottom: 0 }} useStandardWidth={true}>
      <CustomSettingsTopBar
        label={t('constants.sent')}
        containerStyles={{ marginBottom: 0 }}
      />

      {isLoading ? null : txs.length === 0 ? (
        <View style={{ flex: 1 }}>
          <NoContentSceen
            iconName="Binoculars"
            titleText={t('analytics.breakdown.noSentTitle')}
            subTitleText={t('analytics.breakdown.noSentSub')}
          />
        </View>
      ) : (
        <FlatList
          data={formattedTxs}
          keyExtractor={(item, i) => item?.key || String(i)}
          contentContainerStyle={{ paddingBottom: bottomPadding, flexGrow: 1 }}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={3}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              <View
                style={[
                  styles.headerAmountContainer,
                  { backgroundColor: backgroundOffset },
                ]}
              >
                <View
                  style={{
                    backgroundColor,
                    alignSelf: 'flex-start',
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 20,
                    marginHorizontal: 15,
                  }}
                >
                  <ThemeText
                    content={t('analytics.thisMonth')}
                    styles={styles.durationCard}
                  />
                </View>
                <ThemeText
                  styles={styles.totalAmount}
                  content={displayCorrectDenomination({
                    amount: displayAmount,
                    masterInfoObject: {
                      ...masterInfoObject,
                      userBalanceDenomination: localDenomination,
                    },
                    fiatStats,
                    convertAmount: !isFiat,
                    forceCurrency: isFiat ? 'USD' : undefined,
                  })}
                />

                <LineChart.Provider
                  data={cumulativeData}
                  onCurrentIndexChange={index =>
                    setSelectedDay(index >= 0 ? cumulativeData[index] : null)
                  }
                >
                  <LineChart
                    yGutter={0}
                    style={{ marginBottom: -10 }}
                    height={125}
                    width={screenDimensions.width * 0.95}
                  >
                    <LineChart.Path color={chartColor}>
                      <LineChart.Gradient />
                    </LineChart.Path>
                    <LineChart.CursorCrosshair color={chartColor} />
                  </LineChart>
                </LineChart.Provider>
              </View>

              <ThemeText
                styles={styles.txSectionTitle}
                content={t('analytics.transactions')}
              />
            </View>
          }
          renderItem={({ item }) => item?.item}
        />
      )}
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  headerAmountContainer: {
    width: '100%',
    alignSelf: 'center',
    marginTop: 25,
    marginBottom: 24,
    borderRadius: 16,
    paddingTop: 20,
    paddingBottom: 0,
  },
  totalAmount: {
    fontSize: SIZES.huge,
    includeFontPadding: false,
    marginTop: 8,
    marginBottom: 30,
    paddingHorizontal: 15,
  },
  monthLabel: {
    fontSize: SIZES.smedium,
    opacity: 0.6,
    marginTop: 2,
  },
  txSectionTitle: {
    width: WINDOWWIDTH,
    alignSelf: 'center',
    fontSize: SIZES.medium,
    marginBottom: 8,
    marginTop: 16,
  },
  durationCard: {
    fontSize: SIZES.smedium,
    includeFontPadding: false,
    textAlign: 'center',
  },
});
