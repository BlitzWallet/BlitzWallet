import { getLNAddressForLiquidPayment } from './payments';
import displayCorrectDenomination from '../../../../../functions/displayCorrectDenomination';
import processBitcoinAddress from './processBitcoinAddress';
import processBolt11Invoice from './processBolt11Invoice';
import processLNUrlAuth from './processLNUrlAuth';
import processLNUrlPay from './processLNUrlPay';
import processLNUrlWithdraw from './processLNUrlWithdrawl';
import { crashlyticsLogReport } from '../../../../../functions/crashlyticsLogs';
import processSparkAddress from './processSparkAddress';
import { decodeBip21Address } from '../../../../../functions/bip21AddressFormmating';
import {
  handleCryptoQRAddress,
  isSupportedPNPQR,
} from '../../../../../functions/sendBitcoin/getMerchantAddress';
import { parseInput, InputTypes } from 'bitcoin-address-parser';
import { decodeSparkInvoice } from '../../../../../functions/spark/decodeInvoices';
import { deriveSparkAddress } from '../../../../../functions/gift/deriveGiftWallet';
import { getSingleContact } from '../../../../../../db';
import { getCachedProfileImage } from '../../../../../functions/cachedImage';

import { getPayLinkDoc, addDataToCollection } from '../../../../../../db';
import { receiveSparkLightningPayment } from '../../../../../functions/spark';
import { isBlitzLNURLAddress } from '../../../../../functions/lnurl';
import { handleBrantaVerification } from '../../../../../functions/branta/index';
import { Image as ExpoImage } from 'expo-image';
import getPhonePaymentAddress, {
  getPhonePaymentCandidates,
  getPhonePostProvider,
} from '../../../../../functions/sendBitcoin/getPhonePaymentAddress';
import { BTC_USD_SUFFIX_REGEX } from '../../../../../constants';

export default async function decodeSendAddress(props) {
  let {
    btcAdress,
    goBackFunction,
    setPaymentInfo,
    liquidNodeInformation,
    masterInfoObject,
    // webViewRef,
    navigate,
    // maxZeroConf,
    comingFromAccept,
    enteredPaymentInfo,
    setLoadingMessage,
    paymentInfo,
    parsedInvoice,
    fiatStats,
    fromPage,
    sparkInformation,
    seletctedToken,
    currentWalletMnemoinc,
    t,
    sendWebViewRequest,
    contactInfo,
    globalContactsInformation,
    accountMnemoinc,
    usablePaymentMethod,
    bitcoinBalance,
    dollarBalanceSat,
    convertedSendAmount,
    poolInfoRef,
    swapLimits,
    // usd_multiplier_coefiicent,
    min_usd_swap_amount,
    conversionFiatStats,
    primaryDisplay,
    contactsPrivateKey,
    publicKey,
  } = props;

  let paylinkPublishFunc = null;
  let resolvedBlitzContact = null;

  try {
    console.log(btcAdress, 'scanned address');
    if (typeof btcAdress !== 'string')
      throw new Error(
        t('wallet.sendPages.handlingAddressErrors.invalidFormat'),
      );

    if (btcAdress.toLowerCase().startsWith('paylink://')) {
      const payLinkId = btcAdress.slice('paylink://'.length);
      setLoadingMessage(t('wallet.payLinks.preparingPayment'));

      const result = await getPayLinkDoc(payLinkId);
      if (!result.didWork) {
        return goBackFunction(result.error || t('wallet.payLinks.notFound'));
      }

      const { amount, description, identityPubKey, isPaid } = result.data;
      if (isPaid) {
        return goBackFunction(t('wallet.payLinks.alreadyPaid'));
      }

      const lnInvoice = await receiveSparkLightningPayment({
        amountSats: amount,
        memo: description,
        mnemonic: accountMnemoinc,
        includeSparkAddress: false,
        receiverIdentityPubkey: identityPubKey,
      });

      if (!lnInvoice.didWork) {
        return goBackFunction(
          lnInvoice.error || t('wallet.payLinks.invoiceError'),
        );
      }

      btcAdress = lnInvoice.response.invoice.encodedInvoice;
      enteredPaymentInfo = {
        ...enteredPaymentInfo,
        fromContacts: true,
        amount,
        description,
      };
      paylinkPublishFunc = async () => {
        await addDataToCollection(
          { datePaid: Date.now(), isPaid: true },
          'blitzPaylinks',
          payLinkId,
        );
      };
    }

    // POST-based phone providers (e.g. Burundi) have no LNURL/lightning address;
    // they mint a BOLT11 invoice via a direct POST. Synthesize an LNURL_PAY-shaped
    // input so the rest of the pipeline (amount entry, fiat default, fee estimate,
    // send) is reused; the invoice fetch is overridden via data.postProvider.
    const postProvider = getPhonePostProvider(btcAdress);
    if (postProvider) {
      parsedInvoice = {
        type: InputTypes.LNURL_PAY,
        data: {
          address: `${postProvider.phone}@${postProvider.domain}`,
          minSendable: postProvider.minSendableSats * 1000,
          maxSendable: 100_000_000 * 1000, // effective cap is the user's balance
          postProvider,
        },
      };
    }

    // Phone-number payments (KE/ZM): convert the dialed number into a provider
    // lightning address. Use the preferred candidate (KE first) optimistically so
    // parseInput's own LNURL fetch validates it; probe further only if it fails.
    const phoneInput = btcAdress;
    const phoneCandidates = getPhonePaymentCandidates(phoneInput);
    const isPhonePayment = phoneCandidates.length > 0;
    if (isPhonePayment) btcAdress = phoneCandidates[0];

    if (
      !isPhonePayment &&
      (btcAdress.startsWith('@') || isBlitzLNURLAddress(btcAdress))
    ) {
      let username = '';

      if (isBlitzLNURLAddress(btcAdress)) {
        username = btcAdress.split('@')[0].trim();
      } else {
        username = btcAdress.startsWith('@')
          ? btcAdress.slice(1).trim()
          : btcAdress.trim();
      }

      if (
        !BTC_USD_SUFFIX_REGEX.test(username) ||
        BTC_USD_SUFFIX_REGEX.test(username)
      ) {
        if (!username) {
          return goBackFunction(
            t('wallet.sendPages.handlingAddressErrors.blitzUserNotFound'),
          );
        }
        const formatted = username.replace('-e40605', '');
        const [results] = await getSingleContact(formatted);

        if (!results)
          return goBackFunction(
            t('wallet.sendPages.handlingAddressErrors.blitzUserNotFound'),
          );

        const profile = results?.contacts?.myProfile;
        const sparkAddress = profile?.sparkAddress;
        const endReceiveType =
          results?.lnurlReceiveCurrency?.toLowerCase() === 'usd'
            ? 'USD'
            : 'BTC';

        if (!sparkAddress && btcAdress.startsWith('@')) {
          return goBackFunction(t('errormessages.legacyContactError'));
        }
        if (sparkAddress) {
          btcAdress = sparkAddress;
          const imageData = await getCachedProfileImage(profile.uuid).catch(
            () => null,
          );
          comingFromAccept = true;
          enteredPaymentInfo = {
            ...enteredPaymentInfo,
            fromContacts: true,
            endReceiveType,
          };
          resolvedBlitzContact = {
            name: profile.name || profile.uniqueName || '',
            uniqueName: profile.uniqueName || '',
            bio: profile.bio || '',
            uuid: profile.uuid,
            imageData,
          };
        }
      }
    }

    if (isSupportedPNPQR(btcAdress)) {
      crashlyticsLogReport('Handling crypto qr code');
      const myUniqueName = globalContactsInformation?.myProfile?.uniqueName;
      btcAdress = await handleCryptoQRAddress(
        btcAdress,
        getLNAddressForLiquidPayment,
        myUniqueName ? `${myUniqueName}@blitzwalletapp.com` : undefined,
      );
    }

    crashlyticsLogReport('Parsing bitcoin address input');

    if (
      btcAdress?.toLowerCase()?.startsWith('spark:') ||
      btcAdress?.toLowerCase()?.startsWith('sp1p') ||
      btcAdress?.toLowerCase()?.startsWith('spark1')
    ) {
      if (btcAdress.startsWith('spark:')) {
        const processedAddress = decodeBip21Address(btcAdress, 'spark');

        const decodeResponse = decodeSparkInvoice(processedAddress.address);

        const sparkAddress = deriveSparkAddress(
          Buffer.from(decodeResponse.identityPublicKey, 'hex'),
        );

        parsedInvoice = {
          type: 'Spark',
          address: {
            address: sparkAddress.address,
            message: processedAddress.options.message,
            label: processedAddress.options.label,
            network: 'Spark',
            expectedReceive: decodeResponse.paymentType,
            expectedToken: decodeResponse.tokenIdentifierBech32m,
            amount: processedAddress.options.amount,
          },
        };
      } else {
        const decodeResponse = decodeSparkInvoice(btcAdress);
        const sparkAddress = deriveSparkAddress(
          Buffer.from(decodeResponse.identityPublicKey, 'hex'),
        );

        parsedInvoice = {
          type: 'Spark',
          address: {
            address: sparkAddress.address,
            message: null,
            label: null,
            network: 'Spark',
            expectedReceive: decodeResponse.paymentType,
            expectedToken: decodeResponse.tokenIdentifierBech32m,
            amount: null,
          },
        };
      }
    }

    console.log(btcAdress, 'bitcoin address');

    let input;
    try {
      const chosenPath = parsedInvoice
        ? Promise.resolve(parsedInvoice)
        : parseInput(btcAdress);
      input = await chosenPath;
      if (!input) throw new Error('Invalid address provided');
    } catch (err) {
      if (isPhonePayment && phoneCandidates.length > 1) {
        const resolved = await getPhonePaymentAddress(phoneInput);
        btcAdress = resolved;
        try {
          input = await parseInput(resolved);
        } catch (err) {
          return goBackFunction(
            t('wallet.sendPages.handlingAddressErrors.parseError'),
          );
        }
      } else {
        console.log(err, 'parse error');
        return goBackFunction(
          t('wallet.sendPages.handlingAddressErrors.parseError'),
        );
      }
    }

    let processedPaymentInfo;
    let brantaVerification;
    try {
      let shouldRunBrantaVerification = false;
      if (input.type === InputTypes.BOLT11) shouldRunBrantaVerification = true;
      if (input.type === InputTypes.BITCOIN_ADDRESS) {
        try {
          const url = new URL(btcAdress);
          shouldRunBrantaVerification =
            url.searchParams.has('branta_id') &&
            url.searchParams.has('branta_secret');
        } catch {
          shouldRunBrantaVerification = false;
        }
      }

      const brantaVerificationPromise = shouldRunBrantaVerification
        ? Promise.race([
            handleBrantaVerification(btcAdress),
            new Promise(resolve => setTimeout(() => resolve(null), 2000)),
          ])
        : Promise.resolve(null);

      if (shouldRunBrantaVerification) {
        brantaVerificationPromise.then(brantaResult => {
          if (brantaResult && brantaResult.payments?.length) {
            const [details] = brantaResult.payments;
            if (details.platformLogoUrl) {
              ExpoImage.prefetch(details.platformLogoUrl).catch(err =>
                console.log('Error prefetching branta merchant logo', err),
              );
            }
          }
        });
      }

      [processedPaymentInfo, brantaVerification] = await Promise.all([
        processInputType(input, {
          fiatStats,
          liquidNodeInformation,
          masterInfoObject,
          navigate,
          // maxZeroConf,
          comingFromAccept,
          enteredPaymentInfo,
          setPaymentInfo,
          // webViewRef,
          setLoadingMessage,
          paymentInfo,
          fromPage,
          seletctedToken,
          currentWalletMnemoinc,
          t,
          sendWebViewRequest,
          contactInfo,
          sparkInformation,
          globalContactsInformation,
          accountMnemoinc,
          usablePaymentMethod,
          bitcoinBalance,
          dollarBalanceSat,
          convertedSendAmount,
          poolInfoRef,
          swapLimits,
          // usd_multiplier_coefiicent,
          min_usd_swap_amount,
          contactsPrivateKey,
          publicKey,
        }),
        brantaVerificationPromise,
      ]);
    } catch (err) {
      return goBackFunction(
        err.message ||
          t('wallet.sendPages.handlingAddressErrors.paymentProcessingError'),
      );
    }

    if (paylinkPublishFunc && processedPaymentInfo) {
      processedPaymentInfo = {
        ...processedPaymentInfo,
        publishMessageFunc: paylinkPublishFunc,
      };
    }

    if (brantaVerification && brantaVerification.payments?.length) {
      const [details] = brantaVerification.payments;
      const isHttpsUrl = val =>
        typeof val === 'string' && val.startsWith('https://');
      processedPaymentInfo = {
        ...processedPaymentInfo,
        isUsingBranta: true,
        brantaMerchantName: details.platform,
        brantaMerchantLogo: isHttpsUrl(details.platformLogoUrl)
          ? details.platformLogoUrl
          : undefined,
        verificationURL: isHttpsUrl(brantaVerification.verifyUrl)
          ? brantaVerification.verifyUrl
          : undefined,
      };
    }

    if (processedPaymentInfo) {
      // const isLRC20 =
      //   seletctedToken?.tokenMetadata?.tokenTicker !== undefined &&
      //   seletctedToken?.tokenMetadata?.tokenTicker !== 'Bitcoin';
      // // We are moving to confirm screen and need to check if we can send the payment.
      // // sendAmount for non-editable invoices is always in sats.
      // if (
      //   comingFromAccept &&
      //   !processedPaymentInfo.canEditPayment &&
      //   !isLRC20
      // ) {
      //   const fixedAmountSats = Number(processedPaymentInfo.sendAmount);
      //   if (fixedAmountSats > 0) {
      //     const totalCost =
      //       fixedAmountSats +
      //       (processedPaymentInfo.paymentFee || 0) +
      //       (processedPaymentInfo.supportFee || 0);

      //     const canAffordWithBTC = bitcoinBalance >= totalCost;
      //     const canAffordWithUSD = dollarBalanceSat >= totalCost;

      //     const canAfford =
      //       usablePaymentMethod === 'USD' ? canAffordWithUSD : canAffordWithBTC;

      //     if (!canAfford) {
      //       navigate.navigate('ErrorScreen', {
      //         errorMessage: t(
      //           'wallet.sendPages.handlingAddressErrors.tooLowSendingAmount',
      //           {
      //             amount: displayCorrectDenomination({
      //               amount: Math.max(
      //                 ((usablePaymentMethod === 'USD'
      //                   ? dollarBalanceSat
      //                   : bitcoinBalance) -
      //                   (processedPaymentInfo.paymentFee || 0) -
      //                   (processedPaymentInfo.supportFee || 0)) *
      //                   0.999,
      //                 0,
      //               ),
      //               masterInfoObject: {
      //                 ...masterInfoObject,
      //                 userBalanceDenomination:
      //                   primaryDisplay?.denomination ||
      //                   masterInfoObject.userBalanceDenomination,
      //               },
      //               fiatStats: conversionFiatStats || fiatStats,
      //               forceCurrency: conversionFiatStats
      //                 ? usablePaymentMethod === 'USD'
      //                   ? conversionFiatStats.coin
      //                   : null
      //                 : null,
      //             }),
      //           },
      //         ),
      //       });
      //       if (fromPage !== 'contacts') return;
      //     }
      //   }
      // }
      setPaymentInfo({
        ...processedPaymentInfo,
        decodedInput: input,
        ...(resolvedBlitzContact
          ? { blitzContactInfo: resolvedBlitzContact }
          : {}),
      });
    } else {
      if (input.type === InputTypes.LNURL_AUTH) return;

      if (input.type === InputTypes.LNURL_WITHDRAWL) {
        navigate.navigate('ErrorScreen', {
          errorMessage: t(
            'wallet.sendPages.handlingAddressErrors.lnurlWithdrawlSuccess',
          ),
          customNavigator: () =>
            navigate.popTo('HomeAdmin', { screen: 'home' }),
        });
        return;
      }
      return goBackFunction(
        t('wallet.sendPages.handlingAddressErrors.processInputError'),
      );
    }
  } catch (err) {
    console.error('Decoding send address error:', err);
    goBackFunction(
      err.message ||
        t('wallet.sendPages.handlingAddressErrors.unkonwDecodeError'),
    );
    return;
  }
}

async function processInputType(input, context) {
  const { setLoadingMessage, t } = context;
  setLoadingMessage(t('wallet.sendPages.handlingAddressErrors.invoiceDetails'));
  crashlyticsLogReport('Getting invoice detials');

  switch (input.type) {
    case InputTypes.BITCOIN_ADDRESS:
      return await processBitcoinAddress(input, context);

    case InputTypes.BOLT11:
      return await withTimeout(processBolt11Invoice(input, context), t);

    case InputTypes.LNURL_AUTH:
      return await processLNUrlAuth(input, context);

    case InputTypes.LNURL_PAY:
      return await withTimeout(processLNUrlPay(input, context), t);

    case InputTypes.LNURL_WITHDRAWL:
      return await processLNUrlWithdraw(input, context);

    // case LiquidTypeVarient.LIQUID_ADDRESS:
    // return processLiquidAddress(input, context);

    case 'lnUrlError':
      throw new Error(input.data.reason);

    case 'Spark':
      return await withTimeout(processSparkAddress(input, context), t);

    default:
      throw new Error(
        t('wallet.sendPages.handlingAddressErrors.invalidInputType'),
      );
  }
}

function withTimeout(promise, t) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(t('wallet.sendPages.handlingAddressErrors.timeoutError')),
          ),
        60000,
      ),
    ),
  ]);
}
