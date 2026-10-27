import { buildTabItems, pinKinds, type TabDefLike } from '../tabBarItems';

const P1 = '11111111-1111-4111-8111-111111111111';
const L1 = '33333333-3333-4333-8333-333333333333';

const DEFS: TabDefLike[] = [
  { key: 'INBOX', route: 'inbox', title: () => 'Inbox', icon: 'inbox' },
  { key: 'TODAY', route: 'today', title: () => 'Today', icon: 'calendar' },
  { key: 'UPCOMING', route: 'upcoming', title: () => 'Upcoming', icon: 'calendar' },
  { key: 'SEARCH', route: 'search', title: () => 'Search', icon: 'search' },
  { key: 'BROWSE', route: 'browse', title: () => 'Browse', icon: 'grid' },
];
const nameOf = (pin: { kind: string; id: string }) => (pin.id === P1 ? 'Marketing' : null);

describe('buildTabItems', () => {
  it('turns navTabs into tab items in the same order', () => {
    const items = buildTabItems(['TODAY', 'SEARCH', 'BROWSE'], DEFS, nameOf, 'Gone');
    expect(items.map((item) => [item.key, item.route, item.title])).toEqual([
      ['TODAY', 'today', 'Today'],
      ['SEARCH', 'search', 'Search'],
      ['BROWSE', 'browse', 'Browse'],
    ]);
  });

  it('a pinned target becomes the pinned tab, titled with its name and icon of its kind', () => {
    const items = buildTabItems(['TODAY', `project:${P1}`, 'BROWSE'], DEFS, nameOf, 'Gone');
    expect(items[1]).toEqual({ key: `project:${P1}`, route: 'pinned', title: 'Marketing', icon: 'hash' });
    expect(buildTabItems(['TODAY', `label:${L1}`, 'BROWSE'], DEFS, () => 'urgent', 'Gone')[1]).toMatchObject({ route: 'pinned', icon: 'tag' });
    expect(buildTabItems(['TODAY', `filter:${L1}`, 'BROWSE'], DEFS, () => 'Next 7', 'Gone')[1]).toMatchObject({ icon: 'filter' });
  });

  it('a pinned target whose name is not known yet keeps a neutral title', () => {
    expect(buildTabItems(['TODAY', `project:${L1}`, 'BROWSE'], DEFS, nameOf, 'Gone')[1].title).toBe('Gone');
  });

  it('skips a key that has no definition (an unknown key, or TEAM before M8 gives it a tab)', () => {
    expect(buildTabItems(['TODAY', 'NOPE', 'BROWSE'], DEFS, nameOf, 'Gone').map((item) => item.key)).toEqual(['TODAY', 'BROWSE']);
    expect(buildTabItems(['TODAY', 'TEAM', 'BROWSE'], DEFS, nameOf, 'Gone').map((item) => item.key)).toEqual(['TODAY', 'BROWSE']);
  });
});

describe('pinKinds', () => {
  it('lists the kind of the pinned item, if any (only that list needs to be fetched)', () => {
    expect(pinKinds(['TODAY', `project:${P1}`, 'BROWSE'])).toEqual(['project']);
    expect(pinKinds(['TODAY', 'INBOX', 'BROWSE'])).toEqual([]);
    expect(pinKinds(undefined)).toEqual([]);
  });
});
