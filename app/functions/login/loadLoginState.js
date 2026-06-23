import {
  retrieveData,
  runPinAndMnemoicMigration,
  runSecureStoreMigrationV2,
} from '../secureStore';
import { getLocalStorageItem, setLocalStorageItem } from '../localStorage';
import {
  BIOMETRIC_KEY,
  LOGIN_SECUITY_MODE_KEY,
  LOGIN_SECURITY_MODE_TYPE_KEY,
} from '../../constants';
import { deriveLoginState, resolveLoginRoute } from './resolveLoginState';
import { getLocales } from 'react-native-localize';
import { supportedLanguagesList } from '../../../locales/localeslist';
import i18next from 'i18next';

const safeRetrieve = key =>
  retrieveData(key).catch(() => ({ didWork: false, value: false }));

export async function loadLoginState() {
  try {
    await runPinAndMnemoicMigration();
  } catch (e) {
    console.log(
      'runPinAndMnemoicMigration failed (best-effort, will retry next launch):',
      e,
    );
  }
  try {
    await runSecureStoreMigrationV2();
  } catch (e) {
    console.log(
      'runSecureStoreMigrationV2 failed (best-effort, will retry next launch):',
      e,
    );
  }

  const [
    modeTypeResult,
    pinHashResult,
    mnemonicResult,
    bioKeyResult,
    securitySettingsRaw,
    userSelectedLanguage,
  ] = await Promise.all([
    safeRetrieve(LOGIN_SECURITY_MODE_TYPE_KEY),
    safeRetrieve('pinHash'),
    safeRetrieve('encryptedMnemonic'),
    safeRetrieve(BIOMETRIC_KEY),
    getLocalStorageItem(LOGIN_SECUITY_MODE_KEY),
    getLocalStorageItem('userSelectedLanguage').then(data => {
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    }),
  ]);

  let resolvedLanguage = userSelectedLanguage;
  if (!resolvedLanguage) {
    const [{ languageTag = 'en' }] = getLocales();
    const deviceShortId = languageTag.split('-')[0];
    const matched = supportedLanguagesList.find(
      l => l.shortId === deviceShortId,
    );
    resolvedLanguage = matched ? matched.id : 'en';
    setLocalStorageItem(
      'userSelectedLanguage',
      JSON.stringify(resolvedLanguage),
    );
  }
  i18next.changeLanguage(resolvedLanguage);

  const loginState = deriveLoginState({
    encryptedMnemonic: mnemonicResult.value || false,
    pinHash: pinHashResult.value || false,
    biometricKey: bioKeyResult.value || false,
    loginModeType: modeTypeResult.value || null,
    securitySettingsRaw,
  });

  const loginRoute = resolveLoginRoute(loginState);

  return { loginState, loginRoute };
}
