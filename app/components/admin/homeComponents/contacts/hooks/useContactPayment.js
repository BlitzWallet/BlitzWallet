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
import convertTextInputValue from '../../../../../functions/textInputConvertValue';
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
import usePaymentInputDisplay from '../../../../../hooks/usePaymentInputDisplay';
import useDebounce from '../../../../../hooks/useDebounce';
import getReceiveAddressAndContactForContactsPayment from '../internalComponents/getReceiveAddressAndKindForPayment';
import { resolveContactPaymentDefault } from './resolveContactPaymentDefault';

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
  const [userSetInputDenomination, setUserSetInputDenomination] =
    useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lnFeeEstimate, setLnFeeEstimate] = useState(null);
  const [swapQuote, setSwapQuote] = useState({});
  const [lnInvoiceData, setLnInvoiceData] = useState(null);
  const [prefetchedDoc, setPrefetchedDoc] = useState(null);
  const [contactReceiveOption, setContactReceiveOption] = useState(null);
  const lnurlParsedRef = useRef(null);
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
    setUserSetInputDenomination(null);
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

    const resolvedDefault = resolveContactPaymentDefault({
      paymentType,
      prefetchedDoc,
      contactReceiveOption,
      isLNURL: selectedContact?.isLNURL,
      masterInfoObject,
      dollarBalanceToken,
    });

    if (!userChangedPaymentMethodRef.current) {
      setPaymentMethod(resolvedDefault);
    }
  }, [
    dollarBalanceToken,
    explicitPaymentMethod,
    contactReceiveOption,
    lockInitialPaymentMethod,
    masterInfoObject,
    paymentType,
    prefetchedDoc,
    selectedContact?.isLNURL,
  ]);

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

  const inputDenomination = userSetInputDenomination
    ? userSetInputDenomination
    : paymentMethod === 'USD'
    ? 'fiat'
    : masterInfoObject.userBalanceDenomination !== 'fiat'
    ? 'sats'
    : 'fiat';

  const {
    primaryDisplay,
    secondaryDisplay,
    conversionFiatStats,
    convertDisplayToSats,
    convertSatsToDisplay,
    getNextDenomination,
    convertForToggle,
  } = usePaymentInputDisplay({
    paymentMode: paymentMethod,
    inputDenomination,
    fiatStats,
    usdFiatStats: { coin: 'USD', value: swapUSDPriceDollars },
    masterInfoObject,
  });

  const convertedSendAmount = convertDisplayToSats(amountValue);

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
                : inputDenomination === 'fiat'
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
    setLnFeeEstimate(null);
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
  const canReview =
    canProceed &&
    (!requiresContactDoc || Boolean(contactReceiveOption || prefetchedDoc));

  const handleDenominationToggle = useCallback(() => {
    const nextDenom = getNextDenomination();
    setUserSetInputDenomination(nextDenom);
    setAmountValue(convertForToggle(amountValue, convertTextInputValue));
  }, [amountValue, convertForToggle, getNextDenomination]);

  const setSelectedPaymentMethod = useCallback(nextMethod => {
    userChangedPaymentMethodRef.current = true;
    setPaymentMethod(prev => {
      if (prev !== nextMethod) {
        setAmountValue('');
        setUserSetInputDenomination(null);
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
    paymentValidation,
    prefetchedDoc,
    requiresContactDoc,
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

      return {
        didWork: true,
        params: {
          btcAdress: base.receiveAddress,
          comingFromAccept: true,
          enteredPaymentInfo: {
            fromContacts: true,
            amount: convertedSendAmount,
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
  }, [
    buildBasePaymentObjects,
    contactsPrivateKey,
    convertedSendAmount,
    descriptionValue,
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

  return {
    amountValue,
    setAmountValue,
    descriptionValue,
    setDescriptionValue,
    inputDenomination,
    userSetInputDenomination,
    setUserSetInputDenomination,
    handleDenominationToggle,
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
    secondaryDisplay,
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
