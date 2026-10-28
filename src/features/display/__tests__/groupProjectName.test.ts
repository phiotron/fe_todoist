import { makeTask } from '../../../test/m1Fixtures';
import { groupTasks, type GroupContext } from '../groupTasks';

/** VIUI: grouping by project titles the Inbox group in the app language (through the context's name resolver). */
describe('groupTasks by project — Inbox title', () => {
  const tasks = [
    makeTask({ id: 'a', projectId: 'p-inbox', projectName: 'Inbox' }),
    makeTask({ id: 'b', projectId: 'p-1', projectName: 'Nhà' }),
  ];

  it('uses the context resolver for the group title', () => {
    const ctx: GroupContext = {
      todayKey: '2026-10-23',
      labels: new Map(),
      projectName: (projectId, name) => (projectId === 'p-inbox' ? 'Hộp thư đến' : (name ?? '')),
    };
    expect(groupTasks(tasks, 'PROJECT', ctx).map((group) => group.title)).toEqual(['Hộp thư đến', 'Nhà']);
  });

  it('without a resolver keeps the server name', () => {
    const ctx: GroupContext = { todayKey: '2026-10-23', labels: new Map() };
    expect(groupTasks(tasks, 'PROJECT', ctx).map((group) => group.title)).toEqual(['Inbox', 'Nhà']);
  });
});
