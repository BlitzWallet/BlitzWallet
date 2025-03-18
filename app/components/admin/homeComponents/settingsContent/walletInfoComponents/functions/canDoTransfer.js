export default function calculateCanDoTransfer({
  from,
  to,
  minMaxLiquidSwapAmounts,
  maxTransferAmount,
  convertedSendAmount,
}) {
  try {
    if (!from || !to) return false;
    if (from.toLowerCase() === 'lightning' || from.toLowerCase() === 'bank') {
      return (
        maxTransferAmount >= minMaxLiquidSwapAmounts.min &&
        convertedSendAmount <= maxTransferAmount &&
        convertedSendAmount >= minMaxLiquidSwapAmounts.min &&
        convertedSendAmount <= minMaxLiquidSwapAmounts.max
      );
    } else {
      //this is ecash now
      if (to.toLowerCase() === 'bank') {
        return (
          maxTransferAmount >= minMaxLiquidSwapAmounts.min &&
          convertedSendAmount <= maxTransferAmount &&
          convertedSendAmount >= minMaxLiquidSwapAmounts.min &&
          convertedSendAmount <= minMaxLiquidSwapAmounts.max
        );
      } else {
        return (
          !!convertedSendAmount && convertedSendAmount <= maxTransferAmount
        );
      }
    }
  } catch (err) {
    console.error('calculate max transfer amounts error', err);
    return false;
  }
}
