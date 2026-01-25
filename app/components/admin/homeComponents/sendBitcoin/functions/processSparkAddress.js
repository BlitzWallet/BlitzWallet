import { SATSPERBITCOIN, USDB_TOKEN_ID } from '../../../../../constants';
import { crashlyticsLogReport } from '../../../../../functions/crashlyticsLogs';
import {
  BTC_ASSET_ADDRESS,
  dollarsToSats,
  satsToDollars,
  simulateSwap,
  USD_ASSET_ADDRESS,
} from '../../../../../functions/spark/flashnet';

import { sparkPaymenWrapper } from '../../../../../functions/spark/payments';

export default async function processSparkAddress(input, context) {
  const {
    masterInfoObject,
    comingFromAccept,
    enteredPaymentInfo,
    paymentInfo,
    fiatStats,
    seletctedToken,
    currentWalletMnemoinc,
    sendWebViewRequest,
    sparkInformation,
    t,
    usablePaymentMethod,
    bitcoinBalance,
    dollarBalanceSat,
    convertedSendAmount,
    poolInfoRef,
    swapLimits,
    // usd_multiplier_coefiicent,
    min_usd_swap_amount,
  } = context;

  crashlyticsLogReport('Handling decode spark payment');
  if (
    input.address?.address?.toLowerCase() ===
    sparkInformation.sparkAddress?.toLowerCase()
  ) {
    throw new Error(
      t('wallet.sendPages.handlingAddressErrors.payingToSameAddress', {
        addressType: 'Spark',
      }),
    );
  }

  const isLRC20 =
    seletctedToken?.tokenMetadata?.tokenTicker !== undefined &&
    seletctedToken?.tokenMetadata?.tokenTicker !== 'Bitcoin';

  let addressInfo = JSON.parse(JSON.stringify(input?.address));

  if (comingFromAccept) {
    addressInfo.amount = enteredPaymentInfo.amount;
    addressInfo.label =
      enteredPaymentInfo.description || input?.address?.label || '';
    addressInfo.message =
      enteredPaymentInfo.description || input?.address?.message || '';
    addressInfo.isBip21 = true;
    if (enteredPaymentInfo.fromContacts) {
      addressInfo.expectedReceive =
        enteredPaymentInfo.endReceiveType === 'USD' ? 'tokens' : 'sats';
      addressInfo.expectedToken =
        enteredPaymentInfo.endReceiveType === 'USD' ? USDB_TOKEN_ID : null;
    }
  }

  const enteredAmount = enteredPaymentInfo.amount
    ? enteredPaymentInfo.amount * 1000
    : convertedSendAmount * 1000;

  const amountMsat = isLRC20
    ? addressInfo.amount || 0
    : comingFromAccept || paymentInfo.sendAmount
    ? enteredAmount
    : addressInfo.amount * 1000;

  const fiatValue =
    !!amountMsat &&
    Number(amountMsat / 1000) / (SATSPERBITCOIN / (fiatStats?.value || 65000));

  let swapPaymentQuote = {};

  if (amountMsat) {
    if (isLRC20) {
      // no fee for token payments
      addressInfo.paymentFee = 0;
      addressInfo.supportFee = 0;
    } else {
      // Determine which operations are needed
      const needUsdPath =
        usablePaymentMethod === 'USD' ||
        ((!usablePaymentMethod || usablePaymentMethod === 'user-choice') &&
          dollarBalanceSat >= amountMsat / 1000);
      const needBtcPath =
        usablePaymentMethod === 'BTC' ||
        ((!usablePaymentMethod || usablePaymentMethod === 'user-choice') &&
          bitcoinBalance >= amountMsat / 1000);

      // Determine if non-swap fallbacks are available
      const canDoDirectBtcPayment =
        needBtcPath &&
        !(
          addressInfo.expectedReceive === 'tokens' &&
          addressInfo.expectedToken === USDB_TOKEN_ID
        );
      const canDoDirectUsdPayment =
        needUsdPath &&
        addressInfo.expectedReceive === 'tokens' &&
        (!addressInfo.expectedToken ||
          addressInfo.expectedToken === USDB_TOKEN_ID);
      // Check if we have cached values
      const hasCachedQuote =
        typeof paymentInfo.swapPaymentQuote === 'object' &&
        Object.keys(paymentInfo.swapPaymentQuote).length;
      const hasCachedFee = !!paymentInfo.paymentFee;

      // Determine what operations each path needs
      const usdNeedsSwap =
        needUsdPath &&
        !hasCachedQuote &&
        !(
          addressInfo.expectedReceive === 'tokens' &&
          (!addressInfo.expectedToken ||
            addressInfo.expectedToken === USDB_TOKEN_ID)
        ) &&
        amountMsat / 1000 >= min_usd_swap_amount;

      const btcNeedsSwap =
        needBtcPath &&
        !hasCachedQuote &&
        addressInfo.expectedReceive === 'tokens' &&
        addressInfo.expectedToken === USDB_TOKEN_ID &&
        amountMsat / 1000 >= swapLimits.bitcoin;

      const btcNeedsFee =
        needBtcPath &&
        !hasCachedFee &&
        !btcNeedsSwap &&
        !(
          addressInfo.expectedReceive === 'tokens' &&
          addressInfo.expectedToken === USDB_TOKEN_ID
        );

      // Build parallel operations
      const promises = [];
      const operations = { usdSwap: -1, btcSwap: -1, btcFee: -1 };

      if (usdNeedsSwap) {
        const satAmount = amountMsat / 1000;

        const amountToSendConversion = satsToDollars(
          satAmount,
          poolInfoRef.currentPriceAInB,
        );
        const usdBalanceConversion = satsToDollars(
          dollarBalanceSat,
          poolInfoRef.currentPriceAInB,
        );
        // Make sure with the 5% buffer we don't go over sending amount and cause a failure on our side
        const maxAmount = Math.min(
          amountToSendConversion,
          usdBalanceConversion,
        );

        const usdAmount = Math.ceil(maxAmount.toFixed(2) * Math.pow(10, 6));

        operations.usdSwap = promises.length;
        promises.push(
          simulateSwap(currentWalletMnemoinc, {
            poolId: poolInfoRef.lpPublicKey,
            assetInAddress: USD_ASSET_ADDRESS,
            assetOutAddress: BTC_ASSET_ADDRESS,
            amountIn: usdAmount,
          }).then(result => ({ type: 'usdSwap', result, usdAmount })),
        );
      }

      if (btcNeedsSwap) {
        const satAmount = amountMsat / 1000;

        operations.btcSwap = promises.length;
        promises.push(
          simulateSwap(currentWalletMnemoinc, {
            poolId: poolInfoRef.lpPublicKey,
            assetInAddress: BTC_ASSET_ADDRESS,
            assetOutAddress: USD_ASSET_ADDRESS,
            amountIn: satAmount,
          }).then(result => ({ type: 'btcSwap', result, satAmount })),
        );
      }

      if (btcNeedsFee) {
        operations.btcFee = promises.length;
        promises.push(
          sparkPaymenWrapper({
            getFee: true,
            address: addressInfo.address,
            paymentType: isLRC20 ? 'lrc20' : 'spark',
            amountSats: Math.round(amountMsat / (isLRC20 ? 1 : 1000)),
            masterInfoObject,
            mnemonic: currentWalletMnemoinc,
            sendWebViewRequest,
          }).then(result => ({ type: 'btcFee', result })),
        );
      }

      // Execute all operations in parallel
      let results = {};
      if (promises.length > 0) {
        const parallelResults = await Promise.all(promises);
        parallelResults.forEach(item => {
          results[item.type] = item;
        });
      }

      // Process USD path
      if (needUsdPath) {
        // If we are using USD
        if (
          addressInfo.expectedReceive === 'tokens' &&
          (!addressInfo.expectedToken ||
            addressInfo.expectedToken === USDB_TOKEN_ID)
        ) {
          addressInfo.paymentFee = 0;
          addressInfo.supportFee = 0;
        } else {
          // If we need to swap from USD -> BTC
          if (hasCachedQuote) {
            swapPaymentQuote = paymentInfo.swapPaymentQuote;
            addressInfo.paymentFee = paymentInfo.paymentFee;
            addressInfo.supportFee = paymentInfo.supportFee;
          } else if (results.usdSwap) {
            const { result, usdAmount } = results.usdSwap;
            // Only throw if USD swap failed AND we don't have a BTC fallback
            if (!result.didWork && !canDoDirectBtcPayment)
              throw new Error(result.error);

            if (result.didWork) {
              const fees = result.simulation.feePaidAssetIn;
              const satFee = dollarsToSats(
                fees / 1000000,
                poolInfoRef.currentPriceAInB,
              );

              addressInfo.paymentFee = satFee;
              addressInfo.supportFee = 0;
              swapPaymentQuote = {
                warn: parseFloat(result.simulation.priceImpact) > 3,
                poolId: poolInfoRef.lpPublicKey,
                assetInAddress: USD_ASSET_ADDRESS,
                assetOutAddress: BTC_ASSET_ADDRESS,
                amountIn: usdAmount,
                satFee,
                bitcoinBalance,
                dollarBalanceSat,
              };
            }
          }
        }
      }

      // Process BTC path
      if (needBtcPath) {
        // If we need to swap from BTC -> USD
        if (
          addressInfo.expectedReceive === 'tokens' &&
          addressInfo.expectedToken === USDB_TOKEN_ID
        ) {
          if (hasCachedQuote) {
            swapPaymentQuote = paymentInfo.swapPaymentQuote;
            addressInfo.paymentFee = paymentInfo.paymentFee;
            addressInfo.supportFee = paymentInfo.supportFee;
          } else if (results.btcSwap) {
            const { result, satAmount } = results.btcSwap;

            // Only throw if BTC swap failed AND we don't have a USD fallback
            if (!result.didWork && !canDoDirectUsdPayment)
              throw new Error(result.error);

            if (result.didWork) {
              const fees = Number(result.simulation.feePaidAssetIn);
              const satFee = fees;

              addressInfo.paymentFee = fees;
              addressInfo.supportFee = 0;
              swapPaymentQuote = {
                warn: parseFloat(result.simulation.priceImpact) > 3,
                poolId: poolInfoRef.lpPublicKey,
                assetInAddress: BTC_ASSET_ADDRESS,
                assetOutAddress: USD_ASSET_ADDRESS,
                amountIn: satAmount,
                satFee,
                bitcoinBalance,
                dollarBalanceSat,
              };
            }
          }
        } else {
          // If we are just using BTC
          if (hasCachedFee) {
            addressInfo.paymentFee = paymentInfo.paymentFee;
            addressInfo.supportFee = paymentInfo.supportFee;
          } else if (results.btcFee) {
            const { result } = results.btcFee;
            if (!result.didWork) throw new Error(result.error);

            addressInfo.paymentFee = result.fee;
            addressInfo.supportFee = result.supportFee;
          }
        }
      }
    }
  }

  const displayAmount = enteredPaymentInfo?.fromContacts
    ? enteredPaymentInfo.amount
    : masterInfoObject.userBalanceDenomination != 'fiat'
    ? `${Math.round(amountMsat / 1000)}`
    : fiatValue;

  return {
    data: addressInfo,
    type: 'spark',
    paymentNetwork: 'spark',
    paymentFee: addressInfo.paymentFee,
    supportFee: addressInfo.supportFee,
    swapPaymentQuote,
    sendAmount: !amountMsat ? '' : isLRC20 ? amountMsat : `${displayAmount}`,
    canEditPayment: comingFromAccept ? false : !amountMsat,
  };
}
