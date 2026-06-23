import {
  deriveLoginState,
  resolveLoginRoute,
} from '../../../app/functions/login/resolveLoginState';

// ---------------------------------------------------------------------------
// resolveLoginRoute — null / undefined / empty input (null-safety)
// ---------------------------------------------------------------------------

describe('resolveLoginRoute — null-safe input', () => {
  test('returns NO_ACCOUNT for null input', () => {
    expect(resolveLoginRoute(null)).toBe('NO_ACCOUNT');
  });

  test('returns NO_ACCOUNT for undefined input', () => {
    expect(resolveLoginRoute(undefined)).toBe('NO_ACCOUNT');
  });

  test('returns NO_ACCOUNT when called with no arguments', () => {
    expect(resolveLoginRoute()).toBe('NO_ACCOUNT');
  });
});

// ---------------------------------------------------------------------------
// deriveLoginState — no-account consistency (all flags false when !hasAccount)
// ---------------------------------------------------------------------------

describe('deriveLoginState — no-account consistency', () => {
  test('returns all-false flags with hasAccount:false when encryptedMnemonic is null', () => {
    expect(deriveLoginState({ encryptedMnemonic: null })).toEqual({
      hasAccount: false,
      isSecurityEnabled: false,
      isBiometricEnabled: false,
      isPinEnabled: false,
    });
  });

  test('returns all-false flags with hasAccount:false when called with no arguments', () => {
    expect(deriveLoginState()).toEqual({
      hasAccount: false,
      isSecurityEnabled: false,
      isBiometricEnabled: false,
      isPinEnabled: false,
    });
  });
});

// ---------------------------------------------------------------------------
// resolveLoginRoute — direct unit tests (4 branches)
// ---------------------------------------------------------------------------

describe('resolveLoginRoute', () => {
  test('returns NO_ACCOUNT when hasAccount is false', () => {
    expect(
      resolveLoginRoute({
        hasAccount: false,
        isSecurityEnabled: false,
        isPinEnabled: false,
        isBiometricEnabled: false,
      }),
    ).toBe('NO_ACCOUNT');
  });

  test('returns NO_LOGIN when account exists but security is disabled', () => {
    expect(
      resolveLoginRoute({
        hasAccount: true,
        isSecurityEnabled: false,
        isPinEnabled: false,
        isBiometricEnabled: false,
      }),
    ).toBe('NO_LOGIN');
  });

  test('returns BIOMETRIC when account exists, security enabled, biometric enabled', () => {
    expect(
      resolveLoginRoute({
        hasAccount: true,
        isSecurityEnabled: true,
        isPinEnabled: false,
        isBiometricEnabled: true,
      }),
    ).toBe('BIOMETRIC');
  });

  test('returns PIN when account exists, security enabled, biometric not enabled', () => {
    expect(
      resolveLoginRoute({
        hasAccount: true,
        isSecurityEnabled: true,
        isPinEnabled: true,
        isBiometricEnabled: false,
      }),
    ).toBe('PIN');
  });
});

// ---------------------------------------------------------------------------
// deriveLoginState — flag normalization (plain / pin / biometric)
// ---------------------------------------------------------------------------

describe('deriveLoginState flag normalization', () => {
  test('plain method produces isSecurityEnabled=false, isPinEnabled=false, isBiometricEnabled=false', () => {
    const state = deriveLoginState({
      encryptedMnemonic: 'c',
      loginModeType: 'plain',
    });
    expect(state.isSecurityEnabled).toBe(false);
    expect(state.isPinEnabled).toBe(false);
    expect(state.isBiometricEnabled).toBe(false);
  });

  test('pin method produces isSecurityEnabled=true, isPinEnabled=true, isBiometricEnabled=false', () => {
    const state = deriveLoginState({
      encryptedMnemonic: 'c',
      pinHash: 'h',
      loginModeType: 'pin',
    });
    expect(state.isSecurityEnabled).toBe(true);
    expect(state.isPinEnabled).toBe(true);
    expect(state.isBiometricEnabled).toBe(false);
  });

  test('biometric method produces isSecurityEnabled=true, isPinEnabled=false, isBiometricEnabled=true', () => {
    const state = deriveLoginState({
      encryptedMnemonic: 'c',
      biometricKey: 'k',
      loginModeType: 'biometric',
    });
    expect(state.isSecurityEnabled).toBe(true);
    expect(state.isPinEnabled).toBe(false);
    expect(state.isBiometricEnabled).toBe(true);
  });

  test('hasAccount is true when encryptedMnemonic is present', () => {
    expect(deriveLoginState({ encryptedMnemonic: 'abc' }).hasAccount).toBe(true);
  });

  test('hasAccount is false when encryptedMnemonic is null', () => {
    expect(deriveLoginState({ encryptedMnemonic: null }).hasAccount).toBe(false);
  });

  test('hasAccount is false when encryptedMnemonic is undefined', () => {
    expect(deriveLoginState({}).hasAccount).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// End-to-end: resolveLoginRoute(deriveLoginState(inputs))
// ---------------------------------------------------------------------------

describe('resolveLoginRoute(deriveLoginState(inputs)) — end-to-end table', () => {
  // Row 1: no account
  test('1 — no encrypted mnemonic → NO_ACCOUNT', () => {
    expect(
      resolveLoginRoute(deriveLoginState({ encryptedMnemonic: null })),
    ).toBe('NO_ACCOUNT');
  });

  // Row 2: pin mode, pinHash is array-like string
  test('2 — pin mode with array-string pinHash → PIN', () => {
    expect(
      resolveLoginRoute(
        deriveLoginState({
          encryptedMnemonic: 'c',
          pinHash: '[1,2,3,4]',
          loginModeType: 'pin',
        }),
      ),
    ).toBe('PIN');
  });

  // Row 3: pin mode, pinHash is hex string
  test('3 — pin mode with hex pinHash → PIN', () => {
    expect(
      resolveLoginRoute(
        deriveLoginState({
          encryptedMnemonic: 'c',
          pinHash: 'deadbeefhash',
          loginModeType: 'pin',
        }),
      ),
    ).toBe('PIN');
  });

  // Row 4: biometric with leftover pinHash
  test('4 — biometric mode with leftover pinHash → BIOMETRIC', () => {
    expect(
      resolveLoginRoute(
        deriveLoginState({
          encryptedMnemonic: 'c',
          pinHash: 'leftover',
          biometricKey: 'k',
          loginModeType: 'biometric',
        }),
      ),
    ).toBe('BIOMETRIC');
  });

  // Row 5: biometric, no pinHash
  test('5 — biometric mode, no pinHash → BIOMETRIC', () => {
    expect(
      resolveLoginRoute(
        deriveLoginState({
          encryptedMnemonic: 'c',
          biometricKey: 'k',
          loginModeType: 'biometric',
        }),
      ),
    ).toBe('BIOMETRIC');
  });

  // Row 6: plain mode
  test('6 — plain mode → NO_LOGIN', () => {
    expect(
      resolveLoginRoute(
        deriveLoginState({
          encryptedMnemonic: 'c',
          loginModeType: 'plain',
        }),
      ),
    ).toBe('NO_LOGIN');
  });

  // Row 7: biometric, keychain present, securitySettingsRaw=null (iOS reinstall)
  test('7 — biometric mode, no securitySettingsRaw (iOS reinstall) → BIOMETRIC', () => {
    expect(
      resolveLoginRoute(
        deriveLoginState({
          encryptedMnemonic: 'c',
          biometricKey: 'k',
          loginModeType: 'biometric',
          securitySettingsRaw: null,
        }),
      ),
    ).toBe('BIOMETRIC');
  });

  // Row 8: pin mode, no securitySettingsRaw (iOS reinstall)
  test('8 — pin mode, no securitySettingsRaw (iOS reinstall) → PIN', () => {
    expect(
      resolveLoginRoute(
        deriveLoginState({
          encryptedMnemonic: 'c',
          pinHash: 'h',
          loginModeType: 'pin',
          securitySettingsRaw: null,
        }),
      ),
    ).toBe('PIN');
  });

  // Row 9: no loginModeType, biometricKey present, securitySettingsRaw says biometric
  test('9 — no loginModeType, biometricKey present, AsyncStorage says biometric → BIOMETRIC', () => {
    expect(
      resolveLoginRoute(
        deriveLoginState({
          encryptedMnemonic: 'c',
          loginModeType: null,
          biometricKey: 'k',
          securitySettingsRaw:
            '{"isSecurityEnabled":true,"isPinEnabled":false,"isBiometricEnabled":true}',
        }),
      ),
    ).toBe('BIOMETRIC');
  });

  // Row 10: no loginModeType, no biometricKey, AsyncStorage says biometric → safety net downgrades to PIN
  test('10 — no loginModeType, no biometricKey, AsyncStorage says biometric → PIN (safety net)', () => {
    expect(
      resolveLoginRoute(
        deriveLoginState({
          encryptedMnemonic: 'c',
          loginModeType: null,
          biometricKey: null,
          securitySettingsRaw:
            '{"isSecurityEnabled":true,"isPinEnabled":false,"isBiometricEnabled":true}',
        }),
      ),
    ).toBe('PIN');
  });

  // Row 11: loginModeType=biometric, biometricKey present, securitySettingsRaw is corrupt JSON
  test('11 — biometric mode, corrupt JSON ignored → BIOMETRIC', () => {
    expect(
      resolveLoginRoute(
        deriveLoginState({
          encryptedMnemonic: 'c',
          loginModeType: 'biometric',
          biometricKey: 'k',
          securitySettingsRaw: '{bad',
        }),
      ),
    ).toBe('BIOMETRIC');
  });

  // Row 12: loginModeType=biometric (keychain wins over AsyncStorage saying PIN)
  test('12 — keychain says biometric, AsyncStorage says pin → BIOMETRIC (keychain wins)', () => {
    expect(
      resolveLoginRoute(
        deriveLoginState({
          encryptedMnemonic: 'c',
          loginModeType: 'biometric',
          biometricKey: 'k',
          securitySettingsRaw:
            '{"isSecurityEnabled":true,"isPinEnabled":true,"isBiometricEnabled":false}',
        }),
      ),
    ).toBe('BIOMETRIC');
  });

  // Row 13: no loginModeType, no biometricKey, AsyncStorage says isSecurityEnabled=false
  test('13 — no loginModeType, AsyncStorage says security disabled → NO_LOGIN', () => {
    expect(
      resolveLoginRoute(
        deriveLoginState({
          encryptedMnemonic: 'c',
          loginModeType: null,
          securitySettingsRaw: '{"isSecurityEnabled":false}',
        }),
      ),
    ).toBe('NO_LOGIN');
  });
});
