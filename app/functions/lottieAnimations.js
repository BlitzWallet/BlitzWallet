// Pre-baked themed Lottie animations. The per-theme variants of each animation
// are generated ahead of time (colors flattened per theme), so selecting one is
// a plain lookup — no runtime transformation or cloning anywhere.
// The un-suffixed source JSONs stay in assets as regeneration sources.
const confirmTxLight = require('../assets/CONFIRMTX_LIGHT.json');
const confirmTxDark = require('../assets/CONFIRMTX_DARK.json');
const confirmTxLightsOut = require('../assets/CONFIRMTX_LIGHTSOUT.json');
const errorTxLight = require('../assets/ERRORTX_LIGHT.json');
const errorTxDark = require('../assets/ERRORTX_DARK.json');
const errorTxLightsOut = require('../assets/ERRORTX_LIGHTSOUT.json');
const whiteMascotAnimation = require('../assets/MOSCATWALKING_WHITE.json');
const blueMascotAnimation = require('../assets/MOSCATWALKING_BLUE.json');

/**
 * Confirm-transaction checkmark animation.
 * @param {Boolean} theme - dark-mode flag from useGlobalThemeContext
 * @param {Boolean} darkModeType - lights-out flag from useGlobalThemeContext
 */
export function getConfirmTxAnimation(theme, darkModeType) {
  return theme
    ? darkModeType
      ? confirmTxLightsOut
      : confirmTxDark
    : confirmTxLight;
}

/**
 * Error/cross animation.
 * @param {Boolean} theme - dark-mode flag from useGlobalThemeContext
 * @param {Boolean} darkModeType - lights-out flag from useGlobalThemeContext
 */
export function getErrorTxAnimation(theme, darkModeType) {
  return theme ? (darkModeType ? errorTxLightsOut : errorTxDark) : errorTxLight;
}

/**
 * Mascot walking animation.
 * @param {Boolean} theme - dark-mode flag from useGlobalThemeContext
 *     (dark renders the white mascot, light renders the brand-blue one).
 */
export function getMascatWalkingAnimation(theme) {
  return theme ? whiteMascotAnimation : blueMascotAnimation;
}
