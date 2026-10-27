import type { ComponentType } from 'react';
import type { IconName } from '../../components/IconButton';
import i18n from '../../i18n';

export interface BrowseShortcut {
  key: string;
  title: () => string;
  icon: IconName;
  /** tab = jump to a tab (router.navigate), push = open a pushed screen. */
  kind: 'tab' | 'push';
  href: string;
  chevron?: boolean;
  /** Count shown on the right (Inbox only). */
  count?: 'inbox';
}

/** M1 shortcuts of M-Browse. M2 appends "Filters & Labels" (`push`, `/(tabs)/filters-labels` stays reachable). */
export const BROWSE_SHORTCUTS: readonly BrowseShortcut[] = [
  { key: 'inbox', title: () => i18n.t('views.inbox.title'), icon: 'inbox', kind: 'tab', href: '/inbox', count: 'inbox' },
  { key: 'today', title: () => i18n.t('views.today.title'), icon: 'calendar', kind: 'tab', href: '/today' },
  { key: 'completed', title: () => i18n.t('views.completed.title'), icon: 'check-circle', kind: 'push', href: '/completed', chevron: true },
];

/** Blocks rendered under My Projects: empty in M1; M2 adds Labels, M3 Settings, M8 team projects. */
export const BROWSE_EXTRA_BLOCKS: readonly ComponentType[] = [];
