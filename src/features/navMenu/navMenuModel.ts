import type { AddButtonPlacement, NavMenuItem, NavigationSettingsFields } from '../../api/navigationSettings';

/** M3x: + button placement, Navigation menu and Sync home view, read from me/settings (pure, no React). */

export const ADD_BUTTON_PLACEMENTS: readonly AddButtonPlacement[] = ['LEFT', 'CENTER', 'RIGHT'];

/** The six Todoist menu items, in Todoist order; also the default menu. */
export const ALL_NAV_MENU_ITEMS: readonly NavMenuItem[] = [
  'INBOX',
  'TODAY',
  'UPCOMING',
  'FILTERS_LABELS',
  'REPORTING',
  'BROWSE_TEMPLATES',
];

/** Items with a screen today: Reporting comes with M10 (saved, not shown yet); Browse templates is M11. */
const AVAILABLE_MENU_ITEMS: readonly NavMenuItem[] = ['INBOX', 'TODAY', 'UPCOMING', 'FILTERS_LABELS', 'REPORTING', 'BROWSE_TEMPLATES'];

export const DEFAULT_NAVIGATION_SETTINGS: NavigationSettingsFields = {
  addButtonPlacement: 'RIGHT',
  syncHomeView: true,
  navMenuShowTaskCount: true,
  navMenuItems: [...ALL_NAV_MENU_ITEMS],
};

export function isAddButtonPlacement(value: unknown): value is AddButtonPlacement {
  return (ADD_BUTTON_PLACEMENTS as readonly unknown[]).includes(value);
}

export function isNavMenuItem(value: unknown): value is NavMenuItem {
  return (ALL_NAV_MENU_ITEMS as readonly unknown[]).includes(value);
}

function isValidMenuItems(value: unknown): value is NavMenuItem[] {
  return Array.isArray(value) && value.every(isNavMenuItem) && new Set(value).size === value.length;
}

/** me/settings data (or a cache from before M3x) → the four M3x settings; unknown values fall back one by one. */
export function readNavigationSettings(data: unknown): NavigationSettingsFields {
  const v = data !== null && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const d = DEFAULT_NAVIGATION_SETTINGS;
  return {
    addButtonPlacement: isAddButtonPlacement(v.addButtonPlacement) ? v.addButtonPlacement : d.addButtonPlacement,
    syncHomeView: typeof v.syncHomeView === 'boolean' ? v.syncHomeView : d.syncHomeView,
    navMenuShowTaskCount: typeof v.navMenuShowTaskCount === 'boolean' ? v.navMenuShowTaskCount : d.navMenuShowTaskCount,
    navMenuItems: isValidMenuItems(v.navMenuItems) ? [...v.navMenuItems] : [...d.navMenuItems],
  };
}

export function isMenuItemAvailable(item: NavMenuItem): boolean {
  return AVAILABLE_MENU_ITEMS.includes(item);
}

/** True when the item already has a tab (menu keys equal the navTabs keys of the same screens). */
export function isOnTabBar(item: NavMenuItem, navTabs: readonly string[]): boolean {
  return navTabs.includes(item);
}

/** Items Browse shows: the menu in its order, without the ones on the tab bar and the ones without a screen yet. */
export function browseMenuItems(items: readonly NavMenuItem[], navTabs: readonly string[]): NavMenuItem[] {
  return items.filter((item) => isMenuItemAvailable(item) && !isOnTabBar(item, navTabs));
}

export function showMenuItem(items: readonly NavMenuItem[], item: NavMenuItem): NavMenuItem[] {
  return items.includes(item) ? [...items] : [...items, item];
}

export function hideMenuItem(items: readonly NavMenuItem[], item: NavMenuItem): NavMenuItem[] {
  return items.filter((current) => current !== item);
}

export function moveMenuItem(items: readonly NavMenuItem[], item: NavMenuItem, delta: -1 | 1): NavMenuItem[] {
  const from = items.indexOf(item);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= items.length) return [...items];
  const next = [...items];
  next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export interface MenuItemRow {
  item: NavMenuItem;
  shown: boolean;
}

/** Rows of the settings screen: shown items in menu order, then hidden ones in Todoist order. */
export function menuItemRows(items: readonly NavMenuItem[]): MenuItemRow[] {
  return [
    ...items.map((item) => ({ item, shown: true })),
    ...ALL_NAV_MENU_ITEMS.filter((item) => !items.includes(item)).map((item) => ({ item, shown: false })),
  ];
}
