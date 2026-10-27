import type { IconName } from '../../components/IconButton';
import i18n from '../../i18n';

export type NavTabKey = 'INBOX' | 'TODAY' | 'UPCOMING' | 'SEARCH' | 'FILTERS_LABELS' | 'BROWSE';

export interface TabDef {
  key: NavTabKey;
  /** File name under src/app/(app)/(tabs)/ (URL /<route>). */
  route: string;
  title: () => string;
  icon: IconName;
}

/**
 * Every tab the bar can show. M2 adds SEARCH and FILTERS_LABELS, M3 PINNED, M8 TEAM: add the route file in
 * `(tabs)/` and one entry here (a route that is not in the bar still opens, the bar then highlights nothing).
 */
export const TAB_DEFS: Record<NavTabKey, TabDef> = {
  INBOX: { key: 'INBOX', route: 'inbox', title: () => i18n.t('views.inbox.title'), icon: 'inbox' },
  TODAY: { key: 'TODAY', route: 'today', title: () => i18n.t('views.today.title'), icon: 'calendar' },
  UPCOMING: { key: 'UPCOMING', route: 'upcoming', title: () => i18n.t('views.upcoming.title'), icon: 'grid' },
  SEARCH: { key: 'SEARCH', route: 'search', title: () => i18n.t('search.title'), icon: 'search' },
  FILTERS_LABELS: { key: 'FILTERS_LABELS', route: 'filters-labels', title: () => i18n.t('filtersLabels.title'), icon: 'filter' },
  BROWSE: { key: 'BROWSE', route: 'browse', title: () => i18n.t('views.browse.title'), icon: 'menu' },
};

/** spec 9.2 / 10: default tab bar; Browse always last. */
export const DEFAULT_NAV_TABS: readonly NavTabKey[] = ['INBOX', 'TODAY', 'UPCOMING', 'BROWSE'];

/** Tabs to draw. M1: fixed. M3 replaces the body with `me/settings.navTabs` (3–5 tabs) and keeps the signature. */
export function useNavTabs(): readonly NavTabKey[] {
  return DEFAULT_NAV_TABS;
}

export function tabKeyForRoute(route: string): NavTabKey | undefined {
  return (Object.values(TAB_DEFS) as TabDef[]).find((def) => def.route === route)?.key;
}
