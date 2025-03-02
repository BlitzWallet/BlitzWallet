import {InputTypeVariant} from '@breeztech/react-native-breez-sdk';
import {
  DUST_LIMIT_FOR_LBTC_CHAIN_PAYMENTS,
  LIGHTNINGAMOUNTBUFFER,
  LIQUIDAMOUTBUFFER,
} from '../../../../../constants/math';
import {calculateEcashFees} from '../../../../../functions/eCash/wallet';

export default function usablePaymentNetwork({
  liquidNodeInformation,
  nodeInformation,
  eCashBalance,
  masterInfoObject,
  convertedSendAmount,
  liquidTxFee,
  swapFee,
  minMaxLiquidSwapAmounts,
  isLiquidPayment,
  isLightningPayment,
  paymentInfo,
  lightningFee,
  usedEcashProofs,
  ecashWalletInformation,
}) {
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
    nodeInformation.userBalance === 0 &&
    masterInfoObject.enabledEcash &&
    eCashBalance >=
      convertedSendAmount +
        calculateEcashFees(ecashWalletInformation.mintURL, usedEcashProofs) &&
    (!paymentInfo.canEditPayment ||
      paymentInfo?.type === InputTypeVariant.LN_URL_PAY);

  const canUseLightning = masterInfoObject.liquidWalletSettings
    .isLightningEnabled
    ? isLightningPayment
      ? canUseEcash || nodeInformation.userBalance >= convertedSendAmount
      : isLiquidPayment
      ? convertedSendAmount >= minMaxLiquidSwapAmounts.min &&
        convertedSendAmount <= minMaxLiquidSwapAmounts.max &&
        nodeInformation.userBalance >=
          convertedSendAmount + swapFee + convertedSendAmount * 0.01
      : nodeInformation.userBalance >= convertedSendAmount &&
        convertedSendAmount >= paymentInfo?.data?.limits?.minSat &&
        convertedSendAmount <= paymentInfo?.data?.limits?.maxSat
    : isLiquidPayment
    ? false
    : canUseEcash;

  return {canUseEcash, canUseLiquid, canUseLightning};
}
