import {useNavigation} from '@react-navigation/native';
import {useGlobalContextProvider} from '../../../../../../context-store/context';
import {useNodeContext} from '../../../../../../context-store/nodeContext';
import {useCallback, useEffect, useRef, useState} from 'react';
import {
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import {ScrollView, StyleSheet, TouchableOpacity, View} from 'react-native';
import FormattedBalanceInput from '../../../../../functions/CustomElements/formattedBalanceInput';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import CustomButton from '../../../../../functions/CustomElements/button';
import {CENTER, COLORS, ICONS, SATSPERBITCOIN} from '../../../../../constants';
import {useTranslation} from 'react-i18next';
import useDebounce from '../../../../../hooks/useDebounce';
import {useGlobalThemeContext} from '../../../../../../context-store/theme';
import GetThemeColors from '../../../../../hooks/themeColors';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import useCustodyAccountList from '../../../../../hooks/useCustodyAccountsList';
import {sparkPaymenWrapper} from '../../../../../functions/spark/payments';
import {useKeysContext} from '../../../../../../context-store/keys';
import {useActiveCustodyAccount} from '../../../../../../context-store/activeAccount';
import {
  getSparkAddress,
  getSparkIdentityPubKey,
} from '../../../../../functions/spark';

export default function AccountPaymentPage(props) {
  const navigate = useNavigation();
  const {accountMnemoinc} = useKeysContext();
  const {masterInfoObject} = useGlobalContextProvider();
  const {nodeInformation} = useNodeContext();
  const {theme} = useGlobalThemeContext();
  const {textColor} = GetThemeColors();
  const {currentWalletMnemoinc} = useActiveCustodyAccount();
  const sendingAmount = props?.route?.params?.amount || 0;
  const from = props?.route?.params?.from;
  const to = props?.route?.params?.to;
  const fromBalance = props?.route?.params?.fromBalance;
  const prevBalance = useRef(null);

  const [transferInfo, setTransferInfo] = useState({
    isDoingTransfer: false,
    isCalculatingFee: false,
    paymentFee: 0,
  });
  const {backgroundOffset} = GetThemeColors();
  const {t} = useTranslation();

  const accounts = useCustodyAccountList();
  const fromAccount = accounts.find(item => item.mnemoinc === from)?.name || '';
  const toAccount = accounts.find(item => item.mnemoinc === to)?.name || '';

  const convertedSendAmount =
    masterInfoObject.userBalanceDenomination != 'fiat'
      ? Math.round(Number(sendingAmount))
      : Math.round(
          (SATSPERBITCOIN / nodeInformation?.fiatStats?.value) *
            Number(sendingAmount),
        );

  const debouncedSearch = useDebounce(async () => {
    // Calculate spark payment fee here
    const feeResponse = await sparkPaymenWrapper({
      getFee: true,
      address: process.env.BLITZ_SPARK_SUPPORT_ADDRESSS, //using as a temporary placement to calculate fee
      paymentType: 'spark',
      memo: 'Accounts Swap',
      amountSats: sendingAmount,
      mnemonic: accountMnemoinc,
    });

    if (!feeResponse?.didWork) return;
    setTransferInfo(prev => ({
      ...prev,
      isCalculatingFee: false,
      paymentFee: feeResponse.supportFee + feeResponse.fee,
    }));
  }, 800);

  useEffect(() => {
    if (!sendingAmount) return;
    if (prevBalance.current === sendingAmount) return;
    prevBalance.current = sendingAmount;
    setTransferInfo(prev => ({...prev, isCalculatingFee: true}));
    debouncedSearch();
  }, [sendingAmount, toAccount, fromAccount]);

  const handlePayment = useCallback(async () => {
    try {
      if (!sendingAmount) {
        throw new Error('Please enter an amount to be swapped');
      }
      if (!fromAccount) {
        throw new Error(
          'Please select an account for funds to be swapped from',
        );
      }
      if (!toAccount) {
        throw new Error('Please select an account for funds to be swapped to');
      }
      if (transferInfo.isCalculatingFee) {
        throw new Error('Cannot start swap when fee is being calculated');
      }
      if (transferInfo.isDoingTransfer) {
        throw new Error('A transfer has already been started');
      }

      if (convertedSendAmount > transferInfo.paymentFee + fromBalance) {
        throw new Error('Sending amount is greater than your balance and fees');
      }
      setTransferInfo(prev => ({...prev, isDoingTransfer: true}));

      const toSparkAddress = await getSparkAddress(to);

      if (!toSparkAddress.didWork) {
        throw new Error('Not able to get send address');
      }

      const accountIdentifyPubKey = await getSparkIdentityPubKey(from);

      if (!accountIdentifyPubKey) {
        throw new Error('Not able to get account information');
      }

      const sendingResponse = await sparkPaymenWrapper({
        address: toSparkAddress.response,
        paymentType: 'spark',
        amountSats: convertedSendAmount,
        masterInfoObject,
        fee: transferInfo.paymentFee,
        memo: 'Accounts Swap',
        userBalance: fromBalance,
        sparkInformation: {
          identityPubKey: accountIdentifyPubKey,
        },
        mnemonic: from,
      });

      if (!sendingResponse.didWork) {
        throw new Error(sendingResponse.error);
      }

      if (currentWalletMnemoinc === to) {
        // Confirm response will be handled by current listeners
        return;
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          navigate.reset({
            index: 0, // The top-level route index
            routes: [
              {
                name: 'HomeAdmin', // Navigate to HomeAdmin
                params: {
                  screen: 'Home',
                },
              },
              {
                name: 'ConfirmTxPage',
                params: {
                  transaction: sendingResponse.response,
                },
              },
            ],
          });
        });
      });
      setTransferInfo(prev => ({...prev, isDoingTransfer: false}));
      //   Navigat to half modal here
    } catch (err) {
      console.log('Swap error', err);
      setTransferInfo(prev => ({...prev, isDoingTransfer: false}));
      navigate.navigate('ErrorScreen', {errorMessage: err.message});
    }
  }, [
    sendingAmount,
    fromAccount,
    toAccount,
    transferInfo,
    fromBalance,
    convertedSendAmount,
    to,
    from,
    currentWalletMnemoinc,
  ]);

  return (
    <GlobalThemeView useStandardWidth={true}>
      <CustomSettingsTopBar label={'Swap'} />

      <ScrollView style={{width: '100%', flex: 1}}>
        <ThemeImage
          styles={{
            transform: [{rotate: '90deg'}],
            ...CENTER,
            marginTop: 30,
            marginBottom: 30,
          }}
          lightModeIcon={ICONS.exchangeIcon}
          darkModeIcon={ICONS.exchangeIcon}
          lightsOutIcon={ICONS.exchangeIconWhite}
        />
        <TouchableOpacity
          onPress={() => {
            navigate.navigate('CustomHalfModal', {
              wantedContent: 'customInputText',
              returnLocation: 'CustodyAccountPaymentPage',
              sliderHight: 0.5,
            });
          }}>
          <FormattedBalanceInput
            maxWidth={0.9}
            amountValue={sendingAmount}
            inputDenomination={masterInfoObject.userBalanceDenomination}
          />

          <FormattedSatText
            containerStyles={{
              opacity: !sendingAmount ? 0.5 : 1,
              marginBottom: 50,
            }}
            neverHideBalance={true}
            styles={{includeFontPadding: false}}
            globalBalanceDenomination={
              masterInfoObject.userBalanceDenomination === 'sats' ||
              masterInfoObject.userBalanceDenomination === 'hidden'
                ? 'fiat'
                : 'sats'
            }
            balance={convertedSendAmount}
          />
        </TouchableOpacity>

        <View
          style={{
            ...styles.transferAccountRow,
            borderBottomColor: backgroundOffset,
          }}>
          <View>
            <View style={styles.transferTextContainer}>
              <ThemeImage
                styles={{
                  ...styles.transferTextIcon,
                  transform: [{rotate: '-90deg'}],
                }}
                lightModeIcon={ICONS.arrowFromRight}
                darkModeIcon={ICONS.arrowFromRight}
                lightsOutIcon={ICONS.arrowFromRightWhite}
              />
              <ThemeText content={'From'} />
            </View>
            {fromAccount && (
              <ThemeText styles={{opacity: 0.7}} content={fromAccount} />
            )}
          </View>
          <TouchableOpacity
            onPress={() => {
              navigate.navigate('CustomHalfModal', {
                wantedContent: 'SelectAltAccount',
                sliderHight: 0.5,
                selectedFrom: from,
                selectedTo: to,
                transferType: 'from',
              });
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginLeft: 10,
              flexShrink: 1,
            }}>
            {fromAccount ? (
              <FormattedSatText
                neverHideBalance={true}
                styles={{includeFontPadding: false}}
                balance={fromBalance}
              />
            ) : (
              <ThemeText content={'Select Account'} />
            )}
            <ThemeImage
              styles={{
                width: 20,
                height: 20,
                transform: [{rotate: '180deg'}],
              }}
              lightModeIcon={ICONS.leftCheveronIcon}
              darkModeIcon={ICONS.leftCheveronIcon}
              lightsOutIcon={ICONS.leftCheveronLight}
            />
          </TouchableOpacity>
        </View>
        <View
          style={{
            ...styles.transferAccountRow,
            borderBottomColor: backgroundOffset,
          }}>
          <View style={styles.transferTextContainer}>
            <ThemeImage
              styles={{
                ...styles.transferTextIcon,
                transform: [{rotate: '90deg'}],
              }}
              lightModeIcon={ICONS.arrowToRight}
              darkModeIcon={ICONS.arrowToRight}
              lightsOutIcon={ICONS.arrowToRightLight}
            />
            <ThemeText content={'To'} />
          </View>
          <TouchableOpacity
            style={styles.chooseAccountBTN}
            onPress={() => {
              navigate.navigate('CustomHalfModal', {
                wantedContent: 'SelectAltAccount',
                sliderHight: 0.5,
                selectedFrom: from,
                selectedTo: to,
                transferType: 'to',
              });
            }}>
            <ThemeText content={toAccount ? toAccount : 'Select Account'} />
            <ThemeImage
              styles={{
                width: 20,
                height: 20,
                transform: [{rotate: '180deg'}],
              }}
              lightModeIcon={ICONS.leftCheveronIcon}
              darkModeIcon={ICONS.leftCheveronIcon}
              lightsOutIcon={ICONS.leftCheveronLight}
            />
          </TouchableOpacity>
        </View>
        <View
          style={{
            ...styles.transferAccountRow,
            borderBottomColor: backgroundOffset,
          }}>
          <View style={styles.transferTextContainer}>
            <ThemeImage
              styles={{
                ...styles.transferTextIcon,
              }}
              lightModeIcon={ICONS.receiptIcon}
              darkModeIcon={ICONS.receiptIcon}
              lightsOutIcon={ICONS.receiptWhite}
            />
            <ThemeText content={'Fee'} />
          </View>

          {transferInfo.isCalculatingFee ? (
            <FullLoadingScreen
              containerStyles={{
                flex: 0,
              }}
              size="small"
              showText={false}
              loadingColor={theme ? textColor : COLORS.primary}
            />
          ) : (
            <FormattedSatText
              neverHideBalance={true}
              styles={{includeFontPadding: false}}
              balance={transferInfo.paymentFee}
            />
          )}
        </View>
      </ScrollView>

      <CustomButton
        textContent={t('constants.confirm')}
        buttonStyles={{
          ...CENTER,
        }}
        useLoading={transferInfo.isDoingTransfer}
        actionFunction={handlePayment}
      />
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  transferTextContainer: {flexDirection: 'row', alignItems: 'center'},
  transferTextIcon: {
    width: 20,
    height: 20,
    marginRight: 5,
  },
  transferAccountRow: {
    width: '90%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    alignItems: 'center',
    ...CENTER,
    borderBottomWidth: 1,
    paddingBottom: 10,
  },
  chooseAccountBTN: {
    flexDirection: 'row',
    alignItems: 'center',
    includeFontPadding: false,
  },
});
