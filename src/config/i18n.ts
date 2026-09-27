import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import ptBR from '../locales/pt-BR/translation.json';
import enUS from '../locales/en-US/translation.json';

/**
 * Choose the app language from the stored preference. pt-BR is the default and
 * primary language; en-US is opt-in via Settings.
 */
export function detectLanguage(storedLanguage: string | null): string {
  return storedLanguage ?? 'pt-BR';
}

const languageDetector = new LanguageDetector();
languageDetector.addDetector({
  name: 'customDetector',
  lookup() {
    return detectLanguage(localStorage.getItem('i18nextLng'));
  },
  cacheUserLanguage(lng: string) {
    localStorage.setItem('i18nextLng', lng);
  },
});

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      'pt-BR': {
        translation: ptBR,
      },
      'en-US': {
        translation: enUS,
      },
    },
    fallbackLng: 'pt-BR',
    supportedLngs: ['pt-BR', 'en-US'],
    detection: {
      order: ['customDetector'],
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false, // React already handles escaping
    },
    react: {
      useSuspense: false, // Disable suspense to avoid loading flicker
    },
  });

// Keep the document language in sync so assistive tech and the browser agree
// with the active interface language.
i18n.on('languageChanged', (language) => {
  document.documentElement.lang = language;
});

export default i18n;
