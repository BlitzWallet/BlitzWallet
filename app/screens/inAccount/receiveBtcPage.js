import { StyleSheet, View, useWindowDimensions } from 'react-native';
import CustomScrollView from '../../functions/CustomElements/scrollView';
import {
  CENTER,
  FONT,
  MAX_WEB_CONTENT_WIDTH,
  MIN_BTC_USD_AMOUNT_RECEIVEPAGE,
  SATSPERBITCOIN,
} from '../../constants';
import { useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { copyToClipboard } from '../../functions';
import { useGlobalContextProvider } from '../../../context-store/context';
import { GlobalThemeView, ThemeText } from '../../functions/CustomElements';
import { initializeAddressProcess } from '../../functions/receiveBitcoin/addressGeneration';
import { useNodeContext } from '../../../context-store/nodeContext';
import { crashlyticsLogReport } from '../../functions/crashlyticsLogs';
import { useGlobalContactsInfo } from '../../../context-store/globalContacts';
import displayCorrectDenomination from '../../functions/displayCorrectDenomination';
import { useToast } from '../../../context-store/toastManager';
import { useActiveCustodyAccount } from '../../../context-store/activeAccount';
import { useTranslation } from 'react-i18next';
import { useWebView } from '../../../context-store/webViewContext';
import { useSparkWallet } from '../../../context-store/sparkContext';
import { useFlashnet } from '../../../context-store/flashnetContext';
import { dollarsToSats, satsToDollars } from '../../functions/spark/flashnet';
import { useGlobalInsets } from '../../../context-store/insetsProvider';
import { useKeysContext } from '../../../context-store/keys';
import { useAccumulationAddresses } from '../../hooks/useAccumulationAddresses';
// import { useRootstockProvider } from '../../../context-store/rootstockSwapContext';
import { useTheme } from '../../../context-store/theme';
import usePaymentInputDisplay from '../../hooks/usePaymentInputDisplay';
import useGuardedNavigation from '../../hooks/useGuardedNavigation';
import {
  SATS_DISPLAY_CURRENCY,
  normalizeDisplayCurrency,
  resolveFiatStatsForCurrency,
  resolveUsdFiatStats,
} from '../../functions/displayCurrency';
import { shareMessage } from '../../functions/handleShare';
import TopBar from '../../functions/CustomElements/redesign/TopBar';
import IconButton from '../../functions/CustomElements/redesign/IconButton';
import AmountHero from '../../functions/CustomElements/redesign/AmountHero';
import Note from '../../functions/CustomElements/redesign/Note';
import {
  ReceiveActions,
  ReceiveQrCard,
} from '../../components/admin/homeComponents/receiveBitcoin/receiveParts';
import {
  buildPaylinkDoc,
  buildPaylinkURL,
} from '../../functions/receiveBitcoin/paylinkUtils';
import { addDataToCollection } from '../../../db';

// Invoice (Receive.dc.html "Lightning invoice · Bitcoin / Dollars"). The
// Bitcoin or Dollars row picked on Receive sets endReceiveType; the pencil
// edits the amount and note. No amount (or Dollars under the swap minimum)
// shows your Lightning address instead, which takes any amount.

export default function ReceivePaymentHome(props) {
  const navigate = useNavigation();
  const guardedNavigate = useGuardedNavigation();
  const { fiatStats } = useNodeContext();
  const { sendWebViewRequest } = useWebView();
  const { swapLimits, poolInfoRef, swapUSDPriceDollars } = useFlashnet();
  const { sparkInformation } = useSparkWallet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { globalContactsInformation } = useGlobalContactsInfo();
  const { width } = useWindowDimensions();
  // const { signer } = useRootstockProvider();
  const signer = null;
  const { t } = useTranslation();
  const { tokens } = useTheme();
  const { isUsingAltAccount, currentWalletMnemoinc } =
    useActiveCustodyAccount();
  const { contactsPrivateKey, publicKey: contactsPublicKey } = useKeysContext();
  const { createAddress } = useAccumulationAddresses();
  const { bottomPadding } = useGlobalInsets();
  const { showToast } = useToast();
  const contentWidth = Math.min(width, MAX_WEB_CONTENT_WIDTH) - 40;
  const qrSize = Math.min(contentWidth - 60, 290);

  const routeParams = props.route?.params || {};
  const paymentDescription = routeParams.description;
  const requestUUID = routeParams.uuid;
  const endReceiveType =
    routeParams.endReceiveType || routeParams.initialReceiveType || 'BTC';
  const paymentDisplayCurrency = routeParams.paymentDisplayCurrency;
  const paymentDisplayFiatStats = routeParams.paymentDisplayFiatStats;
  // Verbatim fiat amount the user typed (e.g. "100"), kept so the display can
  // show exactly what they entered instead of re-deriving it from sats.
  const paymentDisplayAmount = routeParams.paymentDisplayAmount;

  const userReceiveAmount = routeParams.receiveAmount || 0;
  const [initialSendAmount, setInitialSendAmount] = useState(userReceiveAmount);
  const [isBuildingPaylink, setIsBuildingPaylink] = useState(false);

  const prevRequstInfo = useRef(null);
  const addressStateRef = useRef(null);
  const generationRef = useRef(0);

  const [sharePayLinkCache, setSharePayLinkCache] = useState(null);

  const [addressState, setAddressState] = useState({
    isReceivingSwap: false,
    generatedAddress: '',
    isGeneratingInvoice: true,
    errorMessageText: {
      type: null,
      text: '',
    },
    fee: 0,
  });

  useEffect(() => {
    addressStateRef.current = addressState;
  }, [addressState]);

  // Append a currency suffix to signal receive method to backend.
  const lnurlSuffix = endReceiveType === 'USD' ? '-d60fbd' : '-e40605';
  const lnurlAddress = `${globalContactsInformation?.myProfile?.uniqueName}${lnurlSuffix}@blitzwalletapp.com`;

  const minUsdSats = Math.round(
    Math.max(
      MIN_BTC_USD_AMOUNT_RECEIVEPAGE,
      dollarsToSats(1, poolInfoRef?.currentPriceAInB),
    ),
  );

  // When a USD amount falls below the swap minimum we show the LNURL instead of
  // prefilling a $1 invoice. The requested sats stay in the route param so
  // toggling back to Bitcoin restores the original invoice.
  const canUseLnurl = !isUsingAltAccount && !paymentDescription;
  const isBelowUsdSwapMin =
    endReceiveType === 'USD' &&
    !!userReceiveAmount &&
    minUsdSats > 0 &&
    userReceiveAmount < minUsdSats;

  useEffect(() => {
    async function runAddressInit() {
      crashlyticsLogReport('Begining adddress initialization');

      if (
        prevRequstInfo.current &&
        userReceiveAmount === prevRequstInfo.current.userReceiveAmount &&
        paymentDescription === prevRequstInfo.current.paymentDescription &&
        !addressStateRef.current.errorMessageText.text &&
        endReceiveType === prevRequstInfo.current.endReceiveType
      ) {
        return;
      }

      prevRequstInfo.current = {
        userReceiveAmount,
        paymentDescription,
        endReceiveType,
      };

      if ((!userReceiveAmount || isBelowUsdSwapMin) && canUseLnurl) {
        setInitialSendAmount(0);
        setAddressState(prev => ({
          ...prev,
          isGeneratingInvoice: false,
          generatedAddress: lnurlAddress,
        }));
        return;
      }

      generationRef.current += 1;
      const gen = generationRef.current;
      const guardedSetAddressState = updater => {
        if (generationRef.current === gen) setAddressState(updater);
      };

      await initializeAddressProcess({
        userBalanceDenomination: masterInfoObject.userBalanceDenomination,
        receivingAmount: userReceiveAmount,
        description: paymentDescription,
        masterInfoObject,
        setAddressState: guardedSetAddressState,
        selectedRecieveOption: 'Lightning',
        navigate,
        signer,
        currentWalletMnemoinc,
        sendWebViewRequest,
        sparkInformation,
        endReceiveType,
        swapLimits,
        setInitialSendAmount,
        userReceiveAmount,
        poolInfoRef,
        isHoldInvoice: false,
        holdExpirySeconds: 2592000,
        contactsPrivateKey,
        contactsPublicKey,
        createAddress,
        sourceChain: undefined,
        sourceAsset: undefined,
        destinationAsset: undefined,
      });
    }
    runAddressInit();
  }, [
    userReceiveAmount,
    paymentDescription,
    requestUUID,
    endReceiveType,
    lnurlAddress,
    minUsdSats,
  ]);

  const address = addressState.generatedAddress || '';

  const displayedReceiveAmount = isBelowUsdSwapMin
    ? 0
    : initialSendAmount || userReceiveAmount || 0;

  const isUsingLnurl =
    !displayedReceiveAmount && !isUsingAltAccount && !paymentDescription;

  const displayAddress = address;

  const handleShareInvoice = async () => {
    try {
      const amount = displayedReceiveAmount;
      const currencyType = endReceiveType;
      const matchingSharePayLinkCache =
        sharePayLinkCache?.amount === amount &&
        sharePayLinkCache?.currencyType === currencyType
          ? sharePayLinkCache
          : null;

      if (matchingSharePayLinkCache?.payLinkId) {
        if (displayAddress)
          shareMessage({
            message: buildPaylinkURL(matchingSharePayLinkCache?.payLinkId),
          });
        return;
      }

      // Any-amount invoices are a Lightning address: share it as text.
      if (!amount) {
        if (displayAddress) shareMessage({ message: displayAddress });
        return;
      }
      setIsBuildingPaylink(true);
      const displayAmount =
        currencyType === 'USD'
          ? satsToDollars(amount, poolInfoRef?.currentPriceAInB)
          : amount;
      const paylinkDoc = buildPaylinkDoc({
        displayAmount,
        rawAmount: amount,
        currencyType,
        name:
          globalContactsInformation.myProfile.name ||
          globalContactsInformation.myProfile.uniqueName,
        identityPubKey: sparkInformation.identityPubKey,
        creatorUUID: masterInfoObject.uuid,
      });

      const success = await addDataToCollection(
        paylinkDoc,
        'blitzPaylinks',
        paylinkDoc.payLinkId,
      );
      if (!success) {
        throw new Error(t('screens.inAccount.receiveBtcPage.paylinkSaveError'));
      }

      setSharePayLinkCache({
        payLinkId: paylinkDoc.payLinkId,
        amount,
        currencyType,
      });
      await shareMessage({
        message: buildPaylinkURL(paylinkDoc.payLinkId),
      });
    } catch (err) {
      navigate.navigate('ErrorScreen', { errorMessage: err.message });
    } finally {
      setIsBuildingPaylink(false);
    }
  };

  const handleShowEditPage = () => {
    // Don't push the (transparent-modal) edit screen on top of the receive
    // page while its address/invoice is still generating — the underlying
    // screen is still mounting/re-rendering, and stacking a transition on top
    // is what triggers the Fabric "Unable to find viewState" mount crash.
    if (addressState.isGeneratingInvoice) return;
    guardedNavigate('EditReceivePaymentInformation', {
      from: 'receivePage',
      receiveType: 'Lightning',
      endReceiveType,
      userReceiveAmount: displayedReceiveAmount,
      description: paymentDescription,
      paymentDisplayCurrency,
      paymentDisplayFiatStats,
      paymentDisplayAmount,
    });
  };

  const { primary, secondary } = useInvoiceAmountLines({
    amountCardValue: displayedReceiveAmount,
    endReceiveType,
    masterInfoObject,
    fiatStats,
    swapUSDPriceDollars,
    paymentDisplayCurrency,
    paymentDisplayAmount,
    paymentDisplayFiatStats,
  });

  const isUSD = endReceiveType === 'USD';
  const subLine = [
    !displayedReceiveAmount
      ? isUSD
        ? t('screens.inAccount.receiveBtcPage.usdSwapMinNotice', {
            amount: displayCorrectDenomination({
              amount: MIN_BTC_USD_AMOUNT_RECEIVEPAGE,
              masterInfoObject: {
                ...masterInfoObject,
                userBalanceDenomination: 'fiat',
              },
              fiatStats: resolveUsdFiatStats(fiatStats, swapUSDPriceDollars),
              forceCurrency: 'USD',
            }),
          })
        : !paymentDescription && t('receive.anyAmountSub')
      : isUSD
      ? t('receive.arrivesAsDollars')
      : secondary,
    paymentDescription,
  ]
    .filter(Boolean)
    .join(' · ');

  const errorMessage = addressState.errorMessageText;
  const isWarning = errorMessage?.type === 'warning' && !!errorMessage?.text;
  const noteText = isWarning
    ? t(errorMessage.text)
    : isUSD
    ? t('receive.conversionNote')
    : '';

  return (
    <GlobalThemeView useStandardWidth={false} styles={styles.screen}>
      <View
        style={[
          styles.container,
          { width: contentWidth, paddingBottom: bottomPadding },
        ]}
      >
        <TopBar
          title={t('receive.invoice')}
          right={
            <IconButton
              icon="Pencil"
              label="constants.edit"
              onPress={handleShowEditPage}
            />
          }
        />
        <CustomScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          <View style={styles.amount}>
            {primary ? (
              <AmountHero amount={primary} formatAmount={false} splitCents />
            ) : (
              <ThemeText
                styles={styles.anyAmount}
                content={t('receive.anyAmount')}
              />
            )}
            {!!subLine && (
              <ThemeText
                CustomNumberOfLines={2}
                styles={[styles.sub, { color: tokens.muted }]}
                content={subLine}
              />
            )}
          </View>
          <View style={styles.qr}>
            <ReceiveQrCard
              value={displayAddress}
              size={qrSize}
              loading={addressState.isGeneratingInvoice}
              errorText={
                errorMessage?.text && !isWarning ? t(errorMessage.text) : ''
              }
              onPress={() => copyToClipboard(displayAddress, showToast)}
              removeCard
            />
          </View>
        </CustomScrollView>
        {!!noteText && (
          <View style={styles.note}>
            <Note tone="warn" text={noteText} />
          </View>
        )}
        <ReceiveActions
          value={displayAddress}
          onShare={handleShareInvoice}
          useLoading={isBuildingPaylink}
        />
      </View>
    </GlobalThemeView>
  );
}

// Primary/secondary amount strings for the invoice (see renderLine).
function useInvoiceAmountLines({
  amountCardValue,
  endReceiveType,
  masterInfoObject,
  fiatStats,
  swapUSDPriceDollars,
  paymentDisplayCurrency,
  paymentDisplayAmount,
  paymentDisplayFiatStats,
}) {
  const inputDenomination = endReceiveType === 'USD' ? 'fiat' : 'sats';
  const usdFiatStats = resolveUsdFiatStats(fiatStats, swapUSDPriceDollars);
  const { primaryDisplay, secondaryDisplay } = usePaymentInputDisplay({
    paymentMode: endReceiveType,
    inputDenomination,
    fiatStats,
    usdFiatStats,
    masterInfoObject,
  });

  if (!amountCardValue) return { primary: '', secondary: '' };

  // When the user entered the amount in a currency other than what the primary
  // line shows (e.g. entered EUR while device is USD), show that entered
  // currency as the secondary line instead of the device-derived default.
  const enteredCurrency = normalizeDisplayCurrency(paymentDisplayCurrency);
  const hasFiatLiteral =
    paymentDisplayAmount != null &&
    paymentDisplayAmount !== '' &&
    enteredCurrency !== SATS_DISPLAY_CURRENCY;

  const primaryCurrencyCode =
    endReceiveType === 'USD' ? 'USD' : SATS_DISPLAY_CURRENCY;
  const overrideSecondary =
    enteredCurrency !== SATS_DISPLAY_CURRENCY &&
    enteredCurrency !== primaryCurrencyCode;

  const effectiveSecondaryDisplay = overrideSecondary
    ? {
        denomination: 'fiat',
        forceCurrency: enteredCurrency,
      }
    : secondaryDisplay;

  // A fiat line may only be converted with stats whose coin matches the
  // currency being displayed; otherwise one currency's number would render
  // under another currency's label (e.g. a stale USD rate shown as EUR). The
  // pinned entry-time stats are preferred for the entered currency, then the
  // USD stats, then the device stats — only when the coin matches.
  const resolveLineFiatStats = displayConfig =>
    resolveFiatStatsForCurrency(
      displayConfig.forceCurrency ||
        (displayConfig.denomination === 'fiat'
          ? masterInfoObject?.fiatCurrency
          : null),
      { paymentDisplayFiatStats, usdFiatStats, fiatStats },
    );

  const primaryFiatStats = resolveLineFiatStats(primaryDisplay);
  const secondaryFiatStats = resolveLineFiatStats(effectiveSecondaryDisplay);

  // Render one amount line. The line that matches the fiat currency the user
  // actually typed shows their verbatim entered value (so $100 always reads
  // $100, never $100.1/$99.2 as the live rate ticks). The identity rate
  // (value === SATSPERBITCOIN) lets displayCorrectDenomination format the
  // literal through the normal fiat path without re-converting from sats. Every
  // other line still derives live from the real invoice sats (amountCardValue).
  const renderLine = (displayConfig, lineFiatStats) => {
    const isEnteredFiatLine =
      hasFiatLiteral &&
      displayConfig.denomination === 'fiat' &&
      normalizeDisplayCurrency(displayConfig.forceCurrency) === enteredCurrency;

    // Never render a fiat conversion whose rate is unavailable or mismatched.
    if (
      displayConfig.denomination === 'fiat' &&
      !isEnteredFiatLine &&
      !lineFiatStats
    ) {
      return '';
    }

    return displayCorrectDenomination({
      amount: isEnteredFiatLine ? paymentDisplayAmount : amountCardValue,
      masterInfoObject: {
        ...masterInfoObject,
        userBalanceDenomination: displayConfig.denomination,
      },
      fiatStats: isEnteredFiatLine
        ? { coin: enteredCurrency, value: SATSPERBITCOIN }
        : lineFiatStats,
      forceCurrency: displayConfig.forceCurrency,
    });
  };

  return {
    primary: renderLine(primaryDisplay, primaryFiatStats),
    secondary: renderLine(effectiveSecondaryDisplay, secondaryFiatStats),
  };
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  container: { flex: 1, ...CENTER },
  scroll: { flexGrow: 1, paddingVertical: 24 },
  amount: { alignItems: 'center', marginBottom: 24 },
  qr: { flex: 1, justifyContent: 'center' },
  anyAmount: {
    fontFamily: FONT.Title_Medium,
    fontSize: 28,
    lineHeight: 34,
    includeFontPadding: false,
  },
  sub: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    includeFontPadding: false,
  },
  note: { marginBottom: 16 },
});
