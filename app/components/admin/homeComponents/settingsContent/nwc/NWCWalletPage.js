import {FlatList, StyleSheet, View} from 'react-native';
import {useCallback, useEffect, useMemo, useState} from 'react';

import {useNavigation} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';

import {UserSatAmount} from '../../homeLightning/userSatAmount';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomFlatList from '../../homeLightning/cusomFlatlist/CustomFlatList';
import {useUpdateHomepageTransactions} from '../../../../../hooks/updateHomepageTransactions';
import {useAppStatus} from '../../../../../../context-store/appStatus';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import {SendRecieveBTNs} from '../../homeLightning/sendReciveBTNs';
import getFormattedHomepageTxsForSpark from '../../../../../functions/combinedTransactionsSpark';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import {INSET_WINDOW_WIDTH} from '../../../../../constants/theme';
import {CENTER, ICONS} from '../../../../../constants';
import {
  getNWCSparkAddress,
  getNWCSparkBalance,
  getNWCSparkIdentityPubKey,
  getNWCSparkTransactions,
  initializeNWCWallet,
  sendNWCSparkLightningPayment,
} from '../../../../../functions/nwc/wallet';
import {useNostrWalletConnect} from '../../../../../../context-store/NWC';
import {useSparkWallet} from '../../../../../../context-store/sparkContext';
import {sparkPaymenWrapper} from '../../../../../functions/spark/payments';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import {useGlobalInsets} from '../../../../../../context-store/insetsProvider';
import {useGlobalContacts} from '../../../../../../context-store/globalContacts';
import {getBolt11InvoiceForContact} from '../../../../../functions/contacts';

export default function NWCWallet(props) {
  const {bottomPadding} = useGlobalInsets();
  const {sparkInformation} = useSparkWallet();
  const {nwcWalletInfo, setNWCWalletInfo} = useNostrWalletConnect();
  const {theme, darkModeType, toggleTheme} = useGlobalThemeContext();
  const {masterInfoObject} = useGlobalContextProvider();
  const {globalContactsInformation} = useGlobalContacts();
  const {isConnectedToTheInternet} = useAppStatus();
  const navigate = useNavigation();
  const currentTime = useUpdateHomepageTransactions();
  const {t} = useTranslation();
  const [isTransfering, setIsTranfering] = useState(false);
  const sendingAmount = props?.route?.params?.amount;
  const sendingType = props?.route?.params?.type;

  const homepageTxPreferance = masterInfoObject.homepageTxPreferance;
  const userBalanceDenomination = masterInfoObject.userBalanceDenomination;

  const updateSparkInformation = useCallback(async () => {
    const response = await initializeNWCWallet();
    if (!response.isConnected) {
      navigate.navigate('ErrorScreen', {errorMessage: response.error});
    } else {
      const [balance, transactions, identityPubKey, sparkAddress] =
        await Promise.all([
          getNWCSparkBalance(),
          getNWCSparkTransactions(),
          getNWCSparkIdentityPubKey(),
          getNWCSparkAddress(),
        ]);
      const storageObject = {
        balance: Number(balance.balance),
        transactions: transactions?.transfers || [],
        identityPubKey,
        sparkAddress: sparkAddress.response,
        didConnect: true,
      };
      setNWCWalletInfo(storageObject);
      await new Promise(res => setTimeout(res, 2000));
    }
  }, [navigate]);

  useEffect(() => {
    updateSparkInformation();
  }, []);

  const flatListDataForSpark = useMemo(() => {
    return getFormattedHomepageTxsForSpark({
      currentTime,
      sparkInformation: nwcWalletInfo,
      homepageTxPreferance,
      navigate,
      frompage: 'sparkWallet',
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
      numberOfCachedTxs: 10,
      didGetToHomepage: true,
    });
  }, [
    nwcWalletInfo,
    homepageTxPreferance,
    navigate,
    currentTime,
    theme,
    darkModeType,
    userBalanceDenomination,
  ]);

  useEffect(() => {
    async function initiatePayment() {
      if (!sendingAmount || !sendingType) return;
      try {
        setIsTranfering(true);

        let address = '';

        if (sendingType === 'send') {
          const invoiceResponse = await getBolt11InvoiceForContact(
            globalContactsInformation.myProfile.uniqueName,
            sendingAmount,
            'Transfer from nostr connect',
            false,
          );
          console.log(invoiceResponse);
          if (!invoiceResponse) {
            navigate.navigate('ErrorScreen', {
              errorMessage:
                'Unable to generate the receiving invoice. Please try again.',
            });
            return;
          }
          address = invoiceResponse;
        } else {
          address = nwcWalletInfo.sparkAddress;
        }

        const fee = await sparkPaymenWrapper({
          getFee: true,
          address,
          paymentType: sendingType === 'send' ? 'lightning' : 'spark',
          amountSats: sendingAmount,
          masterInfoObject,
        });
        if (!fee.didWork) {
          navigate.navigate('ErrorScreen', {errorMessage: fee.error});
          return;
        }
        if (
          (sendingType === 'send'
            ? nwcWalletInfo.balance
            : sparkInformation.balance) <
          sendingAmount + fee.fee
        ) {
          navigate.navigate('ErrorScreen', {
            errorMessage: `Sending amount with fees is greater than your ${
              sendingType === 'send' ? 'nostr connect' : 'main'
            } wallets balance`,
          });
          return;
        }

        let response;

        if (sendingType === 'send') {
          response = await sendNWCSparkLightningPayment({
            invoice: address,
            maxFeeSats: fee.fee,
          });
        } else {
          response = await sparkPaymenWrapper({
            address,
            paymentType: 'spark',
            amountSats: sendingAmount,
            masterInfoObject,
            fee: fee.fee + fee.supportFee,
            memo: 'Transfer to nostr connect',
            userBalance: sparkInformation.balance,
            sparkInformation,
          });
        }

        if (!response.didWork) {
          navigate.navigate('ErrorScreen', {errorMessage: response.error});
          return;
        }
        await new Promise(res => setTimeout(res, 2000));
        await updateSparkInformation();
      } catch (err) {
        console.log('error transfering funds', err);
      } finally {
        setIsTranfering(false);
      }
    }
    initiatePayment();
  }, [sendingAmount, sendingType]);

  return (
    <GlobalThemeView styles={style.globalContainer}>
      <CustomSettingsTopBar
        containerStyles={{width: '95%', ...CENTER}}
        showLeftImage={true}
        leftImageBlue={ICONS.keyIcon}
        LeftImageDarkMode={ICONS.keyIconWhite}
        leftImageFunction={() => {
          navigate.navigate('NWCWalletSetup', {fromWallet: true});
        }}
      />
      {isTransfering ? (
        <FullLoadingScreen text={'Handling transfer'} />
      ) : (
        <View style={{alignItems: 'center'}}>
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
            sparkInformation={nwcWalletInfo}
          />
          <SendRecieveBTNs
            theme={theme}
            darkModeType={darkModeType}
            isConnectedToTheInternet={isConnectedToTheInternet}
            isNWCWallet={true}
          />

          <FlatList
            contentContainerStyle={{
              paddingTop: 70,
              paddingBottom: 60,
            }}
            showsVerticalScrollIndicator={false}
            style={{
              width: '100%',
              marginTop: 10,
              marginBottom: bottomPadding + 100,
            }}
            data={flatListDataForSpark}
            renderItem={({item}) => item}
          />
        </View>
      )}
    </GlobalThemeView>
  );
}

const style = StyleSheet.create({
  globalContainer: {paddintTop: 0},
  balanceContainer: {paddingTop: 0, paddingBottom: 10, alignItems: 'center'},
});
