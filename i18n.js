import 'intl-pluralrules';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'react-native-localize';

import enTranslation from './locales/en/translation.json';
import { supportedLanguagesList } from './locales/localeslist';
import {
  getLocalStorageItem,
  setLocalStorageItem,
} from './app/functions/localStorage';

// Lazy loaders: each translation is only parsed when first needed.
// Metro bundles them all, but the JSON.parse work is deferred until the
// language is actually selected.
const languageLoaders = {
  en: () => import('./locales/en/translation.json'),
  es: () => import('./locales/es/translation.json'),
  it: () => import('./locales/it/translation.json'),
  pt: () => import('./locales/pt-BR/translation.json'),
  'pt-BR': () => import('./locales/pt-BR/translation.json'),
  de: () => import('./locales/de-DE/translation.json'),
  'de-DE': () => import('./locales/de-DE/translation.json'),
  fr: () => import('./locales/fr/translation.json'),
  sv: () => import('./locales/sv/translation.json'),
  ru: () => import('./locales/ru/translation.json'),
};

const lazyTranslationBackend = {
  type: 'backend',
  init(services) {
    this.services = services;
  },
  read(language, namespace, callback) {
    const loader = languageLoaders[language];
    if (!loader) {
      callback(null, {});
      return;
    }
    loader()
      .then(module => callback(null, module.default ?? module))
      .catch(error => callback(error, null));
  },
};

i18n
  .use(lazyTranslationBackend)
  .use(initReactI18next)
  .init({
    debug: true,
    fallbackLng: 'en',
    supportedLngs: [
      'en',
      'es',
      'it',
      'pt',
      'pt-BR',
      'de',
      'de-DE',
      'fr',
      'sv',
      'ru',
    ],
    load: 'currentOnly',
    interpolation: { escapeValue: false },
    // Only English is bundled inline; everything else arrives via the backend.
    partialBundledLanguages: true,
    resources: {
      en: { translation: enTranslation },
    },
    // Render with the fallback language instead of suspending while a
    // translation loads asynchronously.
    react: { useSuspense: false },
  });

// Single source of truth for the startup language: the stored user choice,
// else the best device-locale match (persisted so every later reader agrees).
// Kept async and dependency-free enough to run inside initWallet's Promise.all,
// so resolution adds no serial cold-start time.
export async function resolveUserLanguage() {
  try {
    const stored = await getLocalStorageItem('userSelectedLanguage');
    const parsed = stored ? JSON.parse(stored) : null;
    if (parsed) return parsed;
  } catch {
    // Corrupt stored value — fall through to device detection.
  }
  const [{ languageTag = 'en' }] = getLocales();
  const deviceShortId = languageTag.split('-')[0];
  const matched = supportedLanguagesList.find(l => l.shortId === deviceShortId);
  const resolvedLanguage = matched ? matched.id : 'en';
  // Fire-and-forget: persisting the fallback must not block startup.
  setLocalStorageItem('userSelectedLanguage', JSON.stringify(resolvedLanguage));
  return resolvedLanguage;
}
