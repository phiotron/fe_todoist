import {
  ALL_NAV_MENU_ITEMS,
  DEFAULT_NAVIGATION_SETTINGS,
  browseMenuItems,
  hideMenuItem,
  isMenuItemAvailable,
  menuItemRows,
  moveMenuItem,
  readNavigationSettings,
  showMenuItem,
} from '../navMenuModel';

describe('readNavigationSettings', () => {
  it('returns the defaults for a settings cache written before M3x', () => {
    expect(readNavigationSettings(undefined)).toEqual(DEFAULT_NAVIGATION_SETTINGS);
    expect(readNavigationSettings({ theme: 'KALE' })).toEqual(DEFAULT_NAVIGATION_SETTINGS);
    expect(DEFAULT_NAVIGATION_SETTINGS).toEqual({
      addButtonPlacement: 'RIGHT',
      syncHomeView: true,
      navMenuShowTaskCount: true,
      navMenuItems: ['INBOX', 'TODAY', 'UPCOMING', 'FILTERS_LABELS', 'REPORTING', 'BROWSE_TEMPLATES'],
    });
  });

  it('reads valid server values', () => {
    expect(
      readNavigationSettings({
        addButtonPlacement: 'LEFT',
        syncHomeView: false,
        navMenuShowTaskCount: false,
        navMenuItems: ['UPCOMING', 'INBOX'],
      }),
    ).toEqual({ addButtonPlacement: 'LEFT', syncHomeView: false, navMenuShowTaskCount: false, navMenuItems: ['UPCOMING', 'INBOX'] });
    expect(readNavigationSettings({ navMenuItems: [] }).navMenuItems).toEqual([]);
  });

  it('falls back field by field on unknown values', () => {
    const read = readNavigationSettings({
      addButtonPlacement: 'TOP',
      syncHomeView: 'no',
      navMenuShowTaskCount: null,
      navMenuItems: ['INBOX', 'HOME'],
    });
    expect(read).toEqual(DEFAULT_NAVIGATION_SETTINGS);
    expect(readNavigationSettings({ navMenuItems: ['INBOX', 'INBOX'] }).navMenuItems).toEqual(ALL_NAV_MENU_ITEMS);
  });
});

describe('browseMenuItems', () => {
  it('hides the items on the tab bar and the ones without a screen yet, keeping the menu order', () => {
    expect(browseMenuItems(ALL_NAV_MENU_ITEMS, ['INBOX', 'TODAY', 'UPCOMING', 'BROWSE'])).toEqual(['FILTERS_LABELS', 'BROWSE_TEMPLATES']);
    expect(browseMenuItems(['UPCOMING', 'TODAY', 'INBOX', 'REPORTING'], ['SEARCH', 'TODAY', 'BROWSE'])).toEqual([
      'UPCOMING',
      'INBOX',
    ]);
    expect(browseMenuItems([], ['SEARCH', 'TODAY', 'BROWSE'])).toEqual([]);
  });

  it('knows which items have a screen (Reporting = M10 has none yet; Browse templates = M11)', () => {
    expect(ALL_NAV_MENU_ITEMS.filter(isMenuItemAvailable)).toEqual(['INBOX', 'TODAY', 'UPCOMING', 'FILTERS_LABELS', 'BROWSE_TEMPLATES']);
  });
});

describe('editing the menu', () => {
  it('shows a hidden item at the end, hides a shown one, ignores no-ops', () => {
    expect(showMenuItem(['TODAY'], 'INBOX')).toEqual(['TODAY', 'INBOX']);
    expect(showMenuItem(['TODAY'], 'TODAY')).toEqual(['TODAY']);
    expect(hideMenuItem(['TODAY', 'INBOX'], 'TODAY')).toEqual(['INBOX']);
    expect(hideMenuItem(['INBOX'], 'TODAY')).toEqual(['INBOX']);
  });

  it('moves a shown item up or down, staying inside the list', () => {
    expect(moveMenuItem(['INBOX', 'TODAY', 'UPCOMING'], 'UPCOMING', -1)).toEqual(['INBOX', 'UPCOMING', 'TODAY']);
    expect(moveMenuItem(['INBOX', 'TODAY'], 'INBOX', 1)).toEqual(['TODAY', 'INBOX']);
    expect(moveMenuItem(['INBOX', 'TODAY'], 'INBOX', -1)).toEqual(['INBOX', 'TODAY']);
    expect(moveMenuItem(['INBOX', 'TODAY'], 'UPCOMING', 1)).toEqual(['INBOX', 'TODAY']);
  });

  it('lists the shown items first (menu order), then the hidden ones (Todoist order)', () => {
    expect(menuItemRows(['UPCOMING', 'INBOX'])).toEqual([
      { item: 'UPCOMING', shown: true },
      { item: 'INBOX', shown: true },
      { item: 'TODAY', shown: false },
      { item: 'FILTERS_LABELS', shown: false },
      { item: 'REPORTING', shown: false },
      { item: 'BROWSE_TEMPLATES', shown: false },
    ]);
  });
});
