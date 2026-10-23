import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import vi from './locales/vi.json';

export const resources = { vi: { translation: vi } } as const;
export type SupportedLanguage = keyof typeof resources;
export const DEFAULT_LANGUAGE: SupportedLanguage = 'vi';

export function pickLanguage(codes: (string | null | undefined)[]): SupportedLanguage {
  const match = codes.find((code): code is SupportedLanguage => !!code && code in resources);
  return match ?? DEFAULT_LANGUAGE;
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    lng: pickLanguage(getLocales().map((locale) => locale.languageCode)),
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: { escapeValue: false },
    // Resources are bundled, so initialise synchronously: t() works right after import.
    initAsync: false,
  });
}

export default i18n;
