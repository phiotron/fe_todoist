import type { IconName } from '../../components/IconButton';
import { useMemo } from 'react';
import i18n from '../../i18n';
import { effectiveNavTabs } from '../settings/navTabsModel';
import { useSettingsContext } from '../settings/SettingsProvider';
import { usePinTargets } from '../settings/usePinTargets';
import { pinKinds } from './tabBarItems';

export type NavTabKey = 'INBOX' | 'TODAY' | 'UPCOMING' | 'BROWSE';

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
  BROWSE: { key: 'BROWSE', route: 'browse', title: () => i18n.t('views.browse.title'), icon: 'menu' },
};

/** spec 9.2 / 10: default tab bar; Browse always last. */
export const DEFAULT_NAV_TABS: readonly NavTabKey[] = ['INBOX', 'TODAY', 'UPCOMING', 'BROWSE'];

/**
 * Keys of the tabs shown, in order: the account's navTabs (spec 12.1.1, 3-5 entries), the M1 default without settings,
 * and without a pinned target that no longer exists (dropped once its list has loaded). Besides `NavTabKey` the list can
 * hold a pinned key (`project:<uuid>` ...) or a key without a screen yet (`SEARCH` until M2, `TEAM` until M8):
 * `buildTabItems` skips those.
 */
export function useNavTabs(): readonly string[] {
  const stored = useSettingsContext()?.settings.navTabs;
  const targets = usePinTargets(pinKinds(stored));
  return useMemo(() => effectiveNavTabs(stored ?? DEFAULT_NAV_TABS, targets.known), [stored, targets.known]);
}

export function tabKeyForRoute(route: string): NavTabKey | undefined {
  return (Object.values(TAB_DEFS) as TabDef[]).find((def) => def.route === route)?.key;
}
