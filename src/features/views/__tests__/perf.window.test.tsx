import { act, fireEvent, screen } from '@testing-library/react-native';
import type { Project, Task } from '../../../api/models';
import { jsonResponse } from '../../../test/http';
import { inboxProject, makeProject, makeTask, page } from '../../../test/m1Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { viewOptionsRoutes } from '../../../test/viewOptionsServer';
import { ProjectScreen } from '../../projects/ProjectScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) } }));
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({ useUserTimeZone: () => 'Asia/Ho_Chi_Minh', deviceTimeZone: () => 'Asia/Ho_Chi_Minh' }));
const mockCounts = { rowRenders: 0, renderItemCalls: 0 };
jest.mock('../../tasks/Checkbox', () => {
  const actual = jest.requireActual('../../tasks/Checkbox');
  return { ...actual, Checkbox: (props: object) => { mockCounts.rowRenders += 1; return actual.Checkbox(props); } };
});
jest.mock('../../dnd/InsertLine', () => ({ InsertLine: () => { mockCounts.renderItemCalls += 1; return null; } }));

const mine = makeProject({ id: 'p1', name: 'Website' });
const tasks: Task[] = Array.from({ length: 299 }, (_, i) => makeTask({ id: `t${i}`, projectId: 'p1', content: `Viec ${i}`, sortOrder: 1024 * (i + 1) }));

it('window growth: a step of the list window draws only the new rows, and none of them mounts a swipe gesture', async () => {
  await renderSignedIn(<ProjectScreen projectId="p1" />, {
    ...viewOptionsRoutes(['project:p1'], []),
    'GET /api/v1/tasks': () => jsonResponse(200, page(tasks)),
    'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, mine] as Project[]),
    'GET /api/v1/projects/p1': () => jsonResponse(200, mine),
    'GET /api/v1/projects/p1/sections': () => jsonResponse(200, []),
    'GET /api/v1/workspaces': () => jsonResponse(200, []),
  });
  await screen.findByText('Viec 0');
  const list = screen.getByTestId('project-list');
  await fireEvent(list, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 700 } } });
  await fireEvent(list, 'contentSizeChange', 360, 40000);
  await act(() => new Promise((r) => setTimeout(r, 300)));
  const swipesBefore = screen.queryAllByTestId(/^task-swipe-/).length;
  const log: { step: number; mounted: number; rowRenders: number; renderItemCalls: number }[] = [];
  for (let step = 1; step <= 6; step += 1) {
    const rows0 = mockCounts.rowRenders; const items0 = mockCounts.renderItemCalls;
    await fireEvent.scroll(list, { nativeEvent: { contentOffset: { x: 0, y: step * 400 }, contentSize: { width: 360, height: 40000 }, layoutMeasurement: { width: 360, height: 700 } } });
    await act(() => new Promise((r) => setTimeout(r, 120)));
    log.push({ step, mounted: screen.queryAllByTestId(/^task-row-/).length, rowRenders: mockCounts.rowRenders - rows0, renderItemCalls: mockCounts.renderItemCalls - items0 });
  }
  console.log('WINDOW ' + JSON.stringify(log));
  for (const entry of log) expect(entry.rowRenders).toBeLessThanOrEqual(8); // LIST_BATCH_ROWS: never the rows already drawn
  // rows drawn after the layout is known wait for the viewability report before they mount their swipe
  expect(screen.queryAllByTestId(/^task-swipe-/).length).toBeLessThanOrEqual(swipesBefore);
});
