// Pure math utilities for Flashnet swap amount calculations.
// No SDK imports — safe to test in Jest without mocking native modules.

export const BTC_ASSET_ADDRESS =
  '020202020202020202020202020202020202020202020202020202020202020202';
export const USD_ASSET_ADDRESS =
  '3206c93b24a4d18ea19d0a9a213204af2c7e74a6d16c7535cc5d33eca4ad1eca';
export const FLASHNET_POOL_IDENTITY_KEY =
  '02894808873b896e21d29856a6d7bb346fb13c019739adb9bf0b6a8b7e28da53da';

export const DEFAULT_SLIPPAGE_BPS = 100; // 1%
export const SEND_AMOUNT_INCREASE_BUFFER = 1.01; // 1%
export const DEFAULT_MAX_SLIPPAGE_BPS = 300; // 3% for lightning payments
export const INTEGRATOR_FEE = 0.005; // .5%
export const INTEGRATOR_FEE_BPS = 50;

/**
 * Convert sats to dollars.
 * @param {string|number|bigint} sats
 * @param {string|number|bigint} currentPriceAinB - BTC price in dollars (microdollar units)
 * @returns {number} Amount in dollars
 */
export function satsToDollars(sats, currentPriceAinB) {
  try {
    const DOLLAR_DECIMALS = 1_000_000;
    const numSats = typeof sats === 'bigint' ? Number(sats) : Number(sats || 0);
    const numPrice =
      typeof currentPriceAinB === 'bigint'
        ? Number(currentPriceAinB)
        : Number(currentPriceAinB || 0);
    if (isNaN(numSats) || isNaN(numPrice) || numPrice === 0) return 0;
    return (numSats * numPrice) / DOLLAR_DECIMALS;
  } catch (error) {
    console.error('Error in satsToDollars:', error, { sats, currentPriceAinB });
    return 0;
  }
}

/**
 * Convert dollars to sats.
 * @param {string|number|bigint} dollars
 * @param {string|number|bigint} currentPriceAinB - BTC price in dollars (microdollar units)
 * @returns {number} Amount in sats
 */
export function dollarsToSats(dollars, currentPriceAinB) {
  try {
    const DOLLAR_DECIMALS = 1_000_000;
    const numDollars =
      typeof dollars === 'bigint' ? Number(dollars) : Number(dollars || 0);
    const numPrice =
      typeof currentPriceAinB === 'bigint'
        ? Number(currentPriceAinB)
        : Number(currentPriceAinB || 0);
    if (isNaN(numDollars) || isNaN(numPrice) || numPrice === 0) return 0;
    return (numDollars * DOLLAR_DECIMALS) / numPrice;
  } catch (error) {
    console.error('Error in dollarsToSats:', error, {
      dollars,
      currentPriceAinB,
    });
    return 0;
  }
}

/**
 * Calculate the final amountIn for a flashnet swap execution.
 * Applies a buffer and caps to available balance.
 * Always errs toward providing more input to avoid falling short of target output.
 * Especially important when the swap output funds a subsequent payment.
 *
 * @param {number}  baseAmountIn     - In smallest units: sats (BTC path) or microdollars (USD path)
 * @param {boolean} isUsdAssetIn     - true = USD→BTC swap, false = BTC→USD swap
 * @param {number}  [maxBalance]     - Balance cap in same units as baseAmountIn (required for BTC
 *                                     path; USD path can use dollarBalanceSat + currentPriceAInB)
 * @param {number}  [dollarBalanceSat]  - USD balance expressed in sats (USD path precision cap)
 * @param {number}  [currentPriceAInB] - Pool price, required when dollarBalanceSat is provided
 * @param {number}  [bufferMultiplier] - Overshoot factor; defaults to SEND_AMOUNT_INCREASE_BUFFER
 * @returns {number} Integer amountIn ready for executeSwap
 */
export function calculateFlashnetAmountIn({
  baseAmountIn,
  isUsdAssetIn,
  maxBalance,
  dollarBalanceSat,
  currentPriceAInB,
  bufferMultiplier = SEND_AMOUNT_INCREASE_BUFFER,
}) {
  if (isUsdAssetIn) {
    // Work in dollars for cent-level precision, then convert back to microdollars.
    const bufferedDollars = (baseAmountIn * bufferMultiplier) / Math.pow(10, 6);
    const balanceDollars =
      dollarBalanceSat != null && currentPriceAInB != null
        ? satsToDollars(dollarBalanceSat, currentPriceAInB)
        : maxBalance / Math.pow(10, 6);
    const cappedDollars = Math.min(bufferedDollars, balanceDollars);
    return Math.round(parseFloat(cappedDollars) * Math.pow(10, 6));
  }
  // BTC path: stay in sats
  return Math.round(Math.min(baseAmountIn * bufferMultiplier, maxBalance));
}
