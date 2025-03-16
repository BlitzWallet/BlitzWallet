import {useNavigation} from '@react-navigation/native';
import {FlatList, Platform, View} from 'react-native';
import {ICONS} from '../../constants';
import {ANDROIDSAFEAREA} from '../../constants/styles';
import {GlobalThemeView} from '../../functions/CustomElements';
import getFormattedHomepageTxs from '../../functions/combinedTransactions';
import {useTranslation} from 'react-i18next';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useGlobalThemeContext} from '../../../context-store/theme';
import useHandleBackPressNew from '../../hooks/useHandleBackPressNew';
import CustomSettingsTopBar from '../../functions/CustomElements/settingsTopBar';
import {useUpdateHomepageTransactions} from '../../hooks/updateHomepageTransactions';
import {useGlobalContextProvider} from '../../../context-store/context';
import {useGlobalTxContextProvider} from '../../../context-store/combinedTransactionsContext';
import {useEffect, useState} from 'react';
import FullLoadingScreen from '../../functions/CustomElements/loadingScreen';

export default function ViewAllTxPage() {
  const navigate = useNavigation();
  const {combinedTransactions} = useGlobalTxContextProvider();
  const {masterInfoObject} = useGlobalContextProvider();
  const {theme, darkModeType} = useGlobalThemeContext();
  const [txs, setTxs] = useState([]);
  const currentTime = useUpdateHomepageTransactions();
  const insets = useSafeAreaInsets();
  const {t} = useTranslation();
  useHandleBackPressNew();
  const userBalanceDenomination = masterInfoObject.userBalanceDenomination;

  const bottomPadding = Platform.select({
    ios: insets.bottom,
    android: ANDROIDSAFEAREA,
  });

  useEffect(() => {
    const formattedTxs = getFormattedHomepageTxs({
      currentTime,
      combinedTransactions,
      navigate,
      isBankPage: false,
      frompage: 'viewAllTx',
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
    });
    setTxs(formattedTxs);
  }, [
    currentTime,
    combinedTransactions,
    navigate,
    theme,
    darkModeType,
    userBalanceDenomination,
  ]);

  return (
    <GlobalThemeView useStandardWidth={true} styles={{paddingBottom: 0}}>
      <CustomSettingsTopBar
        showLeftImage={true}
        leftImageBlue={ICONS.share}
        LeftImageDarkMode={ICONS.shareWhite}
        label={'Transactions'}
        leftImageFunction={() => {
          navigate.navigate('CustomHalfModal', {
            wantedContent: 'exportTransactions',
            sliderHight: 0.5,
          });
        }}
      />

      {!txs.length ? (
        <FullLoadingScreen />
      ) : (
        <FlatList
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={3}
          style={{flex: 1, width: '100%'}}
          showsVerticalScrollIndicator={false}
          data={txs}
          renderItem={({item}) => item}
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
