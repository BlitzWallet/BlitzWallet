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
  CONTENT_KEYBOARD_OFFSET,
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
import {
  FONT,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
  SIZES,
} from '../../../../../constants/theme';
import { updateConfirmAnimation } from '../../../../../functions/lottieViewColorTransformer';
import LottieView from 'lottie-react-native';
import ThemeIcon from '../../../../../functions/CustomElements/themeIcon';
import SectionCard from '../../../../../screens/inAccount/settingsHub/components/SectionCard';
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
  const { backgroundColor, textColor } = GetThemeColors();
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

  const canDoTransfer =
    sendingAmount &&
    fromAccount &&
    toAccount &&
    !transferInfo.isCalculatingFee &&
    !transferInfo.isDoingTransfer &&
    convertedSendAmount > transferInfo.paymentFee + fromBalance;

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
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero Amount Card */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            navigate.navigate('CustomHalfModal', {
              wantedContent: 'customInputText',
              returnLocation: 'CustodyAccountPaymentPage',
              sliderHight: 0.5,
            });
          }}
          style={[styles.heroCard]}
        >
          <FormattedBalanceInput
            maxWidth={0.85}
            amountValue={sendingAmount}
            inputDenomination={masterInfoObject.userBalanceDenomination}
          />
          <FormattedSatText
            containerStyles={{
              opacity: !sendingAmount ? HIDDEN_OPACITY : 1,
              marginTop: 4,
            }}
            neverHideBalance={true}
            styles={{
              includeFontPadding: false,
              fontSize: SIZES.smedium,
            }}
            globalBalanceDenomination={
              masterInfoObject.userBalanceDenomination === 'sats' ||
              masterInfoObject.userBalanceDenomination === 'hidden'
                ? 'fiat'
                : 'sats'
            }
            balance={convertedSendAmount}
          />
        </TouchableOpacity>

        {/* Transfer Card (From / To) */}
        <SectionCard title={t('constants.transfer').toUpperCase()}>
          {/* From row */}
          <TouchableOpacity
            activeOpacity={0.5}
            onPress={() => {
              navigate.navigate('CustomHalfModal', {
                wantedContent: 'SelectAltAccount',
                sliderHight: 0.6,
                selectedFrom: from,
                selectedTo: to,
                transferType: 'from',
              });
            }}
            style={[
              styles.transferRow,
              {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: backgroundColor,
              },
            ]}
          >
            <ThemeIcon iconName={'Upload'} size={20} />
            <View style={styles.rowLabelContainer}>
              <ThemeText
                CustomNumberOfLines={1}
                styles={styles.rowLabelInner}
                content={t('constants.from')}
              />
              {fromAccount ? (
                <ThemeText
                  CustomNumberOfLines={1}
                  styles={styles.rowSubLabel}
                  content={fromAccount}
                />
              ) : null}
            </View>
            {fromAccount ? (
              <FormattedSatText
                neverHideBalance={true}
                styles={styles.rowInlineValue}
                balance={fromBalance}
              />
            ) : (
              <ThemeText
                CustomNumberOfLines={1}
                styles={styles.rowInlineValue}
                content={t(
                  'settings.accountComponents.accountPaymentPage.selectAccount',
                )}
              />
            )}
            <ThemeIcon size={18} iconName={'ChevronRight'} />
          </TouchableOpacity>

          {/* Directional arrow divider */}
          <View style={styles.arrowDivider}>
            <ThemeIcon iconName={'ArrowDown'} size={16} />
          </View>

          {/* To row */}
          <TouchableOpacity
            activeOpacity={0.5}
            onPress={() => {
              navigate.navigate('CustomHalfModal', {
                wantedContent: 'SelectAltAccount',
                sliderHight: 0.6,
                selectedFrom: from,
                selectedTo: to,
                transferType: 'to',
              });
            }}
            style={styles.transferRow}
          >
            <ThemeIcon iconName={'Download'} size={20} />
            <ThemeText
              CustomNumberOfLines={1}
              styles={styles.rowLabel}
              content={t('constants.to')}
            />
            <ThemeText
              CustomNumberOfLines={1}
              styles={[styles.rowInlineValue, { flexShrink: 1 }]}
              content={
                toAccount
                  ? toAccount
                  : t(
                      'settings.accountComponents.accountPaymentPage.selectAccount',
                    )
              }
            />
            <ThemeIcon size={18} iconName={'ChevronRight'} />
          </TouchableOpacity>
        </SectionCard>

        {/* Details Card (Fee / Description) */}
        <SectionCard title={t('constants.details').toUpperCase()}>
          {/* Fee row — non-interactive */}
          <View
            style={[
              styles.transferRow,
              {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: backgroundColor,
              },
            ]}
          >
            <ThemeImage
              styles={styles.receiptIcon}
              lightModeIcon={ICONS.receiptIcon}
              darkModeIcon={ICONS.receiptIcon}
              lightsOutIcon={ICONS.receiptWhite}
            />
            <ThemeText
              CustomNumberOfLines={1}
              styles={styles.rowLabel}
              content={t('constants.fee')}
            />
            {transferInfo.isCalculatingFee ? (
              <FullLoadingScreen
                containerStyles={{ flex: 0 }}
                size="small"
                showText={false}
                loadingColor={theme ? textColor : COLORS.primary}
              />
            ) : (
              <FormattedSatText
                neverHideBalance={true}
                styles={{
                  includeFontPadding: false,
                  fontSize: SIZES.small,
                }}
                balance={transferInfo.paymentFee}
              />
            )}
          </View>

          {/* Description row — editable */}
          <View style={styles.descriptionRow}>
            <ThemeIcon size={20} iconName={'SquarePen'} />
            <CustomSearchInput
              inputText={memo}
              setInputText={setMemo}
              containerStyles={styles.descriptionContainer}
              textInputStyles={{ ...styles.descriptionInput, color: textColor }}
              placeholderText={t(
                'settings.accountComponents.accountPaymentPage.inputPlaceHolderText',
              )}
              onFocusFunction={() => setIsKeyboardFocused(true)}
              onBlurFunction={() => setIsKeyboardFocused(false)}
              maxLength={80}
            />
          </View>
        </SectionCard>
      </ScrollView>

      <CustomButton
        textContent={t('constants.confirm')}
        buttonStyles={{
          ...CENTER,
          marginTop: CONTENT_KEYBOARD_OFFSET,
          opacity: canDoTransfer ? 1 : HIDDEN_OPACITY,
        }}
        useLoading={transferInfo.isDoingTransfer}
        actionFunction={handlePayment}
      />
    </CustomKeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    width: INSET_WINDOW_WIDTH,
    ...CENTER,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 25,
  },
  heroCard: {
    borderRadius: 16,
    paddingVertical: 24,
    alignItems: 'center',
    marginTop: 20,
  },
  transferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  rowLabelContainer: {
    flex: 1,
    marginLeft: 12,
  },
  rowLabel: {
    flex: 1,
    fontSize: SIZES.medium,
    marginLeft: 12,
    includeFontPadding: false,
  },
  rowLabelInner: {
    fontSize: SIZES.medium,
    includeFontPadding: false,
  },
  rowSubLabel: {
    fontSize: SIZES.small,
    opacity: 0.6,
    includeFontPadding: false,
    marginTop: 2,
  },
  rowInlineValue: {
    fontSize: SIZES.small,
    opacity: 0.5,
    marginRight: 8,
    includeFontPadding: false,
  },
  arrowDivider: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  receiptIcon: {
    width: 20,
    height: 20,
  },
  descriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  descriptionContainer: {
    flex: 1,
    marginLeft: 12,
    width: 'auto',
  },
  descriptionInput: {
    backgroundColor: 'transparent',
    padding: 0,
    fontSize: SIZES.medium,
  },
  summaryContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: SIZES.small,
    opacity: 0.5,
    includeFontPadding: false,
  },
  summaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  summaryTotal: {
    fontSize: SIZES.medium,
    fontFamily: FONT.Title_Medium,
    includeFontPadding: false,
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
});
