import type { ComponentType } from 'react';
import type { IconName } from '../../components/IconButton';
import i18n from '../../i18n';
import { BrowseLabels } from './BrowseLabels';
import { SettingsBlock } from './SettingsBlock';

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

/**
 * Shortcuts of M-Browse: Inbox, Today, Upcoming (M3x), Filters & Labels (M2, pushed screen), Completed. Which ones
 * show, and in which order, follows Settings › Navigation menu (features/navMenu/browseShortcuts).
 */
export const BROWSE_SHORTCUTS: readonly BrowseShortcut[] = [
  { key: 'inbox', title: () => i18n.t('views.inbox.title'), icon: 'inbox', kind: 'tab', href: '/inbox', count: 'inbox' },
  { key: 'today', title: () => i18n.t('views.today.title'), icon: 'calendar', kind: 'tab', href: '/today' },
  { key: 'upcoming', title: () => i18n.t('views.upcoming.title'), icon: 'grid', kind: 'tab', href: '/upcoming' },
  { key: 'filters-labels', title: () => i18n.t('filtersLabels.title'), icon: 'filter', kind: 'push', href: '/filters-labels', chevron: true },
  { key: 'completed', title: () => i18n.t('views.completed.title'), icon: 'check-circle', kind: 'push', href: '/completed', chevron: true },
  // M10: Reporting = Productivity (Daily / Weekly / Karma)
  { key: 'reporting', title: () => i18n.t('productivity.title'), icon: 'trending-up', kind: 'push', href: '/productivity', chevron: true },
  // M11: Browse templates (Todoist has the same entry in Browse)
  { key: 'templates', title: () => i18n.t('templates.browseRow'), icon: 'layers', kind: 'push', href: '/templates', chevron: true },
];

/** Blocks rendered under My Projects: Labels (M2), Settings (M3); M8 adds team projects. */
export const BROWSE_EXTRA_BLOCKS: readonly ComponentType[] = [BrowseLabels, SettingsBlock];
