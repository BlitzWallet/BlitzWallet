import 'intl-pluralrules';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enTranslation from './locales/en/translation.json';
import spTranslation from './locales/sp/translation.json';
import itTranslation from './locales/it/translation.json';
import ptBrTranslation from './locales/pt-BR/translation.json';
import germanTranslation from './locales/de-DE/translation.json';

i18n.use(initReactI18next).init({
  debug: true,
  fallbackLng: 'en',
  supportedLngs: ['en', 'sp', 'it', 'pt-BR', 'de-DE'],
  load: 'currentOnly',
  interpolation: {
    escapeValue: false,
  },
  resources: {
    en: {
      translation: enTranslation,
    },
    sp: {
      translation: spTranslation,
    },
    it: {
      translation: itTranslation,
    },
    'pt-BR': {
      translation: ptBrTranslation,
    },
    'de-DE': {
      translation: germanTranslation,
    },
  },
});
