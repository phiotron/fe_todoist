import { ApiError, NetworkError, TimeoutError } from '../../api/errors';
import { APPEARANCES, DEFAULT_APPEARANCE, DEFAULT_THEME, THEME_NAMES, type Appearance, type ThemeName } from '../../theme/themeNames';
import { DEFAULT_NAV_TABS, DEFAULT_START_PAGE, isValidNavTabs, isValidStartPage } from './navTabsModel';

/** Languages the app ships (Task 7 checks this equals the i18n resources). */
export type AppLanguage = 'vi' | 'en';
export const APP_LANGUAGES: readonly AppLanguage[] = ['vi', 'en'];
export const DEFAULT_APP_LANGUAGE: AppLanguage = 'vi';

/** ISO weekday: 1 = Monday … 7 = Sunday (spec 10). */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];
export type DateFormat = 'DMY' | 'MDY';
export const DATE_FORMATS: readonly DateFormat[] = ['DMY', 'MDY'];
export type TimeFormat = 'H24' | 'H12';
export const TIME_FORMATS: readonly TimeFormat[] = ['H24', 'H12'];
export type SwipeAction = 'COMPLETE' | 'SCHEDULE' | 'DELETE' | 'REMINDERS' | 'SELECT' | 'NONE';
export const SWIPE_ACTIONS: readonly SwipeAction[] = ['COMPLETE', 'SCHEDULE', 'DELETE', 'REMINDERS', 'SELECT', 'NONE'];
/** Offered in Settings › General (spec 9.2): REMINDERS only exists from M4, which adds it here. */
export const SWIPE_CHOICES: readonly SwipeAction[] = ['COMPLETE', 'SCHEDULE', 'DELETE', 'SELECT', 'NONE'];

/** The 14 M3 settings of GET me/settings (spec 12.1.1), as the app applies them. */
export type AppSettings = {
  theme: ThemeName;
  appearance: Appearance;
  locale: AppLanguage;
  timeZone: string;
  startDay: Weekday;
  nextWeek: Weekday;
  weekendStartDay: Weekday;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
  startPage: string;
  smartDateRecognition: boolean;
  swipeLeft: SwipeAction;
  swipeRight: SwipeAction;
  navTabs: string[];
};

export const CORE_FIELDS: readonly string[] = [
  'theme',
  'appearance',
  'locale',
  'timeZone',
  'startDay',
  'nextWeek',
  'weekendStartDay',
  'dateFormat',
  'timeFormat',
  'startPage',
  'smartDateRecognition',
  'swipeLeft',
  'swipeRight',
  'navTabs',
];

/**
 * Plain values a settings field can hold. `null` is a real value: M4's `autoReminderMinutes: null` means "off" and must
 * be saved and sent like any other (only nested objects and mixed lists are not settings values). Fields M3 knows are
 * never null — they are validated one by one in normalizeSettings / normalizePatch.
 */
export type SettingsValue = string | number | boolean | null | readonly string[];

/** Fields to change: M3 fields (validated) plus any field later milestones add (M4 reminders, M6 Quick Add chips…). */
export type SettingsPatch = Partial<AppSettings> & { [field: string]: SettingsValue | undefined };

/** A type alias (not an interface) so it can be passed where a SettingsPatch is expected. */
export type ThemeChoice = {
  theme: ThemeName;
  appearance: Appearance;
};

/** What lives in AsyncStorage: the last server-confirmed settings plus changes not saved on the server yet. */
export interface StoredSettings {
  applied: AppSettings;
  /** Server fields M3 does not interpret (M4 reminders…), kept so useSettings().data has the full server shape. */
  extra: Record<string, SettingsValue>;
  pending: SettingsPatch | null;
  /** "device|account" pair the user chose not to be asked about again. */
  dismissedTimeZone: string | null;
  /** "Sync theme" switch (spec 9.3): a device setting, on by default. */
  syncTheme: boolean;
  /** Theme of this device while syncTheme is off. */
  localTheme: ThemeChoice | null;
}

export const FALLBACK_TIME_ZONE = 'Asia/Ho_Chi_Minh';

function oneOf<T>(list: readonly T[], value: unknown): value is T {
  return (list as readonly unknown[]).includes(value);
}

export const isThemeName = (value: unknown): value is ThemeName => oneOf(THEME_NAMES, value);
export const isAppearance = (value: unknown): value is Appearance => oneOf(APPEARANCES, value);
export const isAppLanguage = (value: unknown): value is AppLanguage => oneOf(APP_LANGUAGES, value);
export const isWeekday = (value: unknown): value is Weekday => oneOf(WEEKDAYS, value);
export const isDateFormat = (value: unknown): value is DateFormat => oneOf(DATE_FORMATS, value);
export const isTimeFormat = (value: unknown): value is TimeFormat => oneOf(TIME_FORMATS, value);
export const isSwipeAction = (value: unknown): value is SwipeAction => oneOf(SWIPE_ACTIONS, value);

/** "en-US" → "en"; unsupported or empty → Vietnamese (UC 11/8a). */
export function normalizeLanguage(code: string | null | undefined): AppLanguage {
  const base = code?.trim().toLowerCase().split(/[-_]/)[0];
  return isAppLanguage(base) ? base : DEFAULT_APP_LANGUAGE;
}

function isNonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function isSettingsValue(value: unknown): value is SettingsValue {
  if (value === null) return true;
  if (Array.isArray(value)) return value.every((item) => typeof item === 'string');
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function definedEntries(patch: SettingsPatch | null): Record<string, SettingsValue> {
  const result: Record<string, SettingsValue> = {};
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (value !== undefined) result[key] = value;
  }
  return result;
}

/** Non-core fields with plain values; nested objects and mixed lists are dropped. */
export function extraFields(raw: unknown): Record<string, SettingsValue> {
  const result: Record<string, SettingsValue> = {};
  for (const [key, value] of Object.entries(asRecord(raw))) {
    if (!CORE_FIELDS.includes(key) && isSettingsValue(value)) {
      result[key] = Array.isArray(value) ? [...value] : value;
    }
  }
  return result;
}

/** Settings before the first server answer: spec 10 defaults, current UI language, device time zone. */
export function defaultSettings(language: string | null | undefined, deviceTimeZone: string | null): AppSettings {
  return {
    theme: DEFAULT_THEME,
    appearance: DEFAULT_APPEARANCE,
    locale: normalizeLanguage(language),
    timeZone: deviceTimeZone ?? FALLBACK_TIME_ZONE,
    startDay: 1,
    nextWeek: 1,
    weekendStartDay: 6,
    dateFormat: 'DMY',
    timeFormat: 'H24',
    startPage: DEFAULT_START_PAGE,
    smartDateRecognition: true,
    swipeLeft: 'SCHEDULE',
    swipeRight: 'COMPLETE',
    navTabs: [...DEFAULT_NAV_TABS],
  };
}

/** Server / disk data → AppSettings. Unknown values fall back field by field; an unsupported language becomes vi. */
export function normalizeSettings(raw: unknown, fallback: AppSettings): AppSettings {
  const v = asRecord(raw);
  return {
    theme: isThemeName(v.theme) ? v.theme : fallback.theme,
    appearance: isAppearance(v.appearance) ? v.appearance : fallback.appearance,
    locale: typeof v.locale === 'string' ? normalizeLanguage(v.locale) : fallback.locale,
    timeZone: isNonBlank(v.timeZone) ? v.timeZone : fallback.timeZone,
    startDay: isWeekday(v.startDay) ? v.startDay : fallback.startDay,
    nextWeek: isWeekday(v.nextWeek) ? v.nextWeek : fallback.nextWeek,
    weekendStartDay: isWeekday(v.weekendStartDay) ? v.weekendStartDay : fallback.weekendStartDay,
    dateFormat: isDateFormat(v.dateFormat) ? v.dateFormat : fallback.dateFormat,
    timeFormat: isTimeFormat(v.timeFormat) ? v.timeFormat : fallback.timeFormat,
    startPage: isValidStartPage(v.startPage) ? v.startPage : fallback.startPage,
    smartDateRecognition:
      typeof v.smartDateRecognition === 'boolean' ? v.smartDateRecognition : fallback.smartDateRecognition,
    swipeLeft: isSwipeAction(v.swipeLeft) ? v.swipeLeft : fallback.swipeLeft,
    swipeRight: isSwipeAction(v.swipeRight) ? v.swipeRight : fallback.swipeRight,
    navTabs: isValidNavTabs(v.navTabs) ? [...v.navTabs] : [...fallback.navTabs],
  };
}

/** A change as read from disk or given by a screen: invalid M3 values are dropped, extra plain fields kept. */
export function normalizePatch(raw: unknown): SettingsPatch | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const v = raw as Record<string, unknown>;
  const patch: SettingsPatch = { ...extraFields(v) };
  if (isThemeName(v.theme)) patch.theme = v.theme;
  if (isAppearance(v.appearance)) patch.appearance = v.appearance;
  if (isAppLanguage(v.locale)) patch.locale = v.locale;
  if (isNonBlank(v.timeZone)) patch.timeZone = v.timeZone;
  if (isWeekday(v.startDay)) patch.startDay = v.startDay;
  if (isWeekday(v.nextWeek)) patch.nextWeek = v.nextWeek;
  if (isWeekday(v.weekendStartDay)) patch.weekendStartDay = v.weekendStartDay;
  if (isDateFormat(v.dateFormat)) patch.dateFormat = v.dateFormat;
  if (isTimeFormat(v.timeFormat)) patch.timeFormat = v.timeFormat;
  if (isValidStartPage(v.startPage)) patch.startPage = v.startPage;
  if (typeof v.smartDateRecognition === 'boolean') patch.smartDateRecognition = v.smartDateRecognition;
  if (isSwipeAction(v.swipeLeft)) patch.swipeLeft = v.swipeLeft;
  if (isSwipeAction(v.swipeRight)) patch.swipeRight = v.swipeRight;
  if (isValidNavTabs(v.navTabs)) patch.navTabs = [...v.navTabs];
  return Object.keys(patch).length > 0 ? patch : null;
}

/** Account settings with the unsaved changes on top (theme as saved on the account). */
export function accountSettings(stored: StoredSettings): AppSettings {
  return normalizeSettings({ ...stored.applied, ...definedEntries(stored.pending) }, stored.applied);
}

/** What the app applies now: account settings, or this device's theme while "Sync theme" is off. */
export function effectiveSettings(stored: StoredSettings): AppSettings {
  const account = accountSettings(stored);
  return stored.syncTheme || !stored.localTheme ? account : { ...account, ...stored.localTheme };
}

/** Everything in the server shape (GET me/settings), pending changes included: what useSettings().data returns. */
export function effectiveData(stored: StoredSettings): Record<string, SettingsValue> {
  return { ...stored.extra, ...stored.applied, ...definedEntries(stored.pending) };
}

export function themeOf(settings: Pick<AppSettings, 'theme' | 'appearance'>): ThemeChoice {
  return { theme: settings.theme, appearance: settings.appearance };
}

/** Theme / appearance (device-only while "Sync theme" is off) apart from everything else. */
export function splitThemePatch(patch: SettingsPatch): { theme: Partial<ThemeChoice> | null; rest: SettingsPatch | null } {
  const { theme, appearance, ...rest } = patch;
  const themePart: Partial<ThemeChoice> = {};
  if (theme !== undefined) themePart.theme = theme;
  if (appearance !== undefined) themePart.appearance = appearance;
  return {
    theme: Object.keys(themePart).length > 0 ? themePart : null,
    rest: Object.keys(rest).length > 0 ? rest : null,
  };
}

/** Signed out: there is no account to save to, so the change goes straight into the device settings. */
export function applyLocally(stored: StoredSettings, patch: SettingsPatch): StoredSettings {
  return {
    ...stored,
    applied: normalizeSettings({ ...stored.applied, ...definedEntries(patch) }, stored.applied),
    extra: { ...stored.extra, ...extraFields(patch) },
  };
}

export function mergePending(pending: SettingsPatch | null, patch: SettingsPatch): SettingsPatch {
  return { ...(pending ?? {}), ...patch };
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  return (
    Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, index) => item === b[index])
  );
}

/** After a request carrying `sent` finished, drop the keys the user has not changed again meanwhile. */
export function settlePending(current: SettingsPatch | null, sent: SettingsPatch): SettingsPatch | null {
  if (!current) return null;
  const rest: SettingsPatch = { ...current };
  Object.keys(sent).forEach((key) => {
    if (sameValue(rest[key], sent[key])) delete rest[key];
  });
  return Object.keys(rest).length > 0 ? rest : null;
}

/** Network, timeout, 5xx and 429 may succeed later: keep the change. Other errors (400, 401…) never will. */
export function isRetryableSaveError(error: unknown): boolean {
  if (error instanceof NetworkError || error instanceof TimeoutError) return true;
  return error instanceof ApiError && (error.status >= 500 || error.status === 429);
}

export function timeZonePairKey(device: string, account: string): string {
  return `${device}|${account}`;
}

export function hasTimeZoneMismatch(device: string | null, account: string, dismissed: string | null): boolean {
  if (!device || device === account) return false;
  return dismissed !== timeZonePairKey(device, account);
}

export function emptyStored(fallback: AppSettings): StoredSettings {
  return { applied: fallback, extra: {}, pending: null, dismissedTimeZone: null, syncTheme: true, localTheme: null };
}

function parseThemeChoice(raw: unknown): ThemeChoice | null {
  const v = asRecord(raw);
  return isThemeName(v.theme) && isAppearance(v.appearance) ? { theme: v.theme, appearance: v.appearance } : null;
}

export function parseStoredSettings(text: string | null, fallback: AppSettings): StoredSettings {
  const empty = emptyStored(fallback);
  if (!text) return empty;
  try {
    const raw = JSON.parse(text) as unknown;
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return empty;
    const value = raw as Record<string, unknown>;
    return {
      applied: normalizeSettings(value.applied, fallback),
      extra: extraFields(value.extra),
      pending: normalizePatch(value.pending),
      dismissedTimeZone: typeof value.dismissedTimeZone === 'string' ? value.dismissedTimeZone : null,
      syncTheme: typeof value.syncTheme === 'boolean' ? value.syncTheme : true,
      localTheme: parseThemeChoice(value.localTheme),
    };
  } catch {
    return empty;
  }
}
