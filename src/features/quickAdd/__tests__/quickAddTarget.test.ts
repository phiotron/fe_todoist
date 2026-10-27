import { router } from 'expo-router';
import { NO_DUE } from '../../schedule/dueValue';
import { buildCreateBody } from '../buildTask';
import { openQuickAdd, parseQuickAddParams, quickAddTargetFor } from '../quickAddTarget';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

describe('quickAddTargetFor (spec 9.2)', () => {
  const ctx = { today: '2026-10-23', upcomingDay: '2026-10-27', projectId: 'p1' };

  it('Inbox and Browse add to the Inbox, Today adds due today, Upcoming adds on the viewed day', () => {
    expect(quickAddTargetFor('inbox', ctx)).toEqual({});
    expect(quickAddTargetFor('browse', ctx)).toEqual({});
    expect(quickAddTargetFor('today', ctx)).toEqual({ dueDate: '2026-10-23' });
    expect(quickAddTargetFor('upcoming', ctx)).toEqual({ dueDate: '2026-10-27' });
    expect(quickAddTargetFor('upcoming', { today: '2026-10-23' })).toEqual({ dueDate: '2026-10-23' });
  });

  it('a project screen adds to that project and section', () => {
    expect(quickAddTargetFor('project', { ...ctx, sectionId: 's1' })).toEqual({ projectId: 'p1', sectionId: 's1' });
    expect(quickAddTargetFor('project', { today: '2026-10-23' })).toEqual({});
  });

  it('opens the sheet with only the defined params, and reads route params back', () => {
    openQuickAdd({ projectId: 'p1', dueDate: undefined, sectionId: 's1' });
    expect(router.push).toHaveBeenCalledWith({ pathname: '/quick-add', params: { projectId: 'p1', sectionId: 's1' } });
    expect(parseQuickAddParams({ projectId: 'p1', parentId: ['t1', 'x'], dueDate: undefined, other: 'z' })).toEqual({
      projectId: 'p1',
      parentId: 't1',
    });
  });
});

describe('buildCreateBody', () => {
  it('sends the trimmed name and the priority; leaves out empty description, section, parent and due', () => {
    expect(buildCreateBody({ content: '  Mua sữa ', description: '  ', priority: 4, due: NO_DUE })).toEqual({
      content: 'Mua sữa',
      priority: 4,
    });
  });

  it('adds project, section, parent, description and the whole due when present', () => {
    expect(
      buildCreateBody({
        projectId: 'p1',
        sectionId: 's1',
        parentId: 't1',
        content: 'Họp',
        description: 'Phòng 3',
        priority: 1,
        due: { dueDate: null, dueDatetime: '2026-10-24T09:00:00', durationMinutes: 45 },
      }),
    ).toEqual({
      projectId: 'p1',
      sectionId: 's1',
      parentId: 't1',
      content: 'Họp',
      description: 'Phòng 3',
      priority: 1,
      dueDatetime: '2026-10-24T09:00:00',
      durationMinutes: 45,
    });
    expect(buildCreateBody({ content: 'A', description: '', priority: 4, due: { dueDate: '2026-10-24', dueDatetime: null, durationMinutes: null } })).toEqual({
      content: 'A',
      priority: 4,
      dueDate: '2026-10-24',
    });
  });
});
