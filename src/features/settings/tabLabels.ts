import { parsePin, type PinTarget } from './navTabsModel';

/** i18n keys of the fixed tabs (settings page + tab bar of SEARCH / FILTERS_LABELS, which have no M1 title of their own; TEAM is M8's). */
export const FIXED_TAB_LABEL_KEYS = {
  INBOX: 'settings.targets.INBOX',
  TODAY: 'settings.targets.TODAY',
  UPCOMING: 'settings.targets.UPCOMING',
  SEARCH: 'settings.targets.SEARCH',
  FILTERS_LABELS: 'settings.targets.FILTERS_LABELS',
  TEAM: 'settings.targets.TEAM',
  BROWSE: 'settings.targets.BROWSE',
} as const;

const UNKNOWN_KEY = 'settings.startPage.unknown';

/** Display name of a navTabs key: fixed tabs by label, a pinned target by its name (or "no longer exists"). */
export function tabLabel(
  key: string,
  nameOf: (pin: PinTarget) => string | null,
  translate: (i18nKey: string) => string,
): string {
  const pin = parsePin(key);
  if (pin) return nameOf(pin) ?? translate(UNKNOWN_KEY);
  const i18nKey = FIXED_TAB_LABEL_KEYS[key as keyof typeof FIXED_TAB_LABEL_KEYS];
  return i18nKey ? translate(i18nKey) : key;
}
