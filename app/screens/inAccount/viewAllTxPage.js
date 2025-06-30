import {useNavigation} from '@react-navigation/native';
import {FlatList, Platform, View} from 'react-native';
import {ICONS} from '../../constants';
import {GlobalThemeView} from '../../functions/CustomElements';
import {useTranslation} from 'react-i18next';

import {useGlobalThemeContext} from '../../../context-store/theme';
import useHandleBackPressNew from '../../hooks/useHandleBackPressNew';
import CustomSettingsTopBar from '../../functions/CustomElements/settingsTopBar';
import {useUpdateHomepageTransactions} from '../../hooks/updateHomepageTransactions';
import {useGlobalContextProvider} from '../../../context-store/context';
import {useEffect, useState} from 'react';
import FullLoadingScreen from '../../functions/CustomElements/loadingScreen';
import getFormattedHomepageTxsForSpark from '../../functions/combinedTransactionsSpark';
import {useSparkWallet} from '../../../context-store/sparkContext';
import {useGlobalInsets} from '../../../context-store/insetsProvider';

export default function ViewAllTxPage() {
  const navigate = useNavigation();
  const {sparkInformation} = useSparkWallet();
  const {masterInfoObject} = useGlobalContextProvider();
  const {theme, darkModeType} = useGlobalThemeContext();
  const [txs, setTxs] = useState([]);
  const currentTime = useUpdateHomepageTransactions();
  const {t} = useTranslation();
  useHandleBackPressNew();
  const userBalanceDenomination = masterInfoObject.userBalanceDenomination;
  const {bottomPadding} = useGlobalInsets();

  useEffect(() => {
    const txs = getFormattedHomepageTxsForSpark({
      currentTime,
      sparkInformation,
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
    });

    setTxs(txs);
  }, [
    currentTime,
    sparkInformation,
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
