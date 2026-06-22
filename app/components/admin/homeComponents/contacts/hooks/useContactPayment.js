import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InputTypes, parseInput } from 'bitcoin-address-parser';

import { USDB_TOKEN_ID } from '../../../../../constants';
import { useGlobalContextProvider } from '../../../../../../context-store/context';
import { useUserBalanceContext } from '../../../../../../context-store/userBalanceContext';
import { useFlashnet } from '../../../../../../context-store/flashnetContext';
import { useSparkWallet } from '../../../../../../context-store/sparkContext';
import { useKeysContext } from '../../../../../../context-store/keys';
import { useAppStatus } from '../../../../../../context-store/appStatus';
import { useNodeContext } from '../../../../../../context-store/nodeContext';
import { useServerTimeOnly } from '../../../../../../context-store/serverTime';
import { useActiveCustodyAccount } from '../../../../../../context-store/activeAccount';
import { useGlobalContactsInfo } from '../../../../../../context-store/globalContacts';
import { useWebView } from '../../../../../../context-store/webViewContext';
import { useToast } from '../../../../../../context-store/toastManager';
import { publishMessage } from '../../../../../functions/messaging/publishMessage';
import customUUID from '../../../../../functions/customUUID';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import formatTokensNumber from '../../../../../functions/lrc20/formatTokensBalance';
import {
  dollarsToSats,
  getLightningPaymentQuote,
  satsToDollars,
  USD_ASSET_ADDRESS,
} from '../../../../../functions/spark/flashnet';
import { sparkPaymenWrapper } from '../../../../../functions/spark/payments';
import { getLNAddressForLiquidPayment } from '../../sendBitcoin/functions/payments';
import usePaymentValidation from '../../sendBitcoin/functions/paymentValidation';
import useCurrencyDisplay from '../../../../../hooks/useCurrencyDisplay';
import useDisplayCurrencyController from '../../../../../hooks/useDisplayCurrencyController';
import useDebounce from '../../../../../hooks/useDebounce';
import getReceiveAddressAndContactForContactsPayment from '../internalComponents/getReceiveAddressAndKindForPayment';
import { resolveContactPaymentDefault } from './resolveContactPaymentDefault';
import {
  getDefaultDisplayCurrency,
  normalizeDisplayCurrency,
} from '../../../../../functions/displayCurrency';
import {
  lnurlCurrencyToRate,
  normalizeLNURLCurrency,
} from '../../../../../functions/sendBitcoin/lnurlCurrencyRate';
import {
  getPhonePaymentCountry,
  PROVIDER_COUNTRY_CURRENCY,
} from '../../../../../functions/sendBitcoin/getPhonePaymentAddress';
import { fiatCurrencies } from '../../../../../functions/currencyOptions';

export default function useContactPayment({
  selectedContact,
  paymentType,
  selectedPaymentMethod,
  selectedRequestMethod,
  endReceiveType,
  imageData,
  initialDescription = '',
  lockInitialPaymentMethod = false,
  t,
}) {
  const { dollarBalanceSat, dollarBalanceToken, bitcoinBalance } =
    useUserBalanceContext();
  const { poolInfoRef, swapLimits, swapUSDPriceDollars } = useFlashnet();
  const { masterInfoObject } = useGlobalContextProvider();
  const { sparkInformation } = useSparkWallet();
  const { contactsPrivateKey } = useKeysContext();
  const { isConnectedToTheInternet } = useAppStatus();
  const { fiatStats } = useNodeContext();
  const {
    globalContactsInformation,
    getContactReceiveOption,
    isContactReceiveOptionCacheLoaded,
  } = useGlobalContactsInfo();
  const getServerTime = useServerTimeOnly();
  const { currentWalletMnemoinc } = useActiveCustodyAccount();
  const { showToast } = useToast();
  const { sendWebViewRequest } = useWebView();

  const explicitPaymentMethod =
    paymentType === 'send' ? selectedPaymentMethod : selectedRequestMethod;
  const [paymentMethod, setPaymentMethod] = useState(
    explicitPaymentMethod || 'BTC',
  );
  const [amountValue, setAmountValue] = useState('');
  const [descriptionValue, setDescriptionValue] = useState(initialDescription);
  const [isLoading, setIsLoading] = useState(false);
  const [lnFeeEstimate, setLnFeeEstimate] = useState(null);
  const [swapQuote, setSwapQuote] = useState({});
  const [lnInvoiceData, setLnInvoiceData] = useState(null);
  const [lnurlPayData, setLnurlPayData] = useState(null);
  const [isResolvingLnurlData, setIsResolvingLnurlData] = useState(false);
  const [prefetchedDoc, setPrefetchedDoc] = useState(null);
  const [contactReceiveOption, setContactReceiveOption] = useState(null);
  const lnurlParsedRef = useRef(null);
  const appliedLocalCurrencyRef = useRef(null);
  const quoteId = useRef(null);
  const poolInfoRefSnapshotRef = useRef(poolInfoRef);
  const userChangedPaymentMethodRef = useRef(Boolean(explicitPaymentMethod));
  const previousExplicitMethodRef = useRef(explicitPaymentMethod);

  const requiresContactDoc =
    paymentType === 'send' &&
    Boolean(selectedContact) &&
    !selectedContact?.isLNURL;

  useEffect(() => {
    setDescriptionValue(initialDescription || '');
  }, [initialDescription]);

  useEffect(() => {
    if (previousExplicitMethodRef.current === explicitPaymentMethod) return;
    previousExplicitMethodRef.current = explicitPaymentMethod;
    setAmountValue('');
    if (explicitPaymentMethod) {
      userChangedPaymentMethodRef.current = true;
      setPaymentMethod(explicitPaymentMethod);
    }
  }, [explicitPaymentMethod]);

  useEffect(() => {
    if (explicitPaymentMethod && lockInitialPaymentMethod) {
      setPaymentMethod(explicitPaymentMethod);
      return;
    }

    const resolvedDefault = resolveContactPaymentDefault();

    if (!userChangedPaymentMethodRef.current) {
      setPaymentMethod(prev => {
        // If the default flips while the user has already typed an amount, clear
        // it so a sats entry isn't silently reinterpreted as fiat (or vice versa).
        if (prev !== resolvedDefault) {
          setAmountValue('');
        }
        return resolvedDefault;
      });
    }
  }, [explicitPaymentMethod, lockInitialPaymentMethod]);

  useEffect(() => {
    let isCurrent = true;

    if (!requiresContactDoc) {
      setPrefetchedDoc(null);
      setContactReceiveOption(null);
      return () => {
        isCurrent = false;
      };
    }

    setPrefetchedDoc(null);
    setContactReceiveOption(null);

    if (!isContactReceiveOptionCacheLoaded) {
      return () => {
        isCurrent = false;
      };
    }

    const MAX_ATTEMPTS = 5;
    const BASE_DELAY_MS = 375;

    const fetchWithBackoff = async (attempt = 0) => {
      try {
        const result = await getContactReceiveOption(selectedContact.uuid);
        if (isCurrent) {
          setContactReceiveOption(result.receiveOption ?? null);
          setPrefetchedDoc(result.contactDoc ?? null);
        }
      } catch {
        if (!isCurrent) return;

        if (attempt < MAX_ATTEMPTS - 1) {
          const delay = BASE_DELAY_MS * 2 ** attempt;
          await new Promise(resolve => setTimeout(resolve, delay));
          if (isCurrent) fetchWithBackoff(attempt + 1);
        } else {
          setPrefetchedDoc(null);
        }
      }
    };

    fetchWithBackoff();

    return () => {
      isCurrent = false;
    };
  }, [
    getContactReceiveOption,
    isContactReceiveOptionCacheLoaded,
    requiresContactDoc,
    selectedContact?.uuid,
  ]);

  // For LNURL contacts the receive address must be resolved against its
  // .well-known/lnurlp endpoint to learn the min/max sendable bounds. Fetch it
  // up front (not lazily during fee estimation) so usePaymentValidation can
  // enforce those bounds on the input screen instead of failing at confirm.
  useEffect(() => {
    let isCurrent = true;

    if (!selectedContact?.isLNURL || paymentType !== 'send') {
      setLnurlPayData(null);
      setIsResolvingLnurlData(false);
      return () => {
        isCurrent = false;
      };
    }

    setLnurlPayData(null);
    setIsResolvingLnurlData(true);

    const MAX_ATTEMPTS = 5;
    const BASE_DELAY_MS = 375;

    const fetchWithBackoff = async (attempt = 0) => {
      try {
        const parsed = await parseInput(selectedContact.receiveAddress);
        if (!isCurrent) return;
        setLnurlPayData(parsed);
        // Seed the ref so estimateLNURLFee reuses it instead of re-parsing.
        lnurlParsedRef.current = parsed;
        setIsResolvingLnurlData(false);
      } catch {
        if (!isCurrent) return;

        if (attempt < MAX_ATTEMPTS - 1) {
          const delay = BASE_DELAY_MS * 2 ** attempt;
          await new Promise(resolve => setTimeout(resolve, delay));
          if (isCurrent) fetchWithBackoff(attempt + 1);
        } else {
          // Leave lnurlPayData null — review stays blocked with an explanatory
          // message until bounds are known.
          setIsResolvingLnurlData(false);
        }
      }
    };

    fetchWithBackoff();

    return () => {
      isCurrent = false;
    };
  }, [paymentType, selectedContact?.isLNURL, selectedContact?.receiveAddress]);

  const minLNURLSatAmount = lnurlPayData
    ? lnurlPayData.data.minSendable / 1000
    : 0;
  const maxLNURLSatAmount = lnurlPayData
    ? lnurlPayData.data.maxSendable / 1000
    : Infinity;

  const resolvedEndReceiveType =
    paymentType === 'send'
      ? selectedContact?.isLNURL
        ? 'BTC'
        : requiresContactDoc
        ? contactReceiveOption ||
          (prefetchedDoc?.lnurlReceiveCurrency?.toLowerCase() === 'usd'
            ? 'USD'
            : 'BTC')
        : endReceiveType || 'BTC'
      : paymentMethod;

  const usdFiatStats = useMemo(
    () => ({ coin: 'USD', value: swapUSDPriceDollars }),
    [swapUSDPriceDollars],
  );
  const initialDisplayCurrency = useMemo(
    () =>
      getDefaultDisplayCurrency({
        paymentMode: paymentMethod,
        masterInfoObject,
        fiatStats,
      }),
    [paymentMethod, masterInfoObject, fiatStats],
  );
  const {
    displayCurrency,
    currencyRates,
    isLoadingRate,
    selectCurrency,
    injectRate,
    loadAndSetCurrency,
    hasUserSelectedDisplayCurrency,
  } = useDisplayCurrencyController({
    initialCurrency: initialDisplayCurrency,
    fiatStats,
    usdFiatStats,
    masterInfoObject,
  });

  const {
    primaryDisplay,
    conversionFiatStats,
    convertDisplayToSats,
    convertSatsToDisplay,
    buildAmountSnapshot,
  } = useCurrencyDisplay({
    displayCurrency,
    fiatStats,
    usdFiatStats,
    currencyRates,
    masterInfoObject,
  });

  const convertedSendAmount = convertDisplayToSats(amountValue);

  // Once the LNURL payRequest resolves, default the amount input to its
  // advertised fiat currency (or the phone-provider country's currency). Always
  // switches, runs once per address, and never overrides a manual selection.
  useEffect(() => {
    if (!lnurlPayData || paymentType !== 'send') return;
    if (hasUserSelectedDisplayCurrency) return;
    const address = selectedContact?.receiveAddress;
    if (!address || appliedLocalCurrencyRef.current === address) return;

    const descriptor = normalizeLNURLCurrency(lnurlPayData.data);
    const country = getPhonePaymentCountry(address);
    if (!descriptor && !country) return;

    const code = (
      descriptor?.code ||
      (country ? PROVIDER_COUNTRY_CURRENCY[country] : '') ||
      ''
    ).toUpperCase();
    if (!code || !fiatCurrencies.some(c => c.id === code)) return;

    appliedLocalCurrencyRef.current = address;

    const rate = lnurlCurrencyToRate(descriptor);
    if (rate) {
      injectRate(code, rate, { setAsDisplay: true });
    } else {
      // No usable LNURL rate (e.g. phone pay): fetch our internal rate and switch.
      loadAndSetCurrency(code);
    }
  }, [
    lnurlPayData,
    paymentType,
    selectedContact?.receiveAddress,
    hasUserSelectedDisplayCurrency,
    injectRate,
    loadAndSetCurrency,
  ]);

  const min_usd_swap_amount = useMemo(() => {
    return Math.round(
      dollarsToSats(
        swapLimits.usd,
        poolInfoRefSnapshotRef.current.currentPriceAInB,
      ),
    );
  }, [poolInfoRefSnapshotRef.current.currentPriceAInB, swapLimits]);

  const estimateLNURLFee = useCallback(
    async (amount, id) => {
      if (quoteId.current !== id) return;
      if (!selectedContact?.isLNURL || paymentType !== 'send' || !amount) {
        setIsLoading(false);
        return;
      }

      const balance =
        paymentMethod === 'USD' ? dollarBalanceSat : bitcoinBalance;
      const bufferAmount = amount * 1.1;

      if (bufferAmount < balance || amount > balance) {
        setIsLoading(false);
        return;
      }

      try {
        if (!lnurlParsedRef.current) {
          lnurlParsedRef.current = await parseInput(
            selectedContact.receiveAddress,
          );
        }
        const lnurlInput = lnurlParsedRef.current;

        const invoiceResponse = await getLNAddressForLiquidPayment(
          lnurlInput,
          amount,
          '',
        );
        if (quoteId.current !== id) return;
        if (!invoiceResponse.pr) throw new Error('No invoice received');
        setLnInvoiceData(invoiceResponse);

        if (paymentMethod === 'USD') {
          const quote = await getLightningPaymentQuote(
            currentWalletMnemoinc,
            invoiceResponse.pr,
            USD_ASSET_ADDRESS,
            undefined,
            undefined,
            { amountSats: amount },
          );
          if (!quote.didWork)
            throw new Error(quote.error || 'Fee quote failed');

          if (quoteId.current !== id) return;
          const estimatedAmmFeeSat = Math.round(
            dollarsToSats(
              quote.quote.estimatedAmmFee / Math.pow(10, 6),
              poolInfoRef.currentPriceAInB,
            ),
          );
          const dollarAmountRequired = quote.quote.tokenAmountRequired;
          const userDollarBalance = dollarBalanceToken * Math.pow(10, 6);
          const fee = quote.quote.estimatedLightningFee + estimatedAmmFeeSat;
          if (dollarAmountRequired > userDollarBalance) {
            showToast({
              type: 'error',
              title: t('errormessages.lightningAmountRequiredWarning', {
                amount: displayCorrectDenomination({
                  amount: parseFloat(
                    formatTokensNumber(quote.quote.tokenAmountRequired, 6),
                  ).toFixed(2),
                  masterInfoObject: {
                    ...masterInfoObject,
                    userBalanceDenomination: 'fiat',
                  },
                  fiatStats,
                  convertAmount: false,
                  forceCurrency: 'USD',
                }),
              }),
              duration: 6000,
            });
          }

          setSwapQuote(quote.quote);
          setLnFeeEstimate(fee);
        } else {
          const feeResult = await sparkPaymenWrapper({
            getFee: true,
            paymentType: 'lightning',
            address: invoiceResponse.pr,
            amountSats: amount,
            masterInfoObject,
            sparkInformation,
            mnemonic: currentWalletMnemoinc,
            sendWebViewRequest,
          });
          if (!feeResult.didWork) throw new Error('Fee estimation failed');
          const fee = feeResult.fee;
          if (quoteId.current !== id) return;
          if (fee + amount > bitcoinBalance) {
            showToast({
              type: 'error',
              title: t('errormessages.lightningAmountFeeWarning', {
                amount: displayCorrectDenomination({
                  amount: fee,
                  masterInfoObject: {
                    ...masterInfoObject,
                    userBalanceDenomination: 'sats',
                  },
                  fiatStats,
                }),
              }),
              duration: 6000,
            });
          }
          setLnFeeEstimate(fee);
        }
      } catch {
        showToast({
          type: 'error',
          title: t('wallet.sendPages.sendPaymentScreen.feeEstimateError'),
        });
      } finally {
        if (quoteId.current === id) {
          setIsLoading(false);
        }
      }
    },
    [
      bitcoinBalance,
      currentWalletMnemoinc,
      dollarBalanceSat,
      dollarBalanceToken,
      fiatStats,
      masterInfoObject,
      paymentMethod,
      paymentType,
      poolInfoRef,
      selectedContact?.isLNURL,
      selectedContact?.receiveAddress,
      sendWebViewRequest,
      showToast,
      sparkInformation,
      t,
    ],
  );

  const debouncedEstimateLNURLFee = useDebounce(estimateLNURLFee, 600);

  const paymentValidation = usePaymentValidation({
    paymentInfo: {
      sendAmount: convertedSendAmount,
      type: selectedContact?.isLNURL ? InputTypes.LNURL_PAY : undefined,
      paymentNetwork: selectedContact?.isLNURL ? 'lightning' : 'spark',
      isLNURLPayment: selectedContact?.isLNURL,
      data: {
        expectedReceive: resolvedEndReceiveType === 'BTC' ? 'sats' : 'tokens',
        expectedToken: resolvedEndReceiveType === 'BTC' ? null : USDB_TOKEN_ID,
      },
      decodedInput: {
        tpye: selectedContact?.isLNURL ? InputTypes.BOLT11 : 'spark',
        data: { amountMsat: convertedSendAmount * 1000 },
      },
      swapPaymentQuote: Object.keys(swapQuote).length
        ? swapQuote
        : {
            amountIn:
              paymentMethod === 'BTC'
                ? convertedSendAmount
                : normalizeDisplayCurrency(displayCurrency) === 'USD'
                ? amountValue * Math.pow(10, 6)
                : satsToDollars(
                    convertedSendAmount,
                    poolInfoRef.currentPriceAInB,
                  )?.toFixed(2) * Math.pow(10, 6),
          },
    },
    convertedSendAmount,
    paymentFee: lnFeeEstimate ?? 0,
    determinePaymentMethod: paymentMethod,
    selectedPaymentMethod: paymentMethod,
    bitcoinBalance,
    dollarBalanceSat,
    dollarBalanceToken,
    min_usd_swap_amount,
    swapLimits,
    minLNURLSatAmount,
    maxLNURLSatAmount,
    isUsingLRC20: false,
    canEditAmount: true,
    t,
    masterInfoObject,
    fiatStats,
    inputDenomination: primaryDisplay.denomination,
    primaryDisplay,
    conversionFiatStats,
    sparkInformation,
    poolInfoRef,
  });

  useEffect(() => {
    lnurlParsedRef.current = null;
    appliedLocalCurrencyRef.current = null;
    setLnFeeEstimate(null);
    setLnurlPayData(null);
  }, [selectedContact?.uuid]);

  useEffect(() => {
    if (!selectedContact?.isLNURL || paymentType !== 'send') return;
    setLnFeeEstimate(null);
    setSwapQuote({});
    if (convertedSendAmount > 0) {
      const id = customUUID();
      quoteId.current = id;
      setIsLoading(true);
      debouncedEstimateLNURLFee(convertedSendAmount, id);
    }
  }, [
    convertedSendAmount,
    debouncedEstimateLNURLFee,
    paymentType,
    selectedContact?.isLNURL,
  ]);

  const canProceed =
    paymentType === 'request' ? !!amountValue : paymentValidation.canProceed;
  const lnurlBoundsReady = !selectedContact?.isLNURL || Boolean(lnurlPayData);
  const canReview =
    canProceed &&
    lnurlBoundsReady &&
    (!requiresContactDoc || Boolean(contactReceiveOption || prefetchedDoc));

  const handleDisplayCurrencySelect = useCallback(
    async code => {
      const response = await selectCurrency(code);
      if (response?.didWork) setAmountValue('');
    },
    [selectCurrency],
  );

  const setSelectedPaymentMethod = useCallback(nextMethod => {
    userChangedPaymentMethodRef.current = true;
    setPaymentMethod(prev => {
      if (prev !== nextMethod) {
        setAmountValue('');
      }
      return nextMethod;
    });
  }, []);

  const getValidationErrorResult = useCallback(() => {
    if (!canProceed) {
      return {
        didWork: false,
        errorMessage: paymentValidation.getErrorMessage(
          paymentValidation.primaryError,
        ),
      };
    }
    if (!isConnectedToTheInternet) {
      return { didWork: false, errorMessage: t('errormessages.nointernet') };
    }
    if (selectedContact?.isLNURL && !lnurlPayData) {
      return {
        didWork: false,
        errorMessage: t('errormessages.lnurlLimitsLoading'),
      };
    }
    if (requiresContactDoc && !contactReceiveOption && !prefetchedDoc) {
      return {
        didWork: false,
        errorMessage: t('errormessages.contactNotLoaded'),
      };
    }
    return { didWork: true };
  }, [
    canProceed,
    isConnectedToTheInternet,
    contactReceiveOption,
    lnurlPayData,
    paymentValidation,
    prefetchedDoc,
    requiresContactDoc,
    selectedContact?.isLNURL,
    t,
  ]);

  const buildBasePaymentObjects = useCallback(async () => {
    const sendingAmountMsat = convertedSendAmount * 1000;
    const isLNURL = selectedContact.isLNURL;
    const contactName = isLNURL
      ? selectedContact.name || selectedContact.receiveAddress.split('@')[0]
      : selectedContact.name || selectedContact.uniqueName;

    const myProfileMessage = descriptionValue
      ? descriptionValue
      : t('contacts.sendAndRequestPage.profileMessage', {
          name: contactName,
        });
    const payingContactMessage = descriptionValue
      ? descriptionValue
      : {
          usingTranslation: true,
          type: 'paid',
          name:
            globalContactsInformation.myProfile.name ||
            globalContactsInformation.myProfile.uniqueName,
        };

    const currentTime = getServerTime();
    const UUID = customUUID();
    const sendObject = {};

    if (globalContactsInformation.myProfile.uniqueName) {
      sendObject.senderProfileSnapshot = {
        uniqueName: globalContactsInformation.myProfile.uniqueName,
      };
    }

    const {
      receiveAddress,
      retrivedContact,
      didWork,
      error,
      formattedPayingContactMessage,
    } = await getReceiveAddressAndContactForContactsPayment({
      sendingAmountSat: convertedSendAmount,
      selectedContact,
      myProfileMessage,
      payingContactMessage,
      onlyGetContact: paymentType !== 'send',
      prefetchedDoc,
    });

    if (!didWork) {
      return {
        didWork: false,
        errorMessage: error,
        useTranslationString: true,
      };
    }

    sendObject.amountMsat = sendingAmountMsat;
    sendObject.uuid = UUID;
    sendObject.wasSeen = null;
    sendObject.didSend = null;
    sendObject.isRedeemed = null;

    return {
      didWork: true,
      contactName,
      currentTime,
      formattedPayingContactMessage,
      myProfileMessage,
      receiveAddress,
      retrivedContact,
      sendObject,
    };
  }, [
    convertedSendAmount,
    descriptionValue,
    getServerTime,
    globalContactsInformation,
    paymentType,
    prefetchedDoc,
    selectedContact,
    t,
  ]);

  const buildSendHandoff = useCallback(async () => {
    const validationResult = getValidationErrorResult();
    if (!validationResult.didWork) return validationResult;

    try {
      setIsLoading(true);
      const base = await buildBasePaymentObjects();
      if (!base.didWork) return base;

      const { sendObject } = base;
      sendObject.description = descriptionValue;
      sendObject.isRequest = false;
      sendObject.paymentDenomination = resolvedEndReceiveType;
      sendObject.amountDollars =
        resolvedEndReceiveType === 'USD'
          ? satsToDollars(
              convertedSendAmount,
              poolInfoRefSnapshotRef.current.currentPriceAInB,
            ).toFixed(2)
          : null;

      const snapshot = buildAmountSnapshot(amountValue);

      return {
        didWork: true,
        params: {
          btcAdress: base.receiveAddress,
          comingFromAccept: true,
          paymentDisplayCurrency: displayCurrency,
          paymentDisplayFiatStats: conversionFiatStats,
          enteredPaymentInfo: {
            fromContacts: true,
            amount: convertedSendAmount,
            displayAmount: snapshot.displayAmount,
            displayDenomination: snapshot.displayDenomination,
            description: base.myProfileMessage,
            endReceiveType: resolvedEndReceiveType,
            lnFeeEstimate: selectedContact?.isLNURL ? lnFeeEstimate : null,
            swapQuote: Object.keys(swapQuote).length ? swapQuote : null,
            lnInvoiceData: selectedContact?.isLNURL ? lnInvoiceData : null,
          },
          contactInfo: {
            imageData,
            name: base.contactName,
            isLNURLPayment: selectedContact?.isLNURL,
            payingContactMessage: base.formattedPayingContactMessage,
            uniqueName: base.retrivedContact?.contacts?.myProfile?.uniqueName,
            uuid: selectedContact.uuid,
          },
          preSelectedPaymentMethod: paymentMethod,
          selectedPaymentMethod: paymentMethod,
          fromPage: 'contacts',
          publishMessageFunc: txid =>
            publishMessage({
              toPubKey: selectedContact.uuid,
              fromPubKey: globalContactsInformation.myProfile.uuid,
              data: {
                ...sendObject,
                txid,
                name:
                  globalContactsInformation.myProfile.name ||
                  globalContactsInformation.myProfile.uniqueName,
              },
              globalContactsInformation,
              selectedContact,
              isLNURLPayment: selectedContact?.isLNURL,
              privateKey: contactsPrivateKey,
              retrivedContact: base.retrivedContact,
              currentTime: base.currentTime,
              masterInfoObject,
            }),
        },
      };
    } catch (err) {
      console.log(err, 'publishing message error');
      return {
        didWork: false,
        errorMessage: selectedContact.isLNURL
          ? t('errormessages.contactInvoiceGenerationError')
          : t('errormessages.invoiceRetrivalError'),
      };
    } finally {
      setIsLoading(false);
    }
    // buildAmountSnapshot is intentionally omitted from deps: it is recreated every
    // render (not memoized). Its inputs are already listed below (amountValue +
    // displayCurrency + conversionFiatStats), so the snapshot cannot go stale.
  }, [
    amountValue,
    buildBasePaymentObjects,
    contactsPrivateKey,
    conversionFiatStats,
    convertedSendAmount,
    descriptionValue,
    displayCurrency,
    getValidationErrorResult,
    globalContactsInformation,
    imageData,
    lnFeeEstimate,
    lnInvoiceData,
    masterInfoObject,
    paymentMethod,
    resolvedEndReceiveType,
    selectedContact,
    swapQuote,
    t,
  ]);

  const submitRequest = useCallback(async () => {
    const validationResult = getValidationErrorResult();
    if (!validationResult.didWork) return validationResult;

    try {
      setIsLoading(true);
      const base = await buildBasePaymentObjects();
      if (!base.didWork) return base;

      const { sendObject } = base;
      sendObject.amountDollars =
        paymentMethod === 'USD'
          ? satsToDollars(
              convertedSendAmount,
              poolInfoRefSnapshotRef.current.currentPriceAInB,
            ).toFixed(2)
          : null;
      sendObject.description = descriptionValue;
      sendObject.isRequest = true;
      sendObject.paymentDenomination = paymentMethod;

      await publishMessage({
        toPubKey: selectedContact.uuid,
        fromPubKey: globalContactsInformation.myProfile.uuid,
        data: sendObject,
        globalContactsInformation,
        selectedContact,
        isLNURLPayment: selectedContact?.isLNURL,
        privateKey: contactsPrivateKey,
        retrivedContact: base.retrivedContact,
        currentTime: base.currentTime,
        masterInfoObject,
      });

      return { didWork: true };
    } catch (err) {
      console.log(err, 'publishing message error');
      return {
        didWork: false,
        errorMessage: selectedContact.isLNURL
          ? t('errormessages.contactInvoiceGenerationError')
          : t('errormessages.invoiceRetrivalError'),
      };
    } finally {
      setIsLoading(false);
    }
  }, [
    buildBasePaymentObjects,
    contactsPrivateKey,
    convertedSendAmount,
    descriptionValue,
    getValidationErrorResult,
    globalContactsInformation,
    masterInfoObject,
    paymentMethod,
    selectedContact,
    t,
  ]);

  // True while the external display rate is still being resolved: either an LNURL
  // payRequest is being parsed (currency not yet known) or a fiat rate is being
  // fetched. Drives the currency-switch spinner so the auto-switch is visible.
  const isResolvingDisplayCurrency = isLoadingRate || isResolvingLnurlData;

  return {
    amountValue,
    setAmountValue,
    descriptionValue,
    setDescriptionValue,
    displayCurrency,
    isLoadingRate,
    isResolvingDisplayCurrency,
    handleDisplayCurrencySelect,
    paymentMethod,
    setSelectedPaymentMethod,
    resolvedEndReceiveType,
    prefetchedDoc,
    lnFeeEstimate,
    swapQuote,
    lnInvoiceData,
    isLoading,
    quoteId,
    lnurlParsedRef,
    paymentValidation,
    canProceed,
    canReview,
    primaryDisplay,
    conversionFiatStats,
    convertedSendAmount,
    convertSatsToDisplay,
    buildSendHandoff,
    submitRequest,
    balances: {
      bitcoinBalance,
      dollarBalanceSat,
      dollarBalanceToken,
      sparkBalance: sparkInformation.balance,
    },
    masterInfoObject,
    fiatStats,
  };
}
