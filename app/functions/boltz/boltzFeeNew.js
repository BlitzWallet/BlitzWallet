import {BLITZ_RECEIVE_FEE, BLITZ_SEND_FEE} from '../../constants';

export function calculateBoltzFeeNew(swapAmountSats, swapType, swapInfo) {
  try {
    const fee =
      swapType === 'liquid-ln'
        ? Math.round(
            swapInfo.fees.minerFees +
              Math.ceil(
                swapAmountSats *
                  ((swapInfo.fees.percentage + BLITZ_SEND_FEE) / 100),
              ),
          )
        : Math.round(
            swapInfo.fees.minerFees.claim +
              swapInfo.fees.minerFees.lockup +
              Math.ceil(
                swapAmountSats *
                  ((swapInfo.fees.percentage + BLITZ_RECEIVE_FEE) / 100),
              ),
          );

    return fee;
  } catch (err) {
    console.log('Calculate boltz fee new error', err);
    return 50;
  }
}
