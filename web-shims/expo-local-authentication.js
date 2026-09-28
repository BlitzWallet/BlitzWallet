// Web shim for expo-local-authentication: browsers have no biometric keystore
// we can gate the mnemonic behind, so report "no hardware". The UI already
// handles devices without biometrics (falls back to the password/PIN path).
export async function hasHardwareAsync() {
  return false;
}
export async function isEnrolledAsync() {
  return false;
}
export async function supportedAuthenticationTypesAsync() {
  return [];
}
export async function authenticateAsync() {
  return { success: false, error: 'not_available', warning: 'web' };
}
export const AuthenticationType = { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 };

export default {
  hasHardwareAsync,
  isEnrolledAsync,
  supportedAuthenticationTypesAsync,
  authenticateAsync,
  AuthenticationType,
};
