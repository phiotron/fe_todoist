import '../../../i18n';
import { PROJECT_COLORS } from '../../../api/models';
import { inboxProject, makeProject } from '../../../test/m1Fixtures';
import { PROJECT_PALETTE } from '../../../theme';
import { asProjectColor, projectColorHex, projectDisplayName } from '../appearance';
import {
  MAX_PROJECT_DEPTH,
  deleteImpact,
  descendantIds,
  parentChoices,
  projectDepth,
  projectTreeRows,
} from '../projectTree';

// work (2 open) > work-a (3 open) > work-a1 (1 open); home; work-b under work. The server counts descendants for us.
const work = makeProject({
  id: 'work',
  name: 'Công ty',
  sortOrder: 1024,
  activeTaskCount: 2,
  descendantProjectCount: 3,
  descendantActiveTaskCount: 4, // work-a 3 + work-a1 1, NOT including work's own 2
});
const workA = makeProject({ id: 'work-a', name: 'Kế hoạch', parentId: 'work', sortOrder: 2048, activeTaskCount: 3 });
const workA1 = makeProject({ id: 'work-a1', name: 'Q4', parentId: 'work-a', sortOrder: 1024, activeTaskCount: 1 });
const workB = makeProject({ id: 'work-b', name: 'Nhân sự', parentId: 'work', sortOrder: 1024 });
const home = makeProject({ id: 'home', name: 'Nhà', sortOrder: 2048 });
const all = [inboxProject, home, workA1, workA, work, workB];

describe('project colours', () => {
  it('maps the 20 colour keys to the Taskly palette with a charcoal fallback', () => {
    for (const color of PROJECT_COLORS) expect(projectColorHex(color)).toBe(PROJECT_PALETTE[color]);
    expect(projectColorHex(null)).toBe(PROJECT_PALETTE.charcoal);
    expect(projectColorHex('not-a-colour')).toBe(PROJECT_PALETTE.charcoal);
    expect(asProjectColor('red')).toBe('red');
    expect(asProjectColor(undefined)).toBe('charcoal');
    expect(projectDisplayName(inboxProject)).toBe('Hộp thư đến');
    expect(projectDisplayName(work)).toBe('Công ty');
  });
});

describe('project tree', () => {
  it('lists projects without the Inbox, parents before children, siblings by sortOrder, with depth', () => {
    expect(projectTreeRows(all).map((row) => [row.project.id, row.depth, row.hasChildren])).toEqual([
      ['work', 1, true],
      ['work-b', 2, false],
      ['work-a', 2, true],
      ['work-a1', 3, false],
      ['home', 1, false],
    ]);
  });

  it('hides the children of collapsed projects and shows orphans as roots', () => {
    expect(projectTreeRows(all, new Set(['work'])).map((row) => row.project.id)).toEqual(['work', 'home']);
    const orphan = makeProject({ id: 'orphan', parentId: 'gone', sortOrder: 1 });
    expect(projectTreeRows([orphan]).map((row) => [row.project.id, row.depth])).toEqual([['orphan', 1]]);
  });

  it('finds the descendants of a project (used to keep the parent picker free of cycles)', () => {
    expect(descendantIds(all, 'work').sort()).toEqual(['work-a', 'work-a1', 'work-b']);
    expect(descendantIds(all, 'home')).toEqual([]);
  });

  it('delete confirmation numbers come from the server: sub-projects and own + descendant open tasks (spec 3.1)', () => {
    expect(deleteImpact(work)).toEqual({ subprojects: 3, openTasks: 6 });
    expect(deleteImpact(home)).toEqual({ subprojects: 0, openTasks: 0 });
    // Only part of the tree is loaded (e.g. the archived list): the response counts still win over anything re-summed here.
    const partial = makeProject({ id: 'x', activeTaskCount: 1, descendantProjectCount: 4, descendantActiveTaskCount: 9 });
    expect(deleteImpact(partial)).toEqual({ subprojects: 4, openTasks: 10 });
  });

  it('offers only parents that keep the tree within 3 levels and never the project itself or its subtree', () => {
    expect(MAX_PROJECT_DEPTH).toBe(3);
    expect(projectDepth(all, 'work-a1')).toBe(3);
    // A new project may go under anything at depth ≤ 2.
    expect(parentChoices(all).map((p) => p.id)).toEqual(['work', 'work-b', 'work-a', 'home']);
    // work-a has a child (height 2): its parent must be at depth 1, and it cannot go under itself / its child.
    expect(parentChoices(all, 'work-a').map((p) => p.id)).toEqual(['work', 'home']);
    // work has height 3: it can only stay a root.
    expect(parentChoices(all, 'work')).toEqual([]);
  });
});
