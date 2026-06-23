/**
 * Derives login state flags from already-extracted plain values.
 * Pure function — no I/O, no async, no React.
 *
 * @param {object} inputs
 * @param {string|null|undefined} inputs.encryptedMnemonic
 * @param {string|null|undefined} inputs.pinHash
 * @param {string|null|undefined} inputs.biometricKey
 * @param {'plain'|'pin'|'biometric'|null|undefined} inputs.loginModeType
 * @param {string|null|undefined} inputs.securitySettingsRaw  - raw JSON string
 * @returns {{ hasAccount: boolean, isSecurityEnabled: boolean, isPinEnabled: boolean, isBiometricEnabled: boolean }}
 */
export const deriveLoginState = ({
  encryptedMnemonic,
  pinHash: _pinHash,
  biometricKey,
  loginModeType,
  securitySettingsRaw,
} = {}) => {
  const hasAccount = !!encryptedMnemonic;

  if (!hasAccount) {
    return {
      hasAccount: false,
      isSecurityEnabled: false,
      isBiometricEnabled: false,
      isPinEnabled: false,
    };
  }

  // 1. Determine security method with keychain-authoritative precedence.
  let method;

  if (
    loginModeType === 'plain' ||
    loginModeType === 'pin' ||
    loginModeType === 'biometric'
  ) {
    method = loginModeType;
  } else if (biometricKey) {
    method = 'biometric';
  } else {
    // Try to derive from AsyncStorage JSON.
    let parsed = null;
    if (securitySettingsRaw) {
      try {
        const candidate = JSON.parse(securitySettingsRaw);
        if (candidate && typeof candidate === 'object') {
          parsed = candidate;
        }
      } catch (_e) {
        // Invalid JSON — treat as absent.
      }
    }

    if (parsed !== null) {
      if (parsed.isSecurityEnabled === false) {
        method = 'plain';
      } else if (parsed.isBiometricEnabled) {
        method = 'biometric';
      } else {
        method = 'pin';
      }
    } else {
      method = 'pin';
    }
  }

  // 2. Safety net: biometric is only valid if the key is actually present.
  if (method === 'biometric' && !biometricKey && loginModeType !== 'biometric') {
    method = 'pin';
  }

  // 3. Normalize method → boolean flags.
  if (method === 'plain') {
    return {
      hasAccount,
      isSecurityEnabled: false,
      isPinEnabled: false,
      isBiometricEnabled: false,
    };
  }

  if (method === 'biometric') {
    return {
      hasAccount,
      isSecurityEnabled: true,
      isPinEnabled: false,
      isBiometricEnabled: true,
    };
  }

  // 'pin' (default) — isPinEnabled not needed for routing, included for completeness.
  return {
    hasAccount,
    isSecurityEnabled: true,
    isPinEnabled: true,
    isBiometricEnabled: false,
  };
};

/**
 * Resolves the login route from derived login state.
 * Pure function — no I/O, no async, no React.
 *
 * @param {{ hasAccount: boolean, isSecurityEnabled: boolean, isPinEnabled: boolean, isBiometricEnabled: boolean }} state
 * @returns {'NO_ACCOUNT'|'NO_LOGIN'|'BIOMETRIC'|'PIN'}
 */
export const resolveLoginRoute = (state = {}) => {
  const { hasAccount, isSecurityEnabled, isBiometricEnabled } = state ?? {};
  if (!hasAccount) return 'NO_ACCOUNT';
  if (!isSecurityEnabled) return 'NO_LOGIN';
  if (isBiometricEnabled) return 'BIOMETRIC';
  // PIN is the residual case — isPinEnabled not needed for routing.
  return 'PIN';
};
