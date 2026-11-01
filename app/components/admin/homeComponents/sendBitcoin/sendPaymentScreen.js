import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { GlobalThemeView } from '../../../../functions/CustomElements';
import FullLoadingScreen from '../../../../functions/CustomElements/loadingScreen';
import TopBar from '../../../../functions/CustomElements/redesign/TopBar';
import { crashlyticsLogReport } from '../../../../functions/crashlyticsLogs';
import ErrorWithPayment from './components/errorScreen';
import useSendPaymentDetails from './hooks/useSendPaymentDetails';
import {
  buildNextParams,
  nextSendRoute,
  requiresMethodChoice,
} from './functions/sendFlow';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { CENTER, MAX_WEB_CONTENT_WIDTH } from '../../../../constants';

const EMPTY_PAYMENT_INFO = {};

// Route ConfirmPaymentScreen: every send entry point lands here. Decodes once,
// then replaces itself with the page the payment needs.
export default function SendPaymentScreen(props) {
  const navigate = useNavigation();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const params = props.route.params;
  const { btcAdress, errorMessage, enteredPaymentInfo = {} } = params;
  const preSelectedPaymentMethod = params.preSelectedPaymentMethod;

  const [resolved, setResolved] = useState(null);
  const [decodeError, setDecodeError] = useState('');
  const details = useSendPaymentDetails({
    paymentInfo: resolved || EMPTY_PAYMENT_INFO,
    params,
    isDecoding: !resolved,
  });
  const { sparkInformation, decodePayment } = details;
  const [loadingMessage, setLoadingMessage] = useState(
    sparkInformation.didConnect
      ? t('wallet.sendPages.sendPaymentScreen.initialLoadingMessage')
      : t('wallet.sendPages.sendPaymentScreen.connectToSparkMessage'),
  );
  const isMountedRef = useRef(true);
  const requestIdRef = useRef(0);
  const decodePaymentRef = useRef(decodePayment);
  decodePaymentRef.current = decodePayment;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (errorMessage) return;
    if (!sparkInformation.didConnect || !sparkInformation.identityPubKey)
      return;

    const requestId = ++requestIdRef.current;
    setResolved(null);
    setDecodeError('');
    requestAnimationFrame(async () => {
      crashlyticsLogReport('Starting decode address');
      const { decoded, error } = await decodePaymentRef.current({
        basePaymentInfo: EMPTY_PAYMENT_INFO,
        comingFromAccept: enteredPaymentInfo.fromContacts,
        entered: enteredPaymentInfo,
        usablePaymentMethod: details.userPaymentMethod,
        amountSat: 0,
        navigate,
        setLoadingMessage,
      });
      if (!isMountedRef.current || requestId !== requestIdRef.current) return;
      if (error) setDecodeError(error);
      else if (decoded) setResolved(decoded);
    });
  }, [
    btcAdress,
    errorMessage,
    sparkInformation.didConnect,
    sparkInformation.identityPubKey,
  ]);

  useEffect(() => {
    if (!resolved) return;
    const needsMethodChoice = requiresMethodChoice({
      paymentInfo: resolved,
      balances: details.balanceRef.current,
      resolvedMethod: details.resolvedPaymentMethod,
      amountSat: details.convertedSendAmount,
      fee: details.effectivePaymentFee,
      didSelectPaymentMethod: false,
      flashnetReady: details.flashnetReady,
      swapLimits: details.swapLimits,
      minUsdSwapAmount: details.min_usd_swap_amount,
      isUsingLRC20: details.isUsingLRC20,
      useFullTokensDisplay: details.useFullTokensDisplay,
      preSelectedPaymentMethod,
    });
    navigate.replace(
      nextSendRoute({ paymentInfo: resolved, needsMethodChoice }),
      buildNextParams(params, {
        paymentInfo: resolved,
        lockedAmount: !resolved.canEditPayment,
      }),
    );
  }, [resolved]);

  // A bad address returns to the page it came from, so it can be corrected.
  const handleDecodeErrorContinue = useCallback(() => {
    if (navigate.canGoBack()) navigate.goBack();
    else navigate.popTo('HomeAdmin', { screen: 'Home' });
  }, [navigate]);

  if (errorMessage) return <ErrorWithPayment reason={errorMessage} />;
  if (decodeError)
    return (
      <ErrorWithPayment
        reason={decodeError}
        onContinue={handleDecodeErrorContinue}
      />
    );

  return (
    <GlobalThemeView useStandardWidth={true}>
      <View style={[styles.container, { width: contentWidth }]}>
        <TopBar />
        <FullLoadingScreen text={loadingMessage} />
      </View>
    </GlobalThemeView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...CENTER,
  },
});
