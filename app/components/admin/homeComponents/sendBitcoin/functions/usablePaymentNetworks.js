import {InputTypeVariant} from '@breeztech/react-native-breez-sdk-liquid';
import {DUST_LIMIT_FOR_LBTC_CHAIN_PAYMENTS} from '../../../../../constants/math';

export default function usablePaymentNetwork({
  liquidNodeInformation,
  nodeInformation,
  eCashBalance,
  masterInfoObject,
  convertedSendAmount,
  swapFee,
  minMaxLiquidSwapAmounts,
  isLiquidPayment,
  isLightningPayment,
  paymentInfo,
  usedEcashProofs,
  ecashWalletInformation,
  minSendAmount,
  maxSendAmount,
}) {
  try {
    const lnFee = convertedSendAmount * 0.005 + 4;
    const canUseLiquid = isLiquidPayment
      ? liquidNodeInformation.userBalance >= convertedSendAmount &&
        convertedSendAmount >= DUST_LIMIT_FOR_LBTC_CHAIN_PAYMENTS
      : isLightningPayment
      ? liquidNodeInformation.userBalance >= convertedSendAmount &&
        convertedSendAmount >= minSendAmount &&
        convertedSendAmount <= maxSendAmount
      : liquidNodeInformation.userBalance >= convertedSendAmount &&
        convertedSendAmount >= paymentInfo?.data?.limits?.minSat &&
        convertedSendAmount <= paymentInfo?.data?.limits?.maxSat;

    const canUseEcash =
      masterInfoObject.enabledEcash &&
      eCashBalance >= convertedSendAmount + lnFee &&
      paymentInfo?.type !== InputTypeVariant.BOLT12_OFFER;

    const canUseLightningWithLNEnabled = isLightningPayment
      ? nodeInformation.userBalance >= convertedSendAmount + lnFee
      : isLiquidPayment
      ? convertedSendAmount >= minSendAmount &&
        convertedSendAmount <= maxSendAmount &&
        nodeInformation.userBalance >= convertedSendAmount + lnFee
      : nodeInformation.userBalance >= convertedSendAmount &&
        convertedSendAmount >= paymentInfo?.data?.limits?.minSat &&
        convertedSendAmount <= paymentInfo?.data?.limits?.maxSat;

    const canUseLightningWithoutLNEnabled = isLightningPayment
      ? canUseEcash
      : isLiquidPayment
      ? convertedSendAmount >= minSendAmount &&
        convertedSendAmount <= maxSendAmount &&
        canUseEcash
      : false;

    const canUseLightning =
      paymentInfo?.type === InputTypeVariant.BOLT12_OFFER
        ? false
        : masterInfoObject.liquidWalletSettings.isLightningEnabled
        ? canUseLightningWithLNEnabled || canUseLightningWithoutLNEnabled
        : canUseLightningWithoutLNEnabled;

    return {canUseEcash, canUseLiquid, canUseLightning};
  } catch (err) {
    console.log('useable payment network error', err);
    return {canUseEcash: false, canUseLiquid: false, canUseLightning: false};
  }
}
