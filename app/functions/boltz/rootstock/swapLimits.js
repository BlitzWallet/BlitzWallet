export const DEFAULT_ROOTSTOCK_SUBMARINE_PAIR = {
  limits: {
    minimal: 2500,
    maximal: 25000000,
    maximalZeroConf: 0,
  },
  fees: {
    percentage: 0.1,
    minerFees: 32,
  },
};

export function buildRootstockSubmarineLimits(submarineSwapStats, previousRsk) {
  const submarinePair =
    submarineSwapStats?.RBTC?.BTC || DEFAULT_ROOTSTOCK_SUBMARINE_PAIR;
  const minimal =
    submarinePair?.limits?.minimal ??
    previousRsk?.min ??
    DEFAULT_ROOTSTOCK_SUBMARINE_PAIR.limits.minimal;
  const maximal =
    submarinePair?.limits?.maximal ??
    previousRsk?.max ??
    DEFAULT_ROOTSTOCK_SUBMARINE_PAIR.limits.maximal;

  return {
    ...previousRsk,
    min: minimal,
    max: maximal,
    submarine: submarinePair,
  };
}

export function getRootstockSubmarinePair(limits) {
  return limits?.rsk?.submarine || DEFAULT_ROOTSTOCK_SUBMARINE_PAIR;
}

export function normalizeSubmarineFees(fees) {
  const minerFees = fees?.minerFees;
  const minerFeeSats =
    typeof minerFees === 'number'
      ? minerFees
      : Number(minerFees?.claim || 0) + Number(minerFees?.lockup || 0);

  return {
    percentage: Number(fees?.percentage || 0),
    minerFeeSats,
  };
}

export function calculateBufferedBoltzFeeSats({
  swapAmountSats,
  minerFeeSats,
  percentage,
  feeBufferMultiplier = 1.1,
}) {
  return Math.ceil(
    (Number(minerFeeSats) +
      Number(swapAmountSats) * (Number(percentage) / 100)) *
      feeBufferMultiplier,
  );
}

export function calculateInvoiceAmountAfterFees({
  availableSats,
  minSats,
  maxSats,
  minerFeeSats,
  percentage,
  feeBufferMultiplier = 1.1,
}) {
  const bufferedMinerFee = Number(minerFeeSats) * feeBufferMultiplier;
  const bufferedPercentageRate =
    (Number(percentage) / 100) * feeBufferMultiplier;
  const amountBeforeLimits = Math.floor(
    (Number(availableSats) - bufferedMinerFee) /
      (1 + bufferedPercentageRate),
  );

  if (amountBeforeLimits < Number(minSats)) {
    return 0n;
  }

  return BigInt(Math.min(amountBeforeLimits, Number(maxSats)));
}
