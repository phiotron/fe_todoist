import {
  DEFAULT_NAV_TABS,
  addTab,
  addableFixedTabs,
  canAddTab,
  canRemoveTab,
  effectiveNavTabs,
  isValidNavTabs,
  isValidStartPage,
  moveTab,
  parsePin,
  pinKey,
  pinnedOf,
  removeTab,
  reorderTabs,
  setPin,
  startPageRoutes,
  tabHref,
} from '../navTabsModel';

const P1 = '11111111-1111-4111-8111-111111111111';
const P2 = '22222222-2222-4222-8222-222222222222';
const L1 = '33333333-3333-4333-8333-333333333333';

describe('parsePin / pinKey', () => {
  it('reads project / label / filter pins and rejects anything else', () => {
    expect(parsePin(`project:${P1}`)).toEqual({ kind: 'project', id: P1 });
    expect(parsePin(`label:${L1}`)).toEqual({ kind: 'label', id: L1 });
    expect(parsePin(`filter:${P2}`)).toEqual({ kind: 'filter', id: P2 });
    expect(parsePin('project:abc')).toBeNull();
    expect(parsePin(`task:${P1}`)).toBeNull();
    expect(parsePin('TODAY')).toBeNull();
    expect(pinKey({ kind: 'label', id: L1 })).toBe(`label:${L1}`);
  });
});

describe('isValidNavTabs', () => {
  it.each([
    [['INBOX', 'TODAY', 'UPCOMING', 'BROWSE'], true],
    [['TODAY', 'SEARCH', 'BROWSE'], true],
    [['INBOX', 'TODAY', 'UPCOMING', `project:${P1}`, 'BROWSE'], true],
    [['INBOX', 'TODAY', 'TEAM', 'BROWSE'], true], // TEAM (M8) is a known key: accepted, never offered
    [['TODAY', 'BROWSE'], false],
    [['INBOX', 'TODAY', 'UPCOMING', 'SEARCH', 'FILTERS_LABELS', 'BROWSE'], false],
    [['BROWSE', 'TODAY', 'INBOX'], false],
    [['TODAY', 'TODAY', 'BROWSE'], false],
    [['TODAY', `project:${P1}`, `label:${L1}`, 'BROWSE'], false],
    [['TODAY', 'TRASH', 'BROWSE'], false],
    [['TODAY', 'INBOX', 'BROWSE', 'BROWSE'], false],
    ['TODAY,INBOX,BROWSE', false],
    [null, false],
  ])('%p → %p', (value, expected) => {
    expect(isValidNavTabs(value)).toBe(expected);
  });
});

describe('isValidStartPage', () => {
  it('accepts Inbox, Today, Upcoming and one project / label / filter', () => {
    for (const page of ['INBOX', 'TODAY', 'UPCOMING', `project:${P1}`, `label:${L1}`, `filter:${P2}`]) {
      expect(isValidStartPage(page)).toBe(true);
    }
    for (const page of ['BROWSE', 'SEARCH', 'TEAM', 'project:x', '', 7, null]) {
      expect(isValidStartPage(page)).toBe(false);
    }
  });
});

describe('effectiveNavTabs', () => {
  it('keeps a valid list as is', () => {
    const tabs = ['TODAY', 'INBOX', `project:${P1}`, 'BROWSE'];
    expect(effectiveNavTabs(tabs)).toEqual(tabs);
  });

  it('falls back to the default for an invalid list', () => {
    expect(effectiveNavTabs(['TODAY'])).toEqual(DEFAULT_NAV_TABS);
    expect(effectiveNavTabs(undefined)).toEqual(DEFAULT_NAV_TABS);
  });

  it('drops a pin whose target no longer exists, and only when the list of targets is known', () => {
    const tabs = ['TODAY', 'INBOX', `project:${P1}`, 'BROWSE'];
    expect(effectiveNavTabs(tabs, { project: new Set([P2]) })).toEqual(['TODAY', 'INBOX', 'BROWSE']);
    expect(effectiveNavTabs(tabs, { project: new Set([P1]) })).toEqual(tabs);
    expect(effectiveNavTabs(tabs, { label: new Set() })).toEqual(tabs);
  });

  it('uses the default when dropping the stale pin leaves fewer than 3 tabs', () => {
    expect(effectiveNavTabs(['TODAY', `label:${L1}`, 'BROWSE'], { label: new Set() })).toEqual(DEFAULT_NAV_TABS);
  });
});

describe('editing the tab bar', () => {
  const four = ['INBOX', 'TODAY', 'UPCOMING', 'BROWSE'];

  it('lists the fixed tabs that can still be added (never Browse)', () => {
    expect(addableFixedTabs(four)).toEqual(['SEARCH', 'FILTERS_LABELS']);
    expect(addableFixedTabs(['TODAY', 'BROWSE', 'INBOX'])).toEqual(['UPCOMING', 'SEARCH', 'FILTERS_LABELS']);
  });

  it('accepts TEAM from the server (M8) but never offers or adds it', () => {
    expect(addableFixedTabs(['INBOX', 'TODAY', 'BROWSE'])).not.toContain('TEAM');
    expect(addTab(four, 'TEAM')).toEqual(four);
    const withTeam = ['INBOX', 'TODAY', 'TEAM', 'BROWSE'];
    expect(effectiveNavTabs(withTeam)).toEqual(withTeam);
    expect(removeTab(withTeam, 'TEAM')).toEqual(['INBOX', 'TODAY', 'BROWSE']);
    expect(moveTab(withTeam, 'TEAM', -1)).toEqual(['INBOX', 'TEAM', 'TODAY', 'BROWSE']);
  });

  it('adds before Browse, up to 5 tabs', () => {
    expect(canAddTab(four)).toBe(true);
    const five = addTab(four, 'SEARCH');
    expect(five).toEqual(['INBOX', 'TODAY', 'UPCOMING', 'SEARCH', 'BROWSE']);
    expect(canAddTab(five)).toBe(false);
    expect(addTab(five, 'FILTERS_LABELS')).toEqual(five);
    expect(addTab(four, 'TODAY')).toEqual(four);
  });

  it('removes any tab but Browse, keeping at least 3', () => {
    expect(canRemoveTab(four, 'UPCOMING')).toBe(true);
    expect(canRemoveTab(four, 'BROWSE')).toBe(false);
    const three = removeTab(four, 'UPCOMING');
    expect(three).toEqual(['INBOX', 'TODAY', 'BROWSE']);
    expect(canRemoveTab(three, 'INBOX')).toBe(false);
    expect(removeTab(three, 'INBOX')).toEqual(three);
  });

  it('moves a tab up or down but never past Browse; Browse never moves', () => {
    expect(moveTab(four, 'TODAY', -1)).toEqual(['TODAY', 'INBOX', 'UPCOMING', 'BROWSE']);
    expect(moveTab(four, 'TODAY', 1)).toEqual(['INBOX', 'UPCOMING', 'TODAY', 'BROWSE']);
    expect(moveTab(four, 'INBOX', -1)).toEqual(four);
    expect(moveTab(four, 'UPCOMING', 1)).toEqual(four);
    expect(moveTab(four, 'BROWSE', -1)).toEqual(four);
  });

  it('after a drag, Browse goes back to the end', () => {
    expect(reorderTabs(['BROWSE', 'TODAY', 'INBOX', 'UPCOMING'])).toEqual(['TODAY', 'INBOX', 'UPCOMING', 'BROWSE']);
  });

  it('pins one item: replaces the current pin, otherwise needs room', () => {
    const pinned = setPin(four, { kind: 'project', id: P1 });
    expect(pinned).toEqual(['INBOX', 'TODAY', 'UPCOMING', `project:${P1}`, 'BROWSE']);
    expect(pinnedOf(pinned ?? [])).toEqual({ kind: 'project', id: P1 });
    expect(setPin(pinned ?? [], { kind: 'label', id: L1 })).toEqual([
      'INBOX',
      'TODAY',
      'UPCOMING',
      `label:${L1}`,
      'BROWSE',
    ]);
    expect(setPin(['INBOX', 'TODAY', 'UPCOMING', 'SEARCH', 'BROWSE'], { kind: 'project', id: P1 })).toBeNull();
    expect(pinnedOf(four)).toBeNull();
  });
});

describe('routes', () => {
  it('maps every tab to its route', () => {
    expect(['INBOX', 'TODAY', 'UPCOMING', 'SEARCH', 'FILTERS_LABELS', 'TEAM', 'BROWSE', `project:${P1}`].map(tabHref)).toEqual([
      '/inbox',
      '/today',
      '/upcoming',
      '/search',
      '/filters-labels',
      '/team',
      '/browse',
      '/pinned',
    ]);
  });

  it('opens a fixed start page as a tab', () => {
    expect(startPageRoutes('UPCOMING', DEFAULT_NAV_TABS)).toEqual(['/upcoming']);
    expect(startPageRoutes('INBOX', ['TODAY', 'SEARCH', 'BROWSE'])).toEqual(['/inbox']);
  });

  it('opens a pinned start page in the pinned tab, otherwise on top of Browse', () => {
    const tabs = ['TODAY', `project:${P1}`, 'BROWSE'];
    expect(startPageRoutes(`project:${P1}`, tabs)).toEqual(['/pinned']);
    expect(startPageRoutes(`label:${L1}`, tabs)).toEqual(['/browse', `/label/${L1}`]);
    expect(startPageRoutes(`filter:${P2}`, DEFAULT_NAV_TABS)).toEqual(['/browse', `/filter/${P2}`]);
  });

  it('falls back to Today for a start page that no longer exists or is invalid', () => {
    expect(startPageRoutes(`project:${P1}`, DEFAULT_NAV_TABS, { project: new Set([P2]) })).toEqual(['/today']);
    expect(startPageRoutes('NOWHERE', DEFAULT_NAV_TABS)).toEqual(['/today']);
  });
});
