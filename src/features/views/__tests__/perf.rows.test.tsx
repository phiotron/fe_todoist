import NetInfo from '@react-native-community/netinfo';
import { act, screen, waitFor } from '@testing-library/react-native';
import { Profiler, type ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import type { Project, Task } from '../../../api/models';
import { queryKeys } from '../../../api/queryKeys';
import { jsonResponse } from '../../../test/http';
import { inboxProject, makeProject, makeTask, page } from '../../../test/m1Fixtures';
import { makeSharedProject } from '../../../test/m8aFixtures';
import { createTestQueryClient } from '../../../test/render';
import { renderSignedIn } from '../../../test/screen';
import { viewOptionsRoutes } from '../../../test/viewOptionsServer';
import * as taskActions from '../../tasks/useTaskActions';
import { ProjectScreen } from '../../projects/ProjectScreen';
import { TodayScreen } from '../TodayScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));
// Every TaskRow render draws exactly one Checkbox: counting them = counting row renders.
const mockCounts = { rowRenders: 0 };
jest.mock('../../tasks/Checkbox', () => {
  const actual = jest.requireActual('../../tasks/Checkbox');
  return { ...actual, Checkbox: (props: object) => { mockCounts.rowRenders += 1; return actual.Checkbox(props); } };
});

// A device lays rows out, so FlatList's window grows until it covers the screen ± windowSize; jest has no layout and
// stops at initialNumToRender. This stand-in draws every row (what the device ends up with when the window is wide).
let mockRenderAll = false;
jest.mock('react-native/Libraries/Lists/FlatList', () => {
  const React = require('react');
  const { View } = require('react-native');
  const actual = jest.requireActual('react-native/Libraries/Lists/FlatList');
  const All = React.forwardRef(function All(props: any, ref: any) {
    React.useImperativeHandle(ref, () => ({ scrollToOffset: () => undefined, scrollToIndex: () => undefined, scrollToEnd: () => undefined }));
    const { data, renderItem, keyExtractor, ListHeaderComponent, ListFooterComponent, ListEmptyComponent, testID } = props;
    const items = (data ?? []) as unknown[];
    return (
      <View testID={testID}>
        {ListHeaderComponent}
        {items.length === 0 ? ListEmptyComponent : null}
        {items.map((item, index) => <React.Fragment key={keyExtractor(item, index)}>{renderItem({ item, index })}</React.Fragment>)}
        {ListFooterComponent}
      </View>
    );
  });
  const Switch = React.forwardRef((props: object, ref: unknown) =>
    mockRenderAll ? <All ref={ref} {...props} /> : <actual.default ref={ref} {...props} />,
  );
  return { __esModule: true, default: Switch };
});

const team = makeSharedProject({ id: 'pt', name: 'Nhóm', access: 'TEAM', joined: true, canManage: false, workspaceId: 'w1' }) as Project;
const mine = makeProject({ id: 'p1', name: 'Của tôi' });
const PROJECTS = ['p1', 'pt', inboxProject.id];

function manyTasks(n: number, projectFor: (i: number) => string): Task[] {
  return Array.from({ length: n }, (_, i) =>
    makeTask({ id: `t${i}`, projectId: projectFor(i), projectName: 'X', content: `Việc ${i}`, dueDate: '2026-10-23', sortOrder: 1024 * (i + 1) }),
  );
}

export interface PerfResult {
  scenario: string;
  rowsMounted: number;
  rowRenders: number;
  commits: number;
  actualMs: number;
  projectsObservers: number;
  workspacesObservers: number;
  netInfoSubscriptions: number;
  deleteMutationHooks: number;
  projectsRequests: number;
  styleSheetCreates: number;
}

async function measureScenario(scenario: string, ui: ReactElement, tasks: Task[], extraRoutes: object = {}): Promise<PerfResult> {
  let projectsRequests = 0;
  const queryClient = createTestQueryClient();
  const stats = { commits: 0, actualMs: 0 };
  const styleSpy = jest.spyOn(StyleSheet, 'create');
  const deleteSpy = jest.spyOn(taskActions, 'useDeleteTask');
  mockCounts.rowRenders = 0;
  await renderSignedIn(
    <Profiler id="screen" onRender={(_id, _phase, actual) => { stats.commits += 1; stats.actualMs += actual; }}>
      {ui}
    </Profiler>,
    {
      ...viewOptionsRoutes(['TODAY', 'project:p1'], []),
      'GET /api/v1/tasks': () => jsonResponse(200, page(tasks)),
      'GET /api/v1/projects': () => { projectsRequests += 1; return jsonResponse(200, [inboxProject, mine, team]); },
      'GET /api/v1/projects/p1': () => jsonResponse(200, mine),
      'GET /api/v1/projects/p1/sections': () => jsonResponse(200, []),
      'GET /api/v1/workspaces': () => jsonResponse(200, []),
      ...extraRoutes,
    },
    queryClient,
  );
  await screen.findByText('Việc 0');
  // let the list's windowing finish drawing what it is going to draw
  for (let i = 0; i < 8; i += 1) await act(() => new Promise((resolve) => setTimeout(resolve, 200)));
  const observers = (key: readonly unknown[]) => queryClient.getQueryCache().find({ queryKey: key })?.getObserversCount() ?? 0;
  const result: PerfResult = {
    scenario,
    rowsMounted: screen.queryAllByTestId(/^task-row-/).length,
    rowRenders: mockCounts.rowRenders,
    commits: stats.commits,
    actualMs: Math.round(stats.actualMs),
    projectsObservers: observers(queryKeys.projects.list(false)),
    workspacesObservers: observers(queryKeys.workspaces.list()),
    netInfoSubscriptions: (NetInfo.addEventListener as jest.Mock).mock.calls.length,
    deleteMutationHooks: deleteSpy.mock.calls.length,
    projectsRequests,
    styleSheetCreates: styleSpy.mock.calls.length,
  };
  console.log(`PERF ${JSON.stringify(result)}`);
  return result;
}

describe('perf: rows of long lists (every row drawn, as on a device once the list window has filled)', () => {
  jest.setTimeout(120000);
  beforeEach(() => { mockRenderAll = true; });
  afterAll(() => { mockRenderAll = false; });
  it('Today, 100 tasks', async () => {
    const r = await measureScenario('today-100', <TodayScreen />, manyTasks(100, (i) => PROJECTS[i % 3]));
    expectBudget(r, 100);
  });
  it('Project, 300 tasks', async () => {
    const r = await measureScenario('project-300', <ProjectScreen projectId="p1" />, manyTasks(300, () => 'p1'));
    expectBudget(r, 300);
  });
});

/** What a row may cost: nothing that grows with the number of rows except the row's own render. */
function expectBudget(r: PerfResult, rows: number) {
  expect(r.rowsMounted).toBe(rows);
  expect(r.deleteMutationHooks).toBe(0); // the delete dialog (and its mutation) only exists while a delete is asked
  expect(r.projectsObservers).toBeLessThanOrEqual(8); // projects list is read once per list, not once per row
  expect(r.workspacesObservers).toBeLessThanOrEqual(4);
  expect(r.netInfoSubscriptions).toBeLessThanOrEqual(15); // one connection listener per list, not per row
  expect(r.styleSheetCreates).toBeLessThanOrEqual(60); // styles are built once per palette, not per component
  expect(r.rowRenders).toBeLessThanOrEqual(rows * 2); // a row draws at most twice (first draw + project data arrives)
}
