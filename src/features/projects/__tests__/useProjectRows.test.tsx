import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';
import viProjectScreen from '../../../i18n/locales/vi/projectScreen.json';
import vi from '../../../i18n/locales/vi.json';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse, problem } from '../../../test/http';
import { makeSection, makeTask, page } from '../../../test/m1Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { SelectionScope } from '../../tasks/SelectionScope';
import { TaskListView } from '../../tasks/TaskListView';
import { useProjectRows } from '../useProjectRows';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
// FlatList renders only 10 rows at first; this screen has more, and the tests need the trailing add / archived rows.
jest.mock('react-native/Libraries/Lists/FlatList', () => {
  const React = require('react');
  const Actual = jest.requireActual('react-native/Libraries/Lists/FlatList');
  const List = Actual.default ?? Actual;
  return { __esModule: true, default: React.forwardRef((props: object, ref: unknown) => <List ref={ref} initialNumToRender={100} {...props} />) };
});
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

const kitchen = makeSection({ id: 's1', projectId: 'p1', name: 'Bếp', description: 'Dọn bếp', sortOrder: 1024, activeTaskCount: 2 });
const living = makeSection({ id: 's2', projectId: 'p1', name: 'Phòng khách', sortOrder: 2048, activeTaskCount: 1 });
const old = makeSection({ id: 's9', projectId: 'p1', name: 'Việc cũ', archivedAt: '2026-10-01T00:00:00Z' });
const tasks = [
  makeTask({ id: 'a', projectId: 'p1', content: 'Đổ rác', sortOrder: 1024 }),
  makeTask({ id: 'b', projectId: 'p1', content: 'Tưới cây', sortOrder: 2048 }),
  makeTask({ id: 'c', projectId: 'p1', sectionId: 's1', content: 'Rửa bát' }),
  makeTask({ id: 'c1', projectId: 'p1', sectionId: 's1', parentId: 'c', content: 'Lau khô' }),
  makeTask({ id: 'x', projectId: 'p1', sectionId: 's1', content: 'Đã xong', completedAt: '2026-10-22T00:00:00Z' }),
  makeTask({ id: 'd', projectId: 'p1', sectionId: 's2', content: 'Hút bụi' }),
];

function Harness({ readOnly = false }: { readOnly?: boolean }) {
  const body = useProjectRows({ projectId: 'p1', readOnly });
  return (
    <SelectionScope>
      {/* Stand-ins for the project menu entries of Task 25. */}
      <Pressable testID="h-reorder-none" onPress={() => body.actions.reorderTasks(null)}>
        <Text>reorder tasks</Text>
      </Pressable>
      <Pressable testID="h-reorder-sections" onPress={body.actions.reorderSections}>
        <Text>reorder sections</Text>
      </Pressable>
      <TaskListView rows={body.rows} query={body.query} readOnly={readOnly} testID="project-list" />
      {body.dialogs}
    </SelectionScope>
  );
}

function routes(extra: ApiRoutes = {}): ApiRoutes {
  return {
    'GET /api/v1/tasks': () => jsonResponse(200, page(tasks)),
    'GET /api/v1/projects/p1/sections': () => jsonResponse(200, [kitchen, living, old]),
    ...extra,
  };
}

async function open(extra: ApiRoutes = {}, readOnly = false) {
  const rendered = await renderSignedIn(<Harness readOnly={readOnly} />, routes(extra));
  await screen.findByText('Hút bụi');
  return rendered;
}

describe('useProjectRows', () => {
  it('lists the tasks without a section first, then the sections with count and description; completed tasks stay hidden', async () => {
    const { fetchMock } = await open();

    const titles = screen.getAllByText(/^(Đổ rác|Tưới cây|Bếp|Rửa bát|Lau khô|Phòng khách|Hút bụi|Việc cũ)$/).map((node) => node.props.children);
    expect(titles).toEqual(['Đổ rác', 'Tưới cây', 'Bếp', 'Rửa bát', 'Lau khô', 'Phòng khách', 'Hút bụi', 'Việc cũ']);
    expect(screen.getByText('Dọn bếp')).toBeOnTheScreen();
    expect(screen.queryByText('Đã xong')).toBeNull();
    expect(requestsTo(fetchMock, 'GET', '/api/v1/tasks')[0].query.get('projectId')).toBe('p1');
  });

  it('a section collapses with its tasks and its add row, and opens again', async () => {
    await open();

    await fireEvent.press(screen.getByTestId('section-header-s-s1-toggle'));
    expect(screen.queryByText('Rửa bát')).toBeNull();
    expect(screen.queryByTestId('project-add-s1')).toBeNull();
    expect(screen.getByText('Hút bụi')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('section-header-s-s1-toggle'));
    expect(screen.getByText('Rửa bát')).toBeOnTheScreen();
  });

  it('"Thêm công việc" opens Quick Add for the project, with the section when it is under one', async () => {
    await open();

    await fireEvent.press(screen.getByTestId('project-add-none'));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/quick-add', params: { projectId: 'p1' } });
    await fireEvent.press(screen.getByTestId('project-add-s1'));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/quick-add', params: { projectId: 'p1', sectionId: 's1' } });
  });

  it('creates a section with a description and an Idempotency-Key', async () => {
    const { fetchMock } = await open({ 'POST /api/v1/projects/p1/sections': () => jsonResponse(201, makeSection({ id: 's3' })) });

    await fireEvent.press(screen.getByTestId('project-add-section'));
    await fireEvent.changeText(screen.getByTestId('section-form-name'), '  Ban công ');
    await fireEvent.changeText(screen.getByTestId('section-form-description'), 'Phơi đồ');
    await fireEvent.press(screen.getByTestId('section-form-submit'));

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/projects/p1/sections')).toHaveLength(1));
    const request = requestsTo(fetchMock, 'POST', '/api/v1/projects/p1/sections')[0];
    expect(request.body).toEqual({ name: 'Ban công', description: 'Phơi đồ' });
    expect(request.headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
    await waitFor(() => expect(screen.queryByTestId('section-form')).toBeNull());
  });

  it('the 21st section is refused with the Pro limit message and the form stays', async () => {
    await open({
      'POST /api/v1/projects/p1/sections': () => problem(422, 'Unprocessable', { code: 'limit-reached', limit: 'PROJECT_SECTIONS', max: 20 }),
    });
    await fireEvent.press(screen.getByTestId('project-add-section'));
    await fireEvent.changeText(screen.getByTestId('section-form-name'), 'Thứ 21');
    await fireEvent.press(screen.getByTestId('section-form-submit'));

    expect(await screen.findByText(vi.errors.limit.projectSections.replace('{{max}}', '20'))).toBeOnTheScreen();
    expect(screen.getByTestId('section-form-name').props.value).toBe('Thứ 21');
  });

  it('the 101st section counting archived ones is refused with its own message (PROJECT_SECTIONS_TOTAL)', async () => {
    await open({
      'POST /api/v1/projects/p1/sections': () =>
        problem(422, 'Unprocessable', { code: 'limit-reached', limit: 'PROJECT_SECTIONS_TOTAL', max: 100 }),
    });
    await fireEvent.press(screen.getByTestId('project-add-section'));
    await fireEvent.changeText(screen.getByTestId('section-form-name'), 'Thứ 101');
    await fireEvent.press(screen.getByTestId('section-form-submit'));

    expect(await screen.findByText(vi.errors.limit.projectSectionsTotal.replace('{{max}}', '100'))).toBeOnTheScreen();
    expect(screen.getByTestId('section-form-name').props.value).toBe('Thứ 101');
  });

  it('edits a section from its ⋯ menu (name and description)', async () => {
    const { fetchMock } = await open({ 'PATCH /api/v1/projects/p1/sections/s1': () => jsonResponse(200, kitchen) });

    await fireEvent.press(screen.getByTestId('section-menu-open-s1'));
    await fireEvent.press(screen.getByTestId('section-menu-edit'));
    expect(screen.getByTestId('section-form-name').props.value).toBe('Bếp');
    await fireEvent.changeText(screen.getByTestId('section-form-name'), 'Nhà bếp');
    await fireEvent.press(screen.getByTestId('section-form-submit'));

    await waitFor(() =>
      expect(requestsTo(fetchMock, 'PATCH', '/api/v1/projects/p1/sections/s1')[0].body).toEqual({ name: 'Nhà bếp', description: 'Dọn bếp' }),
    );
  });

  it('archiving a section asks first (its open tasks become completed); Cancel sends nothing', async () => {
    const { fetchMock } = await open({ 'POST /api/v1/projects/p1/sections/s1/archive': () => jsonResponse(200, kitchen) });

    await fireEvent.press(screen.getByTestId('section-menu-open-s1'));
    await fireEvent.press(screen.getByTestId('section-menu-archive'));
    expect(screen.getByText(viProjectScreen.projectScreen.section.archiveMessage.replace('{{n}}', '2'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('section-archive-dialog-cancel'));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/projects/p1/sections/s1/archive')).toHaveLength(0);

    await fireEvent.press(screen.getByTestId('section-menu-open-s1'));
    await fireEvent.press(screen.getByTestId('section-menu-archive'));
    await fireEvent.press(screen.getByTestId('section-archive-dialog-confirm'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/projects/p1/sections/s1/archive')).toHaveLength(1));
  });

  it('deleting a section asks first and says its tasks go too; Confirm deletes for good', async () => {
    const { fetchMock } = await open({ 'DELETE /api/v1/projects/p1/sections/s2': () => jsonResponse(204) });

    await fireEvent.press(screen.getByTestId('section-menu-open-s2'));
    await fireEvent.press(screen.getByTestId('section-menu-delete'));
    expect(
      screen.getByText(viProjectScreen.projectScreen.section.deleteMessage.replace('{{name}}', 'Phòng khách').replace('{{n}}', '1')),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('section-delete-dialog-cancel'));
    expect(requestsTo(fetchMock, 'DELETE', '/api/v1/projects/p1/sections/s2')).toHaveLength(0);

    await fireEvent.press(screen.getByTestId('section-menu-open-s2'));
    await fireEvent.press(screen.getByTestId('section-menu-delete'));
    await fireEvent.press(screen.getByTestId('section-delete-dialog-confirm'));
    await waitFor(() => expect(requestsTo(fetchMock, 'DELETE', '/api/v1/projects/p1/sections/s2')).toHaveLength(1));
  });

  it('an archived section is grey at the end and offers Restore and Delete', async () => {
    const { fetchMock } = await open({
      'POST /api/v1/projects/p1/sections/s9/unarchive': () => jsonResponse(200, { ...old, archivedAt: null }),
      'DELETE /api/v1/projects/p1/sections/s9': () => jsonResponse(204),
    });

    await fireEvent.press(screen.getByTestId('section-restore-s9'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/projects/p1/sections/s9/unarchive')).toHaveLength(1));

    await fireEvent.press(screen.getByTestId('section-delete-s9'));
    await fireEvent.press(screen.getByTestId('section-delete-dialog-confirm'));
    await waitFor(() => expect(requestsTo(fetchMock, 'DELETE', '/api/v1/projects/p1/sections/s9')).toHaveLength(1));
  });

  it('writing to an archived section is explained (409 section-archived)', async () => {
    await open({ 'PATCH /api/v1/projects/p1/sections/s1': () => problem(409, 'Conflict', { code: 'section-archived' }) });

    await fireEvent.press(screen.getByTestId('section-menu-open-s1'));
    await fireEvent.press(screen.getByTestId('section-menu-edit'));
    await fireEvent.press(screen.getByTestId('section-form-submit'));

    expect(await screen.findByText(vi.errors.sectionArchived)).toBeOnTheScreen();
  });

  it('reorders the root tasks without a section and the sections with afterId; a section with one root task cannot be sorted', async () => {
    const { fetchMock } = await open({ 'POST /api/v1/reorder': () => jsonResponse(200, { type: 'TASK', id: 'b', sortOrder: 512 }) });

    await fireEvent.press(screen.getByTestId('h-reorder-none'));
    await fireEvent.press(screen.getByTestId('project-reorder-tasks-up-b'));
    await waitFor(() =>
      expect(requestsTo(fetchMock, 'POST', '/api/v1/reorder')[0].body).toEqual({ type: 'TASK', id: 'b', afterId: null }),
    );
    await fireEvent.press(screen.getByTestId('project-reorder-tasks-done'));

    await fireEvent.press(screen.getByTestId('h-reorder-sections'));
    await fireEvent.press(screen.getByTestId('project-reorder-sections-up-s2'));
    await waitFor(() =>
      expect(requestsTo(fetchMock, 'POST', '/api/v1/reorder')[1].body).toEqual({ type: 'SECTION', id: 's2', afterId: null }),
    );
    await fireEvent.press(screen.getByTestId('project-reorder-sections-done'));

    // "Bếp" has a single root task ("Rửa bát"; "Lau khô" is its subtask): its sort entry is disabled.
    await fireEvent.press(screen.getByTestId('section-menu-open-s1'));
    expect(screen.getByTestId('section-menu-reorder-tasks')).toBeDisabled();
  });

  it('read-only (archived project): no add rows, no section menu, no "Thêm section", no Restore / Delete of archived sections', async () => {
    await open({}, true);
    expect(screen.queryByTestId('project-add-none')).toBeNull();
    expect(screen.queryByTestId('section-menu-open-s1')).toBeNull();
    expect(screen.queryByTestId('project-add-section')).toBeNull();
    // Any write into an archived project answers 409 project-archived, so the archived section offers none.
    expect(screen.getByText('Việc cũ')).toBeOnTheScreen();
    expect(screen.queryByTestId('section-restore-s9')).toBeNull();
    expect(screen.queryByTestId('section-delete-s9')).toBeNull();
  });
});
