import {StyleSheet, View} from 'react-native';
import {UserSatAmount} from './homeLightning/userSatAmount';
import {useGlobalContextProvider} from '../../../../context-store/context';
import {GlobalThemeView, ThemeText} from '../../../functions/CustomElements';
import CustomFlatList from './homeLightning/cusomFlatlist/CustomFlatList';
import {NavBar} from './navBar';

import {useNavigation} from '@react-navigation/native';
import {useUpdateHomepageTransactions} from '../../../hooks/updateHomepageTransactions';
import {useEffect, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {useAppStatus} from '../../../../context-store/appStatus';
import {useGlobalThemeContext} from '../../../../context-store/theme';
import {SendRecieveBTNs} from './homeLightning/sendReciveBTNs';
import {useSparkWallet} from '../../../../context-store/sparkContext';
import getFormattedHomepageTxsForSpark from '../../../functions/combinedTransactionsSpark';

export default function HomeLightning() {
  console.log('HOME LIGHTNING PAGE');
  const {sparkInformation, numberOfCachedTxs} = useSparkWallet();
  const {theme, darkModeType, toggleTheme} = useGlobalThemeContext();
  const {masterInfoObject} = useGlobalContextProvider();
  const {toggleDidGetToHomepage, isConnectedToTheInternet} = useAppStatus();
  const navigate = useNavigation();
  const currentTime = useUpdateHomepageTransactions();
  const {t} = useTranslation();

  const homepageTxPreferance = masterInfoObject.homepageTxPreferance;
  const userBalanceDenomination = masterInfoObject.userBalanceDenomination;

  useEffect(() => {
    toggleDidGetToHomepage(true);
  }, []);
  const flatListDataForSpark = useMemo(() => {
    return getFormattedHomepageTxsForSpark({
      currentTime,
      sparkInformation,
      homepageTxPreferance,
      navigate,
      frompage: 'home',
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
      numberOfCachedTxs,
    });
  }, [
    sparkInformation.transactions,
    homepageTxPreferance,
    navigate,
    currentTime,
    theme,
    darkModeType,
    userBalanceDenomination,
    numberOfCachedTxs,
  ]);

  return (
    <GlobalThemeView styles={{paddingBottom: 0, paddintTop: 0}}>
      <CustomFlatList
        style={{overflow: 'hidden', flex: 1}}
        data={flatListDataForSpark}
        renderItem={({item}) => item}
        HeaderComponent={<NavBar theme={theme} toggleTheme={toggleTheme} />}
        StickyElementComponent={
          <GlobalThemeView styles={style.balanceContainer}>
            <ThemeText
              content={t('constants.total_balance')}
              styles={{
                textTransform: 'uppercase',
              }}
            />
            <UserSatAmount
              isConnectedToTheInternet={isConnectedToTheInternet}
              theme={theme}
              darkModeType={darkModeType}
            />
          </GlobalThemeView>
        }
        TopListElementComponent={
          <View
            style={{
              alignItems: 'center',
            }}>
            <SendRecieveBTNs
              theme={theme}
              darkModeType={darkModeType}
              isConnectedToTheInternet={isConnectedToTheInternet}
            />
          </View>
        }
      />
    </GlobalThemeView>
  );
}

const style = StyleSheet.create({
  balanceContainer: {paddingTop: 0, paddingBottom: 10, alignItems: 'center'},
});
