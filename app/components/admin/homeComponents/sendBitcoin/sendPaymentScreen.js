import { StyleSheet, View, TouchableOpacity, ScrollView } from 'react-native';
import {
  CENTER,
  ICONS,
  QUICK_PAY_STORAGE_KEY,
  SATSPERBITCOIN,
} from '../../../../constants';
import { useEffect, useRef, useState } from 'react';
import { useGlobalContextProvider } from '../../../../../context-store/context';
import {
  CustomKeyboardAvoidingView,
  GlobalThemeView,
} from '../../../../functions/CustomElements';
import SendTransactionFeeInfo from './components/feeInfo';
import decodeSendAddress from './functions/decodeSendAdress';
import { useNavigation } from '@react-navigation/native';
// import {useWebView} from '../../../../../context-store/webViewContext';
import GetThemeColors from '../../../../hooks/themeColors';
import FormattedSatText from '../../../../functions/CustomElements/satTextDisplay';
import CustomSearchInput from '../../../../functions/CustomElements/searchInput';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import AcceptButtonSendPage from './components/acceptButton';
import NumberInputSendPage from './components/numberInput';
import SendMaxComponent from './components/sendMaxComponent';
import FormattedBalanceInput from '../../../../functions/CustomElements/formattedBalanceInput';
import { useGlobalThemeContext } from '../../../../../context-store/theme';
import { useNodeContext } from '../../../../../context-store/nodeContext';
import { useAppStatus } from '../../../../../context-store/appStatus';
import hasAlredyPaidInvoice from './functions/hasPaid';
import useHandleBackPressNew from '../../../../hooks/useHandleBackPressNew';
import { keyboardGoBack } from '../../../../functions/customNavigation';
import ErrorWithPayment from './components/errorScreen';
import SwipeButtonNew from '../../../../functions/CustomElements/sliderButton';
import { crashlyticsLogReport } from '../../../../functions/crashlyticsLogs';
import { useSparkWallet } from '../../../../../context-store/sparkContext';
import { sparkPaymenWrapper } from '../../../../functions/spark/payments';
import InvoiceInfo from './components/invoiceInfo';
import formatSparkPaymentAddress from './functions/formatSparkPaymentAddress';
import SelectLRC20Token from './components/selectLRC20Token';
import { useActiveCustodyAccount } from '../../../../../context-store/activeAccount';
import formatTokensNumber from '../../../../functions/lrc20/formatTokensBalance';
import { useTranslation } from 'react-i18next';
import {
  COLORS,
  HIDDEN_OPACITY,
  INSET_WINDOW_WIDTH,
} from '../../../../constants/theme';
import { SliderProgressAnimation } from '../../../../functions/CustomElements/sendPaymentAnimation';
import { InputTypes } from 'bitcoin-address-parser';
import CustomSettingsTopBar from '../../../../functions/CustomElements/settingsTopBar';
import { useWebView } from '../../../../../context-store/webViewContext';
import NavBarWithBalance from '../../../../functions/CustomElements/navWithBalance';

export default function SendPaymentScreen(props) {
  const { sendWebViewRequest } = useWebView();
  console.log('CONFIRM SEND PAYMENT SCREEN');
  const [showProgressAnimation, setShowProgressAnimation] = useState(false);
  const progressAnimationRef = useRef(null);
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { screenDimensions } = useAppStatus();
  const navigate = useNavigation();
  const {
    btcAdress,
    fromPage,
    publishMessageFunc,
    comingFromAccept,
    enteredPaymentInfo = {},
    errorMessage,
    contactInfo,
  } = props.route.params;
  const useAltLayout = screenDimensions.height < 720;
  const { t } = useTranslation();
  const { sparkInformation, tokensImageCache, showTokensInformation } =
    useSparkWallet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { liquidNodeInformation, fiatStats } = useNodeContext();
  // const {minMaxLiquidSwapAmounts} = useAppStatus();
  const { theme, darkModeType } = useGlobalThemeContext();
  const { textColor, backgroundOffset, backgroundColor } = GetThemeColors();
  // const {webViewRef} = useWebView();

  const [isAmountFocused, setIsAmountFocused] = useState(true);
  const [paymentInfo, setPaymentInfo] = useState({});
  const isSendingPayment = useRef(null);
  const [paymentDescription, setPaymentDescription] = useState('');
  const [loadingMessage, setLoadingMessage] = useState(
    sparkInformation.didConnect
      ? t('wallet.sendPages.sendPaymentScreen.initialLoadingMessage')
      : t('wallet.sendPages.sendPaymentScreen.connectToSparkMessage'),
  );
  const [masterTokenInfo, setMasterTokenInfo] = useState({});
  const [refreshDecode, setRefreshDecode] = useState(0);

  const sendingAmount = paymentInfo?.sendAmount || 0;
  const isBTCdenominated =
    masterInfoObject.userBalanceDenomination === 'hidden' ||
    masterInfoObject.userBalanceDenomination === 'sats';
  const canEditPaymentAmount = paymentInfo?.canEditPayment;
  const enabledLRC20 = showTokensInformation;
  const selectedLRC20Asset = masterTokenInfo?.tokenName || 'Bitcoin';
  const seletctedToken = masterTokenInfo?.details || {};
  const isUsingLRC20 = selectedLRC20Asset !== 'Bitcoin';

  const paramsRef = useRef({
    btcAdress,
  });

  useEffect(() => {
    const currentParams = {
      btcAdress,
    };
    const prevParams = paramsRef.current;

    const hasParamsChanged =
      currentParams.btcAdress &&
      currentParams.btcAdress !== prevParams.btcAdress;

    if (hasParamsChanged) {
      setIsAmountFocused(true);
      setPaymentInfo({});
      isSendingPayment.current = null;
      setPaymentDescription('');
      setLoadingMessage(
        sparkInformation.didConnect
          ? t('wallet.sendPages.sendPaymentScreen.initialLoadingMessage')
          : t('wallet.sendPages.sendPaymentScreen.connectToSparkMessage'),
      );
      setShowProgressAnimation(false);
      setMasterTokenInfo({});
      setRefreshDecode(x => x + 1);
      paramsRef.current = currentParams;
    }
  }, [btcAdress, sparkInformation.didConnect, t]);

  const convertedSendAmount = !isUsingLRC20
    ? isBTCdenominated
      ? Math.round(Number(sendingAmount))
      : Math.round((SATSPERBITCOIN / fiatStats?.value) * Number(sendingAmount))
    : Number(sendingAmount);

  const isLightningPayment = paymentInfo?.paymentNetwork === 'lightning';
  const isLiquidPayment = paymentInfo?.paymentNetwork === 'liquid';
  const isBitcoinPayment = paymentInfo?.paymentNetwork === 'Bitcoin';
  const isSparkPayment = paymentInfo?.paymentNetwork === 'spark';
  const isLNURLPayment = paymentInfo?.type === InputTypes.LNURL_PAY;
  const minLNURLSatAmount = isLNURLPayment
    ? paymentInfo?.data?.minSendable / 1000
    : 0;
  const maxLNURLSatAmount = isLNURLPayment
    ? paymentInfo?.data?.maxSendable / 1000
    : 0;

  console.log(minLNURLSatAmount, maxLNURLSatAmount, selectedLRC20Asset);

  const paymentFee =
    (paymentInfo?.paymentFee || 0) + (paymentInfo?.supportFee || 0);
  const canSendPayment = !isUsingLRC20
    ? Number(sparkInformation.balance) >=
        Number(convertedSendAmount) + paymentFee && sendingAmount != 0
    : sparkInformation.balance >= paymentFee &&
      sendingAmount != 0 &&
      seletctedToken.balance >=
        sendingAmount * 10 ** seletctedToken?.tokenMetadata?.decimals;
  console.log(
    canSendPayment,
    'can send payment',
    sparkInformation.balance,
    sendingAmount,
    paymentFee,
    sendingAmount,
    paymentInfo,
    enteredPaymentInfo,
  );

  useHandleBackPressNew(goBackFunction);

  useEffect(() => {
    async function decodePayment() {
      crashlyticsLogReport('Starting decode address');
      await decodeSendAddress({
        fiatStats,
        btcAdress,
        goBackFunction: errorMessageNavigation,
        setPaymentInfo,
        liquidNodeInformation,
        masterInfoObject,
        // setWebViewArgs,
        // webViewRef,
        navigate,
        // maxZeroConf:
        //   minMaxLiquidSwapAmounts?.submarineSwapStats?.limits?.maximalZeroConf,
        comingFromAccept,
        enteredPaymentInfo,
        setLoadingMessage,
        paymentInfo,
        fromPage,
        publishMessageFunc,
        sparkInformation,
        seletctedToken,
        currentWalletMnemoinc,
        t,
        sendWebViewRequest,
        contactInfo,
      });
    }
    if (!sparkInformation.didConnect) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        decodePayment();
      });
    });
  }, [sparkInformation.didConnect, refreshDecode]);

  useEffect(() => {
    if (!sparkInformation.didConnect) return;
    if (!Object.keys(paymentInfo).length) return;
    if (!masterInfoObject[QUICK_PAY_STORAGE_KEY].isFastPayEnabled) return;
    if (!canSendPayment) return;
    if (canEditPaymentAmount) return;
    if (
      !(
        masterInfoObject[QUICK_PAY_STORAGE_KEY].fastPayThresholdSats >=
        convertedSendAmount
      )
    )
      return;

    setTimeout(() => {
      sendPayment();
    }, 150);
  }, [paymentInfo, canEditPaymentAmount, sparkInformation.didConnect]);

  // useEffect(() => {
  //   // unmounting started websocket if it exists
  //   const unsubscribe = navigate.addListener('beforeRemove', () => {
  //     console.log('Really leaving the screen, closing websocket');
  //     if (paymentInfo?.websocket?.readyState === WebSocket.OPEN) {
  //       paymentInfo.websocket.close();
  //     }
  //   });

  //   return unsubscribe;
  // }, [navigate, paymentInfo]);

  if (
    (!Object.keys(paymentInfo).length && !errorMessage) ||
    !sparkInformation.didConnect
  )
    return (
      <GlobalThemeView useStandardWidth={true}>
        <CustomSettingsTopBar />
        <FullLoadingScreen text={loadingMessage} />
      </GlobalThemeView>
    );

  if (errorMessage) {
    return <ErrorWithPayment reason={errorMessage} />;
  }

  if (
    enabledLRC20 &&
    !Object.keys(seletctedToken).length &&
    paymentInfo.type === 'spark'
  ) {
    return (
      <SelectLRC20Token
        sparkInformation={sparkInformation}
        seletctedToken={seletctedToken}
        goBackFunction={goBackFunction}
        setSelectedToken={setMasterTokenInfo}
        tokensImageCache={tokensImageCache}
      />
    );
  }

  const clearSettings = () => {
    setPaymentInfo(prev => ({ ...prev, canEditPayment: true, sendAmount: '' }));
    setMasterTokenInfo({});
  };

  const handleBackpress = () => {
    enabledLRC20 &&
    Object.keys(seletctedToken).length &&
    paymentInfo.type === 'spark'
      ? clearSettings()
      : goBackFunction();
  };

  return (
    <CustomKeyboardAvoidingView
      useLocalPadding={true}
      isKeyboardActive={!isAmountFocused}
      useStandardWidth={true}
    >
      <NavBarWithBalance
        seletctedToken={seletctedToken}
        selectedLRC20Asset={selectedLRC20Asset}
        backFunction={handleBackpress}
      />

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 10,
        }}
      >
        <FormattedBalanceInput
          maxWidth={0.9}
          amountValue={sendingAmount}
          inputDenomination={masterInfoObject.userBalanceDenomination}
          activeOpacity={!sendingAmount ? 0.5 : 1}
          customCurrencyCode={
            isUsingLRC20 ? seletctedToken?.tokenMetadata?.tokenTicker : ''
          }
        />

        {/* {isUsingLRC20 && (
          <FormattedSatText
            neverHideBalance={true}
            containerStyles={{opacity: !sendingAmount ? 0.5 : 1}}
            styles={{includeFontPadding: false, ...styles.satValue}}
            customLabel={seletctedToken?.tokenMetadata?.tokenTicker}
            useCustomLabel={true}
            balance={formatTokensNumber(
              convertedSendAmount,
              seletctedToken?.tokenMetadata?.decimals,
            )}
          />
        )} */}
        {!isUsingLRC20 && (
          <FormattedSatText
            containerStyles={{ opacity: !sendingAmount ? HIDDEN_OPACITY : 1 }}
            neverHideBalance={true}
            styles={{ includeFontPadding: false, ...styles.satValue }}
            globalBalanceDenomination={
              masterInfoObject.userBalanceDenomination === 'sats' ||
              masterInfoObject.userBalanceDenomination === 'hidden'
                ? 'fiat'
                : 'sats'
            }
            balance={convertedSendAmount}
          />
        )}

        {!canEditPaymentAmount && (
          <SendTransactionFeeInfo
            paymentFee={paymentFee}
            isLightningPayment={isLightningPayment}
            isLiquidPayment={isLiquidPayment}
            isBitcoinPayment={isBitcoinPayment}
            isSparkPayment={isSparkPayment}
          />
        )}
        {!canEditPaymentAmount && (
          <InvoiceInfo
            paymentInfo={paymentInfo}
            contactInfo={contactInfo}
            fromPage={fromPage}
            theme={theme}
            darkModeType={darkModeType}
          />
        )}
      </ScrollView>
      {canEditPaymentAmount && (
        <>
          {!useAltLayout && (
            <SendMaxComponent
              fiatStats={fiatStats}
              sparkInformation={sparkInformation}
              paymentInfo={paymentInfo}
              setPaymentInfo={setPaymentInfo}
              masterInfoObject={masterInfoObject}
              paymentFee={paymentFee}
              paymentType={paymentInfo?.paymentNetwork}
              // minMaxLiquidSwapAmounts={minMaxLiquidSwapAmounts}
              selectedLRC20Asset={selectedLRC20Asset}
              seletctedToken={seletctedToken}
              useAltLayout={useAltLayout}
            />
          )}
          <CustomSearchInput
            onFocusFunction={() => setIsAmountFocused(false)}
            onBlurFunction={() => setIsAmountFocused(true)}
            placeholderText={t(
              'wallet.sendPages.sendPaymentScreen.descriptionPlaceholder',
            )}
            setInputText={setPaymentDescription}
            inputText={paymentDescription}
            textInputMultiline={true}
            textAlignVertical={'baseline'}
            textInputStyles={{
              borderRadius: useAltLayout ? 15 : 8,
              height: useAltLayout ? 50 : 'unset',
            }}
            maxLength={paymentInfo?.data?.commentAllowed || 150}
            containerStyles={{
              width: INSET_WINDOW_WIDTH,
            }}
          />

          {useAltLayout && (
            <View style={styles.maxAndAcceptContainer}>
              <SendMaxComponent
                fiatStats={fiatStats}
                sparkInformation={sparkInformation}
                paymentInfo={paymentInfo}
                setPaymentInfo={setPaymentInfo}
                masterInfoObject={masterInfoObject}
                paymentFee={paymentFee}
                paymentType={paymentInfo?.paymentNetwork}
                // minMaxLiquidSwapAmounts={minMaxLiquidSwapAmounts}
                selectedLRC20Asset={selectedLRC20Asset}
                seletctedToken={seletctedToken}
                useAltLayout={useAltLayout}
              />

              <AcceptButtonSendPage
                isLiquidPayment={isLiquidPayment}
                canSendPayment={canSendPayment}
                decodeSendAddress={decodeSendAddress}
                errorMessageNavigation={errorMessageNavigation}
                btcAdress={btcAdress}
                paymentInfo={paymentInfo}
                convertedSendAmount={convertedSendAmount}
                paymentDescription={paymentDescription}
                setPaymentInfo={setPaymentInfo}
                setLoadingMessage={setLoadingMessage}
                fromPage={fromPage}
                publishMessageFunc={publishMessageFunc}
                // webViewRef={webViewRef}
                minLNURLSatAmount={minLNURLSatAmount}
                maxLNURLSatAmount={maxLNURLSatAmount}
                sparkInformation={sparkInformation}
                seletctedToken={seletctedToken}
                isLRC20Payment={isUsingLRC20}
                useAltLayout={useAltLayout}
                sendWebViewRequest={sendWebViewRequest}
              />
            </View>
          )}

          {isAmountFocused && (
            <NumberInputSendPage
              paymentInfo={paymentInfo}
              setPaymentInfo={setPaymentInfo}
              fiatStats={fiatStats}
              selectedLRC20Asset={selectedLRC20Asset}
              seletctedToken={seletctedToken}
            />
          )}

          {!useAltLayout && isAmountFocused && (
            <AcceptButtonSendPage
              isLiquidPayment={isLiquidPayment}
              canSendPayment={canSendPayment}
              decodeSendAddress={decodeSendAddress}
              errorMessageNavigation={errorMessageNavigation}
              btcAdress={btcAdress}
              paymentInfo={paymentInfo}
              convertedSendAmount={convertedSendAmount}
              paymentDescription={paymentDescription}
              setPaymentInfo={setPaymentInfo}
              setLoadingMessage={setLoadingMessage}
              fromPage={fromPage}
              publishMessageFunc={publishMessageFunc}
              // webViewRef={webViewRef}
              minLNURLSatAmount={minLNURLSatAmount}
              maxLNURLSatAmount={maxLNURLSatAmount}
              sparkInformation={sparkInformation}
              seletctedToken={seletctedToken}
              isLRC20Payment={isUsingLRC20}
              useAltLayout={useAltLayout}
              sendWebViewRequest={sendWebViewRequest}
            />
          )}
        </>
      )}

      {!canEditPaymentAmount && (
        <View style={styles.buttonContainer}>
          {/* Show slider progress animation instead of swipe button when processing */}
          {showProgressAnimation ? (
            <SliderProgressAnimation
              ref={progressAnimationRef}
              isVisible={showProgressAnimation}
              textColor={COLORS.darkModeText}
              backgroundColor={
                theme && darkModeType ? backgroundOffset : COLORS.primary
              }
              width={0.95}
            />
          ) : (
            <SwipeButtonNew
              onSwipeSuccess={sendPayment}
              width={0.85}
              resetAfterSuccessAnimDuration={true}
              // shouldAnimateViewOnSuccess={true}
              shouldResetAfterSuccess={!canSendPayment}
              // shouldDisplaySuccessState={isSendingPayment}
              containerStyles={{
                opacity: canSendPayment ? 1 : HIDDEN_OPACITY,
              }}
              thumbIconStyles={{
                backgroundColor:
                  theme && darkModeType ? backgroundOffset : backgroundColor,
                borderColor:
                  theme && darkModeType ? backgroundOffset : backgroundColor,
              }}
              railStyles={{
                backgroundColor:
                  theme && darkModeType ? backgroundOffset : backgroundColor,
                borderColor:
                  theme && darkModeType ? backgroundOffset : backgroundColor,
              }}
            />
          )}
        </View>
      )}
    </CustomKeyboardAvoidingView>
  );

  async function sendPayment() {
    if (!canSendPayment) return;
    if (isSendingPayment.current) return;
    isSendingPayment.current = true;
    setShowProgressAnimation(true);

    // await new Promise(res => setTimeout(res, 4000));

    // if (progressAnimationRef.current) {
    //   progressAnimationRef.current.completeProgress();
    // }

    // return;

    const formmateedSparkPaymentInfo = formatSparkPaymentAddress(
      paymentInfo,
      selectedLRC20Asset !== 'Bitcoin',
    );

    console.log(formmateedSparkPaymentInfo, 'manual spark information');

    const memo =
      paymentInfo.type === InputTypes.BOLT11
        ? enteredPaymentInfo?.description ||
          paymentDescription ||
          paymentInfo?.data.message ||
          ''
        : paymentDescription || paymentInfo?.data.message || '';

    const paymentObject = {
      getFee: false,
      ...formmateedSparkPaymentInfo,
      amountSats: isUsingLRC20
        ? paymentInfo?.sendAmount *
          10 ** seletctedToken?.tokenMetadata?.decimals
        : paymentInfo?.type === 'Bitcoin'
        ? convertedSendAmount + (paymentInfo?.paymentFee || 0)
        : convertedSendAmount,
      masterInfoObject,
      fee: paymentFee,
      memo,
      userBalance: sparkInformation.balance,
      sparkInformation,
      feeQuote: paymentInfo.feeQuote,
      usingZeroAmountInvoice: paymentInfo.usingZeroAmountInvoice,
      seletctedToken: selectedLRC20Asset,
      mnemonic: currentWalletMnemoinc,
      sendWebViewRequest,
    };

    // Shouuld be same for all paymetns
    const paymentResponse = await sparkPaymenWrapper(paymentObject);

    if (progressAnimationRef.current) {
      progressAnimationRef.current.completeProgress();
      await new Promise(res => setTimeout(res, 600));
    }

    if (paymentResponse.didWork) {
      if (fromPage === 'contacts') {
        publishMessageFunc();
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
                  transaction: paymentResponse.response,
                },
              },
            ],
          });
        });
      });
    } else {
      // if (paymentInfo?.webSocket) {
      //   paymentInfo?.webSocket?.close();
      // }
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
                  transaction: paymentResponse.response,
                  error: paymentResponse.error,
                },
              },
            ],
          });
        });
      });
    }
  }

  function goBackFunction() {
    keyboardGoBack(navigate);
  }
  function errorMessageNavigation(reason) {
    navigate.navigate('ConfirmPaymentScreen', {
      btcAdress: '',
      fromPage: '',
      publishMessageFunc: null,
      comingFromAccept: null,
      enteredPaymentInfo: {},
      errorMessage:
        reason || t('wallet.sendPages.sendPaymentScreen.fallbackErrorMessage'),
    });
  }
}

const styles = StyleSheet.create({
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backArrow: { position: 'absolute', zIndex: 99, left: 0 },
  maxAndAcceptContainer: {
    width: INSET_WINDOW_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    ...CENTER,
  },
  buttonContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
