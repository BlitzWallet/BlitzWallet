import 'intl-pluralrules';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enTranslation from './locales/en/translation.json';
import esTranslation from './locales/es/translation.json';
import itTranslation from './locales/it/translation.json';
import ptBrTranslation from './locales/pt-BR/translation.json';
import germanTranslation from './locales/de-DE/translation.json';
import frenchTranslation from './locales/fr/translation.json';
import swedishTranslation from './locales/sv/translation.json';
import russianTranslation from './locales/ru/translation.json';

i18n.use(initReactI18next).init({
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
  resources: {
    en: { translation: enTranslation },
    es: { translation: esTranslation },
    it: { translation: itTranslation },
    'pt-BR': { translation: ptBrTranslation },
    pt: { translation: ptBrTranslation },
    'de-DE': { translation: germanTranslation },
    de: { translation: germanTranslation },
    fr: { translation: frenchTranslation },
    sv: { translation: swedishTranslation },
    ru: { translation: russianTranslation },
  },
});
