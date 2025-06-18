import * as LocalAuthentication from 'expo-local-authentication';

async function hasHardware() {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    return compatible;
  } catch (err) {
    console.log(console.log('error getting hardware status', err));
    return false;
  }
}
async function hasSavedProfile() {
  try {
    const savedBiometrics = await LocalAuthentication.isEnrolledAsync();

    return savedBiometrics;
  } catch (err) {
    console.log('Error getting saved biometric profile', err);
    return false;
  }
}
async function handleLogin() {
  try {
    const authenticationTypes =
      await LocalAuthentication.supportedAuthenticationTypesAsync();
    const promtMessage =
      authenticationTypes.length === 2
        ? 'Face ID'
        : authenticationTypes[0] === 1
        ? 'Scan Finger'
        : 'FaceID';

    const LocalAuthenticationOptions = {
      promptMessage: promtMessage,
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
      fallbackLabel: 'Login with pin',
    };

    const didAuthenticate = await LocalAuthentication.authenticateAsync(
      LocalAuthenticationOptions,
    );

    return didAuthenticate.success;
  } catch (err) {
    console.log('error authenicating user with biometrics', err);
    return false;
  }
}

export {hasHardware, hasSavedProfile, handleLogin};
