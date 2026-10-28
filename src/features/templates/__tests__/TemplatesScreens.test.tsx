import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse, problem } from '../../../test/http';
import { makeProject } from '../../../test/m1Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { BackupsScreen } from '../BackupsScreen';
import { TemplatePreviewScreen } from '../TemplatePreviewScreen';
import { TemplatesScreen } from '../TemplatesScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

const mine = {
  id: 't1',
  name: 'Ra mắt sản phẩm',
  description: '',
  color: 'violet',
  sectionCount: 1,
  taskCount: 3,
  createdAt: '2026-10-20T03:00:00Z',
  updatedAt: '2026-10-20T03:00:00Z',
};
const libraryItems = [
  { key: 'weekly-planning', category: 'FEATURED', name: 'Lên kế hoạch tuần', description: 'd', color: 'teal', sectionCount: 3, taskCount: 9 },
  { key: 'eisenhower-matrix', category: 'PRODUCTIVITY_METHODS', name: 'Ma trận Eisenhower', description: 'd', color: 'blue', sectionCount: 4, taskCount: 4 },
  { key: 'study-plan', category: 'POPULAR', name: 'Kế hoạch học tập', description: 'd', color: 'green', sectionCount: 3, taskCount: 6 },
];
const detail = {
  id: 't1',
  source: 'MINE',
  category: null,
  name: 'Ra mắt sản phẩm',
  description: 'Mô tả mẫu',
  color: 'violet',
  sectionCount: 1,
  taskCount: 3,
  tasks: [{ content: 'Viết thông cáo', description: '', priority: 1, children: [{ content: 'Duyệt bản nháp', description: '', priority: 4, children: [] }] }],
  sections: [{ name: 'Tuần 1', description: '', tasks: [{ content: 'Họp khởi động', description: '', priority: 4, children: [] }] }],
};

function routes(extra: ApiRoutes = {}): ApiRoutes {
  return {
    'GET /api/v1/templates': () => jsonResponse(200, [mine]),
    'GET /api/v1/templates/library': () => jsonResponse(200, libraryItems),
    ...extra,
  };
}

describe('TemplatesScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists my templates first, then the three library groups; a row opens the preview', async () => {
    await renderSignedIn(<TemplatesScreen />, routes());
    await screen.findByText('Ra mắt sản phẩm');

    expect(screen.getByText('Template của tôi')).toBeOnTheScreen();
    expect(screen.getByText('Nổi bật')).toBeOnTheScreen();
    expect(screen.getByText('Phương pháp làm việc')).toBeOnTheScreen();
    expect(screen.getByText('Phổ biến')).toBeOnTheScreen();
    expect(screen.getByText('Lên kế hoạch tuần')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('template-row-t1'));
    expect(router.push).toHaveBeenLastCalledWith('/templates/t1');
    await fireEvent.press(screen.getByTestId('template-row-library-study-plan'));
    expect(router.push).toHaveBeenLastCalledWith('/templates/library:study-plan');
  });

  it('shows the empty message when I have no template yet, the library stays', async () => {
    await renderSignedIn(<TemplatesScreen />, routes({ 'GET /api/v1/templates': () => jsonResponse(200, []) }));
    await screen.findByTestId('templates-mine-empty');
    expect(screen.getByText('Lên kế hoạch tuần')).toBeOnTheScreen();
  });
});

describe('TemplatePreviewScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows sections and nested tasks; "Dùng template" creates a project with the typed name and opens it', async () => {
    const created = makeProject({ id: 'pn', name: 'Ra mắt 2' });
    const { fetchMock } = await renderSignedIn(
      <TemplatePreviewScreen param="t1" />,
      routes({
        'GET /api/v1/templates/t1': () => jsonResponse(200, detail),
        'POST /api/v1/templates/t1/apply': () => jsonResponse(201, created),
      }),
    );
    await screen.findByText('Viết thông cáo');
    expect(screen.getByText('Duyệt bản nháp')).toBeOnTheScreen();
    expect(screen.getByText('Tuần 1')).toBeOnTheScreen();
    expect(screen.getByText('Họp khởi động')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('template-use'));
    await fireEvent.changeText(screen.getByTestId('template-use-dialog-name'), ' Ra mắt 2 ');
    await fireEvent.press(screen.getByTestId('template-use-dialog-submit'));

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/templates/t1/apply')).toHaveLength(1));
    const request = requestsTo(fetchMock, 'POST', '/api/v1/templates/t1/apply')[0];
    expect(request.body).toEqual({ name: 'Ra mắt 2' });
    expect(request.headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/project/pn'));
  });

  it('a library template has no delete button and applies through the library route', async () => {
    const { fetchMock } = await renderSignedIn(
      <TemplatePreviewScreen param="library:weekly-planning" />,
      routes({
        'GET /api/v1/templates/library/weekly-planning': () => jsonResponse(200, { ...detail, id: 'weekly-planning', source: 'LIBRARY', category: 'FEATURED' }),
        'POST /api/v1/templates/library/weekly-planning/apply': () => jsonResponse(201, makeProject({ id: 'pl' })),
      }),
    );
    await screen.findByText('Viết thông cáo');
    expect(screen.queryByTestId('template-delete-open')).toBeNull();

    await fireEvent.press(screen.getByTestId('template-use'));
    await fireEvent.press(screen.getByTestId('template-use-dialog-submit'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/templates/library/weekly-planning/apply')).toHaveLength(1));
  });

  it('the project name is required and at most 120 characters (no request is sent)', async () => {
    const { fetchMock } = await renderSignedIn(
      <TemplatePreviewScreen param="t1" />,
      routes({ 'GET /api/v1/templates/t1': () => jsonResponse(200, detail) }),
    );
    await screen.findByText('Viết thông cáo');
    await fireEvent.press(screen.getByTestId('template-use'));

    await fireEvent.changeText(screen.getByTestId('template-use-dialog-name'), '   ');
    await fireEvent.press(screen.getByTestId('template-use-dialog-submit'));
    expect(screen.getByText('Vui lòng nhập tên dự án')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('template-use-dialog-name'), 'x'.repeat(121));
    await fireEvent.press(screen.getByTestId('template-use-dialog-submit'));
    expect(screen.getByText('Tên dự án tối đa 120 ký tự')).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'POST', '/api/v1/templates/t1/apply')).toHaveLength(0);
  });

  it('deleting my template asks first, then calls DELETE and goes back', async () => {
    const { fetchMock } = await renderSignedIn(
      <TemplatePreviewScreen param="t1" />,
      routes({
        'GET /api/v1/templates/t1': () => jsonResponse(200, detail),
        'DELETE /api/v1/templates/t1': () => jsonResponse(204),
      }),
    );
    await screen.findByText('Viết thông cáo');

    await fireEvent.press(screen.getByTestId('template-delete-open'));
    expect(requestsTo(fetchMock, 'DELETE', '/api/v1/templates/t1')).toHaveLength(0);
    await fireEvent.press(screen.getByTestId('template-delete-dialog-confirm'));

    await waitFor(() => expect(requestsTo(fetchMock, 'DELETE', '/api/v1/templates/t1')).toHaveLength(1));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
  });

  it('a template that is gone shows the not-found view', async () => {
    await renderSignedIn(
      <TemplatePreviewScreen param="zzz" />,
      routes({ 'GET /api/v1/templates/zzz': () => problem(404, 'Not Found') }),
    );
    await screen.findByTestId('template-not-found');
  });
});

describe('BackupsScreen', () => {
  it('lists the backups newest first with the local date and counts; no restore or download button', async () => {
    await renderSignedIn(
      <BackupsScreen />,
      {
        'GET /api/v1/backups': () =>
          jsonResponse(200, [
            { id: 'b2', createdAt: '2026-10-23T17:05:00Z', projectCount: 3, taskCount: 12, sizeBytes: 900 },
            { id: 'b1', createdAt: '2026-10-22T17:05:00Z', projectCount: 2, taskCount: 8, sizeBytes: 700 },
          ]),
      },
    );
    await screen.findByTestId('backup-row-b2');

    expect(screen.getByText('3 dự án · 12 công việc')).toBeOnTheScreen();
    expect(screen.getByText('2 dự án · 8 công việc')).toBeOnTheScreen();
    // 17:05Z = 00:05 ngày hôm sau theo giờ Việt Nam
    expect(screen.getAllByText(/00:05/)).toHaveLength(2);
    expect(screen.getByText(/24\/10/)).toBeOnTheScreen();
    expect(screen.getByText(/23\/10/)).toBeOnTheScreen();
    expect(screen.queryByText(/Khôi phục|Tải/)).toBeNull();
  });

  it('says so when there is no backup yet', async () => {
    await renderSignedIn(<BackupsScreen />, { 'GET /api/v1/backups': () => jsonResponse(200, []) });
    await screen.findByTestId('backups-empty');
  });
});
