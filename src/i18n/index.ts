import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import viCore from './locales/vi.json';
import viBrowse from './locales/vi/browse.json';
import viCommon from './locales/vi/common.json';
import viDates from './locales/vi/dates.json';
import viNav from './locales/vi/nav.json';
import viProjectScreen from './locales/vi/projectScreen.json';
import viProjects from './locales/vi/projects.json';
import viQuickAdd from './locales/vi/quickAdd.json';
import viReminders from './locales/vi/reminders.json';
import viReorder from './locales/vi/reorder.json';
import viSchedule from './locales/vi/schedule.json';
import viSelection from './locales/vi/selection.json';
import viTaskDetail from './locales/vi/taskDetail.json';
import viTaskList from './locales/vi/taskList.json';
import viViews from './locales/vi/views.json';

/**
 * Vietnamese strings. vi.json keeps the M0 keys (auth, errors); every later feature owns one file in
 * locales/vi/ whose single top-level key equals the file name, so parallel work never edits the same file.
 * A new feature adds one import and one spread below.
 */
export const viTranslation = {
  ...viCore,
  ...viBrowse,
  ...viCommon,
  ...viDates,
  ...viNav,
  ...viProjectScreen,
  ...viProjects,
  ...viQuickAdd,
  ...viReminders,
  ...viReorder,
  ...viSchedule,
  ...viSelection,
  ...viTaskDetail,
  ...viTaskList,
  ...viViews,
};

export const resources = { vi: { translation: viTranslation } } as const;
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
