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
}) {
  try {
    const lnFee = convertedSendAmount * 0.005 + 4;
    const canUseLiquid = isLiquidPayment
      ? liquidNodeInformation.userBalance >= convertedSendAmount &&
        convertedSendAmount >= DUST_LIMIT_FOR_LBTC_CHAIN_PAYMENTS
      : isLightningPayment
      ? liquidNodeInformation.userBalance >= convertedSendAmount &&
        convertedSendAmount >= minMaxLiquidSwapAmounts.min &&
        convertedSendAmount <= minMaxLiquidSwapAmounts.max
      : liquidNodeInformation.userBalance >= convertedSendAmount &&
        convertedSendAmount >= paymentInfo?.data?.limits?.minSat &&
        convertedSendAmount <= paymentInfo?.data?.limits?.maxSat;

    const canUseEcash =
      !masterInfoObject.liquidWalletSettings.isLightningEnabled &&
      masterInfoObject.enabledEcash &&
      eCashBalance >= convertedSendAmount + lnFee;

    const canUseLightningWithLNEnabled = isLightningPayment
      ? nodeInformation.userBalance >= convertedSendAmount + lnFee
      : isLiquidPayment
      ? convertedSendAmount >= minMaxLiquidSwapAmounts.min &&
        convertedSendAmount <= minMaxLiquidSwapAmounts.max &&
        nodeInformation.userBalance >= convertedSendAmount + lnFee
      : nodeInformation.userBalance >= convertedSendAmount &&
        convertedSendAmount >= paymentInfo?.data?.limits?.minSat &&
        convertedSendAmount <= paymentInfo?.data?.limits?.maxSat;

    const canUseLightningWithoutLNEnabled = isLightningPayment
      ? canUseEcash
      : isLiquidPayment
      ? convertedSendAmount >= minMaxLiquidSwapAmounts.min &&
        convertedSendAmount <= minMaxLiquidSwapAmounts.max &&
        canUseEcash
      : false;

    const canUseLightning = masterInfoObject.liquidWalletSettings
      .isLightningEnabled
      ? canUseLightningWithLNEnabled
      : canUseLightningWithoutLNEnabled;

    return {canUseEcash, canUseLiquid, canUseLightning};
  } catch (err) {
    console.log('useable payment network error', err);
    return {canUseEcash: false, canUseLiquid: false, canUseLightning: false};
  }
}
