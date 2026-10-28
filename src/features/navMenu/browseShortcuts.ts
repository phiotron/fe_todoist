import type { NavMenuItem } from '../../api/navigationSettings';
import { BROWSE_SHORTCUTS, type BrowseShortcut } from '../browse/browseBlocks';
import { browseMenuItems } from './navMenuModel';

/** Browse shortcut drawn for each menu item that has a screen (Reporting / Browse templates come with M10 / M11). */
const SHORTCUT_KEY: Record<NavMenuItem, string | null> = {
  INBOX: 'inbox',
  TODAY: 'today',
  UPCOMING: 'upcoming',
  FILTERS_LABELS: 'filters-labels',
  REPORTING: null,
  BROWSE_TEMPLATES: null,
};

/** Taskly's Completed screen is not a Todoist menu item: always offered, after the menu (ADR 0006 keeps it). */
const ALWAYS_LAST = ['completed'];

/**
 * Shortcuts at the top of Browse (M3x, Todoist Navigation menu): the menu items in the user's order, without those
 * already on the tab bar, then Completed.
 */
export function browseShortcuts(items: readonly NavMenuItem[], navTabs: readonly string[]): BrowseShortcut[] {
  const byKey = new Map(BROWSE_SHORTCUTS.map((shortcut) => [shortcut.key, shortcut]));
  const keys = [
    ...browseMenuItems(items, navTabs).flatMap((item) => (SHORTCUT_KEY[item] ? [SHORTCUT_KEY[item]] : [])),
    ...ALWAYS_LAST,
  ];
  return keys.flatMap((key) => {
    const shortcut = byKey.get(key);
    return shortcut ? [shortcut] : [];
  });
}
