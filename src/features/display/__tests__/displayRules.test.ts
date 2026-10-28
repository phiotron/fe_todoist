import { makeViewOptions } from '../../../test/m2Fixtures';
import {
  DUE_FILTERS,
  LAYOUTS,
  VIEW_RULES,
  layoutOf,
  defaultViewOptions,
  filterViewKey,
  isDefaultViewOptions,
  labelViewKey,
  projectViewKey,
  resolveViewOptions,
  toDisplayParams,
  toViewOptionsBody,
  viewKindOf,
} from '../displayRules';

describe('view keys', () => {
  it('builds and reads every kind', () => {
    expect(projectViewKey('p-1')).toBe('project:p-1');
    expect(labelViewKey('l-1')).toBe('label:l-1');
    expect(filterViewKey('f-1')).toBe('filter:f-1');
    expect(viewKindOf('TODAY')).toBe('today');
    expect(viewKindOf('UPCOMING')).toBe('upcoming');
    expect(viewKindOf('project:p-1')).toBe('project');
    expect(viewKindOf('label:l-1')).toBe('label');
    expect(viewKindOf('filter:f-1')).toBe('filter');
  });
});

describe('VIEW_RULES (spec 12.7 table)', () => {
  it('lists the default first', () => {
    expect(VIEW_RULES.today.sorts[0]).toBe('DATE');
    expect(VIEW_RULES.upcoming.sorts[0]).toBe('DATE');
    expect(VIEW_RULES.project.sorts[0]).toBe('MANUAL');
    expect(VIEW_RULES.label.sorts[0]).toBe('DATE');
    expect(VIEW_RULES.filter.sorts[0]).toBe('DATE');
  });

  it('allows grouping per view as in the spec', () => {
    expect(VIEW_RULES.today.groups).toEqual(['NONE', 'PRIORITY', 'PROJECT', 'LABEL', 'DEADLINE', 'ADDED']);
    expect(VIEW_RULES.upcoming.groups).toEqual(['NONE']);
    expect(VIEW_RULES.project.groups).toEqual(['NONE', 'DATE', 'DEADLINE', 'PRIORITY', 'LABEL', 'ADDED']);
    expect(VIEW_RULES.label.groups).toEqual(['NONE', 'DATE', 'DEADLINE', 'PRIORITY', 'PROJECT', 'LABEL', 'ADDED']);
    expect(VIEW_RULES.project.sorts).not.toContain('PROJECT');
    expect(VIEW_RULES.today.sorts).not.toContain('MANUAL');
  });

  it('has the Completed tasks switch on projects, Today and Upcoming (M7), not on labels / filters', () => {
    expect(VIEW_RULES.project.hasCompleted && VIEW_RULES.today.hasCompleted && VIEW_RULES.upcoming.hasCompleted).toBe(true);
    expect(VIEW_RULES.label.hasCompleted || VIEW_RULES.filter.hasCompleted).toBe(false);
  });

  it('offers only the due filters the server accepts: no "no date" at Today, neither it nor "overdue" at Upcoming (400)', () => {
    expect(VIEW_RULES.today.dueFilters).toEqual(['TODAY', 'THIS_WEEK', 'NEXT_7_DAYS', 'THIS_MONTH', 'NEXT_30_DAYS', 'OVERDUE']);
    expect(VIEW_RULES.upcoming.dueFilters).toEqual(['TODAY', 'THIS_WEEK', 'NEXT_7_DAYS', 'THIS_MONTH', 'NEXT_30_DAYS']);
    for (const kind of ['project', 'label', 'filter'] as const) expect(VIEW_RULES[kind].dueFilters).toEqual(DUE_FILTERS);
  });
});

describe('defaults and saved options', () => {
  it('gives the default of each view', () => {
    expect(defaultViewOptions('TODAY')).toEqual(makeViewOptions('TODAY', { showCompleted: false }));
    expect(defaultViewOptions('project:p-1')).toEqual(
      makeViewOptions('project:p-1', { sortBy: 'MANUAL', showCompleted: false }),
    );
  });

  it('returns the saved options of the view', () => {
    const saved = [
      makeViewOptions('UPCOMING', { sortBy: 'NAME' }),
      makeViewOptions('TODAY', { sortBy: 'PRIORITY', sortDirection: 'DESC', groupBy: 'PROJECT', filterDue: 'OVERDUE', showCompleted: false }),
    ];
    expect(resolveViewOptions('TODAY', saved)).toEqual(saved[1]);
  });

  it('falls back to defaults for a missing view or values the view does not allow', () => {
    expect(resolveViewOptions('TODAY', undefined)).toEqual(defaultViewOptions('TODAY'));
    const odd = makeViewOptions('UPCOMING', {
      sortBy: 'MANUAL',
      groupBy: 'PROJECT',
      filterPriority: 9,
      showCompleted: true,
    });
    expect(resolveViewOptions('UPCOMING', [odd])).toEqual({ ...defaultViewOptions('UPCOMING'), showCompleted: true });
  });

  it('drops a saved due filter the view does not accept, keeps one it does', () => {
    expect(resolveViewOptions('TODAY', [makeViewOptions('TODAY', { filterDue: 'NO_DATE' })]).filterDue).toBeNull();
    expect(resolveViewOptions('UPCOMING', [makeViewOptions('UPCOMING', { filterDue: 'OVERDUE' })]).filterDue).toBeNull();
    expect(resolveViewOptions('TODAY', [makeViewOptions('TODAY', { filterDue: 'OVERDUE' })]).filterDue).toBe('OVERDUE');
    expect(resolveViewOptions('label:l-1', [makeViewOptions('label:l-1', { filterDue: 'NO_DATE' })]).filterDue).toBe('NO_DATE');
  });

  it('keeps showCompleted false (not null) on projects', () => {
    expect(resolveViewOptions('project:p-1', [makeViewOptions('project:p-1', { sortBy: 'NAME' })]).showCompleted).toBe(
      false,
    );
  });

  it('tells whether the options are the defaults', () => {
    expect(isDefaultViewOptions('TODAY', defaultViewOptions('TODAY'))).toBe(true);
    expect(isDefaultViewOptions('TODAY', makeViewOptions('TODAY', { filterPriority: 1 }))).toBe(false);
  });
});

describe('M7 layout and future occurrences', () => {
  it('offers the three layouts, List first, and reads an unknown / absent layout as List', () => {
    expect(LAYOUTS).toEqual(['LIST', 'BOARD', 'CALENDAR']);
    expect(layoutOf({ layout: 'BOARD' })).toBe('BOARD');
    expect(layoutOf({})).toBe('LIST');
    expect(layoutOf({ layout: 'TIMELINE' as never })).toBe('LIST');
  });

  it('keeps the saved layout of the view and sends it in the body', () => {
    const saved = [makeViewOptions('label:l-1', { layout: 'CALENDAR' })];
    const options = resolveViewOptions('label:l-1', saved);
    expect(options.layout).toBe('CALENDAR');
    expect(isDefaultViewOptions('label:l-1', options)).toBe(false);
    expect(toViewOptionsBody(options).layout).toBe('CALENDAR');
  });

  it('has Future occurrences on Upcoming only, false by default', () => {
    expect(VIEW_RULES.upcoming.hasFutureOccurrences).toBe(true);
    expect(VIEW_RULES.today.hasFutureOccurrences || VIEW_RULES.project.hasFutureOccurrences).toBe(false);
    expect(defaultViewOptions('UPCOMING').showFutureOccurrences).toBe(false);
    expect(defaultViewOptions('TODAY').showFutureOccurrences).toBeNull();
    expect(resolveViewOptions('TODAY', [makeViewOptions('TODAY', { showFutureOccurrences: true })]).showFutureOccurrences).toBeNull();
    expect(toViewOptionsBody({ ...defaultViewOptions('UPCOMING'), showFutureOccurrences: true }).showFutureOccurrences).toBe(true);
    expect(toViewOptionsBody(defaultViewOptions('TODAY'))).not.toHaveProperty('showFutureOccurrences');
  });

  it('sends group=added for the Added date grouping', () => {
    expect(toDisplayParams(makeViewOptions('TODAY', { groupBy: 'ADDED' })).group).toBe('added');
  });
});

describe('to query parameters and to the PUT body', () => {
  it('always sends sort, order and group in lowercase; filters only when set', () => {
    expect(toDisplayParams(defaultViewOptions('project:p-1'))).toEqual({ sort: 'manual', order: 'asc', group: 'none' });
    expect(
      toDisplayParams(
        makeViewOptions('label:l-1', {
          sortBy: 'DEADLINE',
          sortDirection: 'DESC',
          groupBy: 'PROJECT',
          filterPriority: 2,
          filterLabelId: 'l-9',
          filterDue: 'NEXT_7_DAYS',
        }),
      ),
    ).toEqual({
      sort: 'deadline',
      order: 'desc',
      group: 'project',
      filterPriority: 2,
      filterLabelId: 'l-9',
      filterDue: 'next_7_days',
    });
  });

  it('leaves null fields out of the body', () => {
    expect(toViewOptionsBody(defaultViewOptions('TODAY'))).toEqual({
      sortBy: 'DATE',
      sortDirection: 'ASC',
      groupBy: 'NONE',
      showCompleted: false,
      layout: 'LIST',
    });
    expect(toViewOptionsBody(makeViewOptions('project:p-1', { sortBy: 'MANUAL', showCompleted: true, filterDue: 'TODAY' })))
      .toEqual({ sortBy: 'MANUAL', sortDirection: 'ASC', groupBy: 'NONE', filterDue: 'TODAY', showCompleted: true, layout: 'LIST' });
  });
});
