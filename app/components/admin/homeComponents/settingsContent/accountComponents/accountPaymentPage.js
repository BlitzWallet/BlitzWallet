import { useNavigation } from '@react-navigation/native';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CustomKeyboardAvoidingView,
  GlobalThemeView,
  ThemeText,
} from '../../../../../functions/CustomElements';
import CustomSettingsTopBar from '../../../../../functions/CustomElements/settingsTopBar';
import FullLoadingScreen from '../../../../../functions/CustomElements/loadingScreen';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import FormattedBalanceInput from '../../../../../functions/CustomElements/formattedBalanceInput';
import FormattedSatText from '../../../../../functions/CustomElements/satTextDisplay';
import CustomButton from '../../../../../functions/CustomElements/button';
import {
  CENTER,
  COLORS,
  ICONS,
  SATSPERBITCOIN,
} from '../../../../../constants';
import { useTranslation } from 'react-i18next';
import useDebounce from '../../../../../hooks/useDebounce';
import { useGlobalThemeContext } from '../../../../../../context-store/theme';
import GetThemeColors from '../../../../../hooks/themeColors';
import ThemeImage from '../../../../../functions/CustomElements/themeImage';
import { sparkPaymenWrapper } from '../../../../../functions/spark/payments';
import { useKeysContext } from '../../../../../../context-store/keys';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import {
  getSparkAddress,
  getSparkIdentityPubKey,
} from '../../../../../functions/spark';
import { bulkUpdateSparkTransactions } from '../../../../../functions/spark/transactions';
import CustomSearchInput from '../../../../../functions/CustomElements/searchInput';
import { useWebView } from '../../../../../../context-store/webViewContext';
import { HIDDEN_OPACITY } from '../../../../../constants/theme';
import { updateConfirmAnimation } from '../../../../../functions/lottieViewColorTransformer';
import LottieView from 'lottie-react-native';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
const confirmTxAnimation = require('../../../../../assets/confirmTxAnimation.json');

export default function AccountPaymentPage(props) {
  const { sendWebViewRequest } = useWebView();
  const navigate = useNavigation();
  const { accountMnemoinc } = useKeysContext();
  const { masterInfoObject } = useGlobalContextProvider();
  const { fiatStats } = useNodeContext();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { currentWalletMnemoinc, getAccountMnemonic, custodyAccountsList } =
    useActiveCustodyAccount();
  const sendingAmount = props?.route?.params?.amount || 0;
  const from = props?.route?.params?.from;
  const to = props?.route?.params?.to;
  const fromBalance = props?.route?.params?.fromBalance;
  const prevBalance = useRef(null);
  const [memo, setMemo] = useState('');
  const [isKeyboardFocused, setIsKeyboardFocused] = useState(false);
  const [transferInfo, setTransferInfo] = useState({
    isDoingTransfer: false,
    isCalculatingFee: false,
    paymentFee: 0,
    showConfirmScreen: false,
  });
  const { backgroundOffset, textColor } = GetThemeColors();
  const { t } = useTranslation();

  const fromAccount =
    custodyAccountsList.find(item => item.uuid === from)?.name || '';
  const toAccount =
    custodyAccountsList.find(item => item.uuid === to)?.name || '';

  const convertedSendAmount =
    masterInfoObject.userBalanceDenomination != 'fiat'
      ? Math.round(Number(sendingAmount))
      : Math.round((SATSPERBITCOIN / fiatStats.value) * Number(sendingAmount));

  const confirmAnimation = useMemo(() => {
    return updateConfirmAnimation(
      confirmTxAnimation,
      theme ? (darkModeType ? 'lightsOut' : 'dark') : 'light',
    );
  }, [theme, darkModeType]);

  const debouncedSearch = useDebounce(async () => {
    // Calculate spark payment fee here
    const feeResponse = await sparkPaymenWrapper({
      getFee: true,
      address: process.env.BLITZ_SPARK_SUPPORT_ADDRESSS, //using as a temporary placement to calculate fee
      paymentType: 'spark',
      memo: 'Accounts Swap',
      amountSats: sendingAmount,
      mnemonic: accountMnemoinc,
      sendWebViewRequest,
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
    setTransferInfo(prev => ({ ...prev, isCalculatingFee: true }));
    debouncedSearch();
  }, [sendingAmount, toAccount, fromAccount]);

  const handlePayment = useCallback(async () => {
    try {
      if (!sendingAmount) {
        throw new Error(
          t('settings.accountComponents.accountPaymentPage.noAmountError'),
        );
      }
      if (!fromAccount) {
        throw new Error(
          t('settings.accountComponents.accountPaymentPage.noAccountError'),
        );
      }
      if (!toAccount) {
        throw new Error(
          t('settings.accountComponents.accountPaymentPage.noAccountToError'),
        );
      }
      if (transferInfo.isCalculatingFee) {
        throw new Error(
          t('settings.accountComponents.accountPaymentPage.loadingFeeError'),
        );
      }
      if (transferInfo.isDoingTransfer) {
        throw new Error(
          t(
            'settings.accountComponents.accountPaymentPage.alreadyStartedTransferError',
          ),
        );
      }

      if (convertedSendAmount > transferInfo.paymentFee + fromBalance) {
        throw new Error(
          t('settings.accountComponents.accountPaymentPage.balanceError'),
        );
      }
      setTransferInfo(prev => ({ ...prev, isDoingTransfer: true }));

      const sendingFromAccount = custodyAccountsList.find(
        item => item.uuid === from,
      );
      const sendingToAccount = custodyAccountsList.find(
        item => item.uuid === to,
      );

      const [fromMnemonic, toMnemonic] = await Promise.all([
        getAccountMnemonic(sendingFromAccount),
        getAccountMnemonic(sendingToAccount),
      ]);

      const toSparkAddress = await getSparkAddress(toMnemonic);

      if (!toSparkAddress.didWork) {
        throw new Error(
          t('settings.accountComponents.accountPaymentPage.noSendAddressError'),
        );
      }

      const [accountIdentifyPubKey, toAccountIdentityPubKey] =
        await Promise.all([
          getSparkIdentityPubKey(fromMnemonic),
          getSparkIdentityPubKey(toMnemonic),
        ]);

      if (!accountIdentifyPubKey || !toAccountIdentityPubKey) {
        throw new Error(
          t(
            'settings.accountComponents.accountPaymentPage.noAccountInformation',
          ),
        );
      }

      const sendingResponse = await sparkPaymenWrapper({
        address: toSparkAddress.response,
        paymentType: 'spark',
        amountSats: convertedSendAmount,
        masterInfoObject,
        fee: transferInfo.paymentFee,
        memo:
          memo ||
          t(
            'settings.accountComponents.accountPaymentPage.inputPlaceHolderText',
          ),
        userBalance: fromBalance,
        sparkInformation: {
          identityPubKey: accountIdentifyPubKey,
        },
        mnemonic: fromMnemonic,
        sendWebViewRequest,
      });

      if (!sendingResponse.didWork) {
        throw new Error(t('errormessages.paymentError'));
      }

      await bulkUpdateSparkTransactions([
        {
          ...sendingResponse.response,
          accountId: toAccountIdentityPubKey,
          details: {
            ...sendingResponse.response.details,
            direction: 'INCOMING',
            fee: 0,
          },
        },
      ]);

      setTransferInfo(prev => ({
        ...prev,
        isDoingTransfer: false,
        showConfirmScreen: true,
      }));
    } catch (err) {
      console.log('Swap error', err);
      setTransferInfo(prev => ({ ...prev, isDoingTransfer: false }));
      navigate.navigate('ErrorScreen', { errorMessage: err.message });
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
    memo,
    custodyAccountsList,
  ]);

  if (transferInfo?.showConfirmScreen) {
    return (
      <GlobalThemeView useStandardWidth={true}>
        <View style={styles.animationContainer}>
          <LottieView
            source={confirmAnimation}
            loop={false}
            style={styles.animation}
            autoPlay={true}
          />
        </View>
        <CustomButton
          textContent={t('constants.back')}
          buttonStyles={{
            ...CENTER,
          }}
          actionFunction={navigate.goBack}
        />
      </GlobalThemeView>
    );
  }

  return (
    <CustomKeyboardAvoidingView
      isKeyboardActive={isKeyboardFocused}
      useLocalPadding={true}
      useStandardWidth={true}
      useTouchableWithoutFeedback={true}
    >
      <CustomSettingsTopBar
        label={t('settings.accountComponents.accountPaymentPage.title')}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ width: '100%' }}
        contentContainerStyle={{ paddingBottom: 10 }}
      >
        <ThemeIcon
          styles={{ marginTop: 40, marginBottom: 20, ...CENTER }}
          iconName={'ArrowUpDown'}
        />
        <TouchableOpacity
          onPress={() => {
            navigate.navigate('CustomHalfModal', {
              wantedContent: 'customInputText',
              returnLocation: 'CustodyAccountPaymentPage',
              sliderHight: 0.5,
            });
          }}
        >
          <FormattedBalanceInput
            maxWidth={0.9}
            amountValue={sendingAmount}
            inputDenomination={masterInfoObject.userBalanceDenomination}
          />

          <FormattedSatText
            containerStyles={{
              opacity: !sendingAmount ? HIDDEN_OPACITY : 1,
              marginBottom: 50,
            }}
            neverHideBalance={true}
            styles={{ includeFontPadding: false }}
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
          }}
        >
          <View style={{ flexShrink: 1 }}>
            <View style={styles.transferTextContainer}>
              <ThemeIcon
                size={20}
                styles={styles.transferTextIcon}
                iconName={'Upload'}
              />
              <ThemeText content={t('constants.from')} />
            </View>
            {fromAccount && (
              <ThemeText
                CustomNumberOfLines={1}
                styles={{ opacity: 0.7, flexShrink: 1 }}
                content={fromAccount}
              />
            )}
          </View>
          <TouchableOpacity
            onPress={() => {
              navigate.navigate('CustomHalfModal', {
                wantedContent: 'SelectAltAccount',
                sliderHight: 0.6,
                selectedFrom: from,
                selectedTo: to,
                transferType: 'from',
              });
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginLeft: 10,
            }}
          >
            {fromAccount ? (
              <FormattedSatText
                neverHideBalance={true}
                styles={{ includeFontPadding: false }}
                balance={fromBalance}
              />
            ) : (
              <ThemeText
                styles={{ flexShrink: 1 }}
                CustomNumberOfLines={1}
                content={t(
                  'settings.accountComponents.accountPaymentPage.selectAccount',
                )}
              />
            )}
            <ThemeIcon size={20} iconName={'ChevronRight'} />
          </TouchableOpacity>
        </View>
        <View
          style={{
            ...styles.transferAccountRow,
            borderBottomColor: backgroundOffset,
          }}
        >
          <View style={styles.transferTextContainer}>
            <ThemeIcon
              size={20}
              styles={styles.transferTextIcon}
              iconName={'Download'}
            />
            <ThemeText content={t('constants.to')} />
          </View>
          <TouchableOpacity
            style={styles.chooseAccountBTN}
            onPress={() => {
              navigate.navigate('CustomHalfModal', {
                wantedContent: 'SelectAltAccount',
                sliderHight: 0.6,
                selectedFrom: from,
                selectedTo: to,
                transferType: 'to',
              });
            }}
          >
            <ThemeText
              styles={{ flexShrink: 1 }}
              CustomNumberOfLines={1}
              content={
                toAccount
                  ? toAccount
                  : t(
                      'settings.accountComponents.accountPaymentPage.selectAccount',
                    )
              }
            />
            <ThemeIcon size={20} iconName={'ChevronRight'} />
          </TouchableOpacity>
        </View>
        <View
          style={{
            ...styles.transferAccountRow,
            borderBottomColor: backgroundOffset,
          }}
        >
          <View style={styles.transferTextContainer}>
            <ThemeImage
              styles={{
                ...styles.transferTextIcon,
              }}
              lightModeIcon={ICONS.receiptIcon}
              darkModeIcon={ICONS.receiptIcon}
              lightsOutIcon={ICONS.receiptWhite}
            />
            <ThemeText content={t('constants.fee')} />
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
              styles={{ includeFontPadding: false }}
              balance={transferInfo.paymentFee}
            />
          )}
        </View>
        <View
          style={{
            ...styles.transferAccountRow,
            borderBottomColor: backgroundOffset,
          }}
        >
          <View style={styles.transferTextContainer}>
            <ThemeIcon
              size={20}
              styles={styles.transferTextIcon}
              iconName={'SquarePen'}
            />
            <ThemeText content={t('constants.description')} />
          </View>
          <CustomSearchInput
            inputText={memo}
            setInputText={setMemo}
            containerStyles={styles.textInputContainerStyles}
            textInputStyles={{ ...styles.textInputStyles, color: textColor }}
            placeholderText={t(
              'settings.accountComponents.accountPaymentPage.inputPlaceHolderText',
            )}
            onFocusFunction={() => setIsKeyboardFocused(true)}
            onBlurFunction={() => setIsKeyboardFocused(false)}
            maxLength={80}
          />
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
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  transferTextContainer: { flexDirection: 'row', alignItems: 'center' },
  transferTextIcon: {
    width: 20,
    height: 20,
    marginRight: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  animationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  animation: {
    width: 250,
    height: 250,
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
    flexShrink: 1,
  },
  textInputContainerStyles: {
    flexShrink: 1,
    width: '100%',
    marginLeft: 10,
  },
  textInputStyles: {
    backgroundColor: 'transparent',
    textAlign: 'right',
    alignItems: 'flex-end',
    width: '100%',
    padding: 0,
  },
});
