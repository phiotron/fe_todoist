import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enCore from './locales/en.json';
import enBoard from './locales/en/board.json';
import enBrowse from './locales/en/browse.json';
import enCalendar from './locales/en/calendar.json';
import enCommon from './locales/en/common.json';
import enDates from './locales/en/dates.json';
import enDisplay from './locales/en/display.json';
import enEmail from './locales/en/email.json';
import enFilters from './locales/en/filters.json';
import enFiltersLabels from './locales/en/filtersLabels.json';
import enGoogle from './locales/en/google.json';
import enLabels from './locales/en/labels.json';
import enNav from './locales/en/nav.json';
import enNavMenu from './locales/en/navMenu.json';
import enPasswordReset from './locales/en/passwordReset.json';
import enProjectScreen from './locales/en/projectScreen.json';
import enProjects from './locales/en/projects.json';
import enQuickAdd from './locales/en/quickAdd.json';
import enRecurrence from './locales/en/recurrence.json';
import enReminders from './locales/en/reminders.json';
import enReorder from './locales/en/reorder.json';
import enSchedule from './locales/en/schedule.json';
import enSearch from './locales/en/search.json';
import enSelection from './locales/en/selection.json';
import enSettings from './locales/en/settings.json';
import enSync from './locales/en/sync.json';
import enSocial from './locales/en/social.json';
import enTaskDetail from './locales/en/taskDetail.json';
import enTaskList from './locales/en/taskList.json';
import enTemplates from './locales/en/templates.json';
import enTwoFactor from './locales/en/twoFactor.json';
import enViews from './locales/en/views.json';
import enIntegrations from './locales/en/integrations.json';
import enNotificationPrefs from './locales/en/notificationPrefs.json';
import enOauth from './locales/en/oauth.json';
import viCore from './locales/vi.json';
import viBoard from './locales/vi/board.json';
import viBrowse from './locales/vi/browse.json';
import viCalendar from './locales/vi/calendar.json';
import viCommon from './locales/vi/common.json';
import viDates from './locales/vi/dates.json';
import viDisplay from './locales/vi/display.json';
import viEmail from './locales/vi/email.json';
import viFilters from './locales/vi/filters.json';
import viFiltersLabels from './locales/vi/filtersLabels.json';
import viGoogle from './locales/vi/google.json';
import viLabels from './locales/vi/labels.json';
import viNav from './locales/vi/nav.json';
import viNavMenu from './locales/vi/navMenu.json';
import viPasswordReset from './locales/vi/passwordReset.json';
import viProjectScreen from './locales/vi/projectScreen.json';
import viProjects from './locales/vi/projects.json';
import viQuickAdd from './locales/vi/quickAdd.json';
import viRecurrence from './locales/vi/recurrence.json';
import viReminders from './locales/vi/reminders.json';
import viReorder from './locales/vi/reorder.json';
import viSearch from './locales/vi/search.json';
import viSchedule from './locales/vi/schedule.json';
import viSelection from './locales/vi/selection.json';
import viSettings from './locales/vi/settings.json';
import viSync from './locales/vi/sync.json';
import viSocial from './locales/vi/social.json';
import viTaskDetail from './locales/vi/taskDetail.json';
import viTaskList from './locales/vi/taskList.json';
import viTemplates from './locales/vi/templates.json';
import viTwoFactor from './locales/vi/twoFactor.json';
import viViews from './locales/vi/views.json';
import viIntegrations from './locales/vi/integrations.json';
import viNotificationPrefs from './locales/vi/notificationPrefs.json';
import viOauth from './locales/vi/oauth.json';

/**
 * Vietnamese strings. vi.json keeps the M0 keys (auth, errors); every later feature owns one file in
 * locales/vi/ whose single top-level key equals the file name, so parallel work never edits the same file.
 * A new feature adds one import and one spread below AND the same in enTranslation (keys.test.ts compares both).
 */
export const viTranslation = {
  ...viCore,
  ...viBoard,
  ...viBrowse,
  ...viCalendar,
  ...viCommon,
  ...viDates,
  ...viDisplay,
  ...viEmail,
  ...viFilters,
  ...viFiltersLabels,
  ...viGoogle,
  ...viLabels,
  ...viNav,
  ...viNavMenu,
  ...viPasswordReset,
  ...viProjectScreen,
  ...viProjects,
  ...viQuickAdd,
  ...viRecurrence,
  ...viReminders,
  ...viReorder,
  ...viSearch,
  ...viSchedule,
  ...viSelection,
  ...viSettings,
  ...viSync,
  ...viSocial,
  ...viTaskDetail,
  ...viTaskList,
  ...viTemplates,
  ...viTwoFactor,
  ...viViews,
  ...viIntegrations,
  ...viNotificationPrefs,
  ...viOauth,
};

/** English strings: same files and keys as viTranslation, under locales/en/. */
export const enTranslation = {
  ...enCore,
  ...enBoard,
  ...enBrowse,
  ...enCalendar,
  ...enCommon,
  ...enDates,
  ...enDisplay,
  ...enEmail,
  ...enFilters,
  ...enFiltersLabels,
  ...enGoogle,
  ...enLabels,
  ...enNav,
  ...enNavMenu,
  ...enPasswordReset,
  ...enProjectScreen,
  ...enProjects,
  ...enQuickAdd,
  ...enRecurrence,
  ...enReminders,
  ...enReorder,
  ...enSchedule,
  ...enSearch,
  ...enSelection,
  ...enSettings,
  ...enSync,
  ...enSocial,
  ...enTaskDetail,
  ...enTaskList,
  ...enTemplates,
  ...enTwoFactor,
  ...enViews,
  ...enIntegrations,
  ...enNotificationPrefs,
  ...enOauth,
};

export const resources = { vi: { translation: viTranslation }, en: { translation: enTranslation } } as const;
export type SupportedLanguage = keyof typeof resources;
export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = ['vi', 'en'];
export const DEFAULT_LANGUAGE: SupportedLanguage = 'vi';

export function isSupportedLanguage(code: string): code is SupportedLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code);
}

/** First supported language among the codes ("en-US" counts as "en"); anything else falls back to Vietnamese. */
export function pickLanguage(codes: (string | null | undefined)[]): SupportedLanguage {
  for (const code of codes) {
    const base = code?.trim().toLowerCase().split(/[-_]/)[0];
    if (base && isSupportedLanguage(base)) return base;
  }
  return DEFAULT_LANGUAGE;
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    // First start (no saved settings yet): the device language when supported; SettingsProvider then applies
    // the cached / account language before anything is shown.
    lng: pickLanguage(getLocales().map((locale) => locale.languageCode)),
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: { escapeValue: false },
    // Resources are bundled, so initialise synchronously: t() works right after import.
    initAsync: false,
  });
}

export default i18n;
