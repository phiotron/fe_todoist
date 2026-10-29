import { act, fireEvent, screen } from '@testing-library/react-native';
const React = require('react');
import { Profiler, type ReactElement } from 'react';
import type { Project, Task } from '../../../api/models';
import { jsonResponse } from '../../../test/http';
import { inboxProject, makeProject, makeSection, makeTask, page } from '../../../test/m1Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { viewOptionsRoutes } from '../../../test/viewOptionsServer';
import { ProjectScreen } from '../../projects/ProjectScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
const mockNow = new Date('2026-10-23T03:00:00Z');
jest.mock('../../../lib/useNow', () => ({ useNow: () => mockNow }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));
// Every TaskRowView render draws exactly one Checkbox: counting them = counting row renders.
const mockCounts = { rowRenders: 0 };
jest.mock('../../tasks/Checkbox', () => {
  const actual = jest.requireActual('../../tasks/Checkbox');
  return { ...actual, Checkbox: (props: object) => { mockCounts.rowRenders += 1; return actual.Checkbox(props); } };
});

// Same stand-in as perf.rows.test: every row drawn (what a device ends up with once the window has filled).
jest.mock('react-native/Libraries/Lists/FlatList', () => {
  const R = require('react');
  const { View } = require('react-native');
  const All = R.forwardRef(function All(props: any, ref: any) {
    R.useImperativeHandle(ref, () => ({ scrollToOffset: () => undefined, scrollToIndex: () => undefined, scrollToEnd: () => undefined }));
    const { data, renderItem, keyExtractor, ListHeaderComponent, ListFooterComponent, testID } = props;
    return (
      <View testID={testID}>
        {ListHeaderComponent}
        {((data ?? []) as unknown[]).map((item, index) => <R.Fragment key={keyExtractor(item, index)}>{renderItem({ item, index })}</R.Fragment>)}
        {ListFooterComponent}
      </View>
    );
  });
  return { __esModule: true, default: All };
});

const mine = makeProject({ id: 'p1', name: 'Website MA Global' });
const sections = ['a', 'b', 'c', 'd', 'e'].map((k, i) => makeSection({ id: `s${k}`, projectId: 'p1', name: `Muc ${k}`, sortOrder: 1024 * (i + 1) }));
function projectTasks(n: number): Task[] {
  return Array.from({ length: n }, (_, i) =>
    makeTask({
      id: `t${i}`, projectId: 'p1', projectName: 'Website MA Global', content: `Viec ${i} can lam`,
      description: i % 3 === 0 ? 'Mo ta ngan' : '', sectionId: i % 6 === 5 ? null : `s${'abcde'[i % 5]}`,
      dueDate: i % 2 === 0 ? '2026-10-23' : null, priority: (i % 4) + 1, sortOrder: 1024 * (i + 1),
      commentCount: i % 5 === 0 ? 2 : 0,
    }),
  );
}

type TreeNode = { type: string; props?: Record<string, unknown>; children?: (TreeNode | string)[] | null };
function find(node: TreeNode | string | null | undefined, testID: string): TreeNode | null {
  if (!node || typeof node === 'string') return null;
  if (node.props?.testID === testID) return node;
  for (const child of node.children ?? []) { const hit = find(child, testID); if (hit) return hit; }
  return null;
}
function hosts(node: TreeNode | string): number {
  if (typeof node === 'string') return 0;
  return 1 + (node.children ?? []).reduce((sum: number, c) => sum + hosts(c), 0);
}
function texts(node: TreeNode | string): number {
  if (typeof node === 'string') return 0;
  return (node.type === 'Text' ? 1 : 0) + (node.children ?? []).reduce((sum: number, c) => sum + texts(c), 0);
}

const HOOKS = ['useState', 'useReducer', 'useEffect', 'useLayoutEffect', 'useRef', 'useMemo', 'useCallback', 'useContext', 'useImperativeHandle', 'useSyncExternalStore'] as const;

async function mountProject(n: number, ui: ReactElement = <ProjectScreen projectId="p1" />) {
  const stats = { commits: 0, ms: 0 };
  const hookCalls: Record<string, number> = {};
  const spies = HOOKS.map((name) => {
    const original = (React as any)[name];
    return jest.spyOn(React as any, name).mockImplementation(((...args: unknown[]) => { hookCalls[name] = (hookCalls[name] ?? 0) + 1; return original(...args); }) as never);
  });
  const tasks = projectTasks(n);
  mockCounts.rowRenders = 0;
  const rendered = await renderSignedIn(
    <Profiler id="s" onRender={(_i, _p, actual) => { stats.commits += 1; stats.ms += actual; }}>{ui}</Profiler>,
    {
      ...viewOptionsRoutes(['project:p1'], []),
      'GET /api/v1/tasks': () => jsonResponse(200, page(tasks)),
      'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, mine] as Project[]),
      'GET /api/v1/projects/p1': () => jsonResponse(200, mine),
      'GET /api/v1/projects/p1/sections': () => jsonResponse(200, sections),
      'GET /api/v1/workspaces': () => jsonResponse(200, []),
    },
  );
  await screen.findByText('Viec 0 can lam');
  for (let i = 0; i < 6; i += 1) await act(() => new Promise((resolve) => setTimeout(resolve, 150)));
  spies.forEach((spy) => spy.mockRestore());
  return { stats, hookCalls, rendered };
}

describe('PERF rowcost (project screen)', () => {
  jest.setTimeout(180000);
  it('baseline', async () => {
    const small = await mountProject(1);
    const base = { ...small.hookCalls };
    const baseRender = small.stats.ms;
    small.rendered.unmount();
    const N = 299;
    const big = await mountProject(N);
    const tree = screen.toJSON() as unknown as TreeNode;
    const row = find(tree, 'drop-task-t3')!;
    const perRowHooks: Record<string, number> = {};
    let total = 0;
    for (const name of HOOKS) {
      const delta = (big.hookCalls[name] ?? 0) - (base[name] ?? 0);
      perRowHooks[name] = +(delta / (N - 1)).toFixed(1);
      total += delta / (N - 1);
    }
    const rowsInTree = screen.queryAllByTestId(/^task-row-/).length;
    const mountRenders = mockCounts.rowRenders;
    const swipeMounted = screen.queryAllByTestId(/^task-swipe-/).length;
    await fireEvent(screen.getByTestId('task-row-t3'), 'longPress');
    await act(() => new Promise((resolve) => setTimeout(resolve, 100)));
    const selectStart = mockCounts.rowRenders - mountRenders;
    const before2 = mockCounts.rowRenders;
    await fireEvent.press(screen.getByTestId('task-row-t4'));
    await act(() => new Promise((resolve) => setTimeout(resolve, 100)));
    const selectToggle = mockCounts.rowRenders - before2;

    const result = {
      swipeMounted,
      rowsInTree, rowHosts: hosts(row), rowTexts: texts(row), hooksPerRow: +total.toFixed(1), perRowHooks,
      mountCommits: big.stats.commits, mountMs: Math.round(big.stats.ms), smallMountMs: Math.round(baseRender),
      mountRowRenders: mountRenders, rendersPerRow: +(mountRenders / N).toFixed(2), selectStartRenders: selectStart, selectToggleRenders: selectToggle,
    };
    console.log(`ROWCOST ${JSON.stringify(result)}`);
    expect(rowsInTree).toBeGreaterThan(250);
  });

  it('drag start', async () => {
    await mountProject(299);
    const before = mockCounts.rowRenders;
    fireEvent(screen.getByTestId('task-row-t10'), 'responderGrant', { nativeEvent: { pageX: 50, pageY: 50 } });
    await act(() => new Promise((resolve) => setTimeout(resolve, 400)));
    expect(screen.queryByTestId('drag-ghost')).not.toBeNull();
    console.log(`DRAGCOST ${JSON.stringify({ dragStartRenders: mockCounts.rowRenders - before })}`);
  });
});
