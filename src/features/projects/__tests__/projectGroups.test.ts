import { makeSection, makeTask } from '../../../test/m1Fixtures';
import { groupProjectTasks } from '../projectGroups';

describe('groupProjectTasks', () => {
  const s1 = makeSection({ id: 's1', sortOrder: 2048 });
  const s2 = makeSection({ id: 's2', sortOrder: 1024 });

  it('puts "no section" first, then sections by sortOrder; hides completed tasks; nests subtasks', () => {
    const groups = groupProjectTasks(
      [
        makeTask({ id: 'a' }),
        makeTask({ id: 'b', sectionId: 's1' }),
        makeTask({ id: 'b1', sectionId: 's1', parentId: 'b' }),
        makeTask({ id: 'b2', sectionId: 's1', parentId: 'b', completedAt: '2026-10-22T00:00:00Z' }),
        makeTask({ id: 'done', sectionId: 's1', completedAt: '2026-10-22T00:00:00Z' }),
        makeTask({ id: 'c', sectionId: 's2' }),
        makeTask({ id: 'lost', sectionId: 'unknown-section' }),
      ],
      [s1, s2],
    );

    expect(groups.map((g) => g.section?.id ?? null)).toEqual([null, 's2', 's1']);
    expect(groups[0].rows.map((r) => r.task.id)).toEqual(['a', 'lost']);
    expect(groups[2].rows.map((r) => [r.task.id, r.depth])).toEqual([
      ['b', 1],
      ['b1', 2],
    ]);
    expect(groups[2].rootTasks.map((t) => t.id)).toEqual(['b']);
  });
});
