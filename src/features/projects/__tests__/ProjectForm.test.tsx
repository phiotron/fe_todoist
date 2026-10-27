import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import viProjects from '../../../i18n/locales/vi/projects.json';
import vi from '../../../i18n/locales/vi.json';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse, problem } from '../../../test/http';
import { inboxProject, makeProject } from '../../../test/m1Fixtures';
import { goOffline, goOnline } from '../../../test/network';
import { renderSignedIn } from '../../../test/screen';
import { ProjectFormScreen } from '../ProjectFormScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));

const work = makeProject({ id: 'p1', name: 'Công ty', color: 'blue', description: 'Việc công ty', isFavorite: false });
const plan = makeProject({ id: 'p1a', name: 'Kế hoạch', parentId: 'p1' });
const q4 = makeProject({ id: 'p1a1', name: 'Q4', parentId: 'p1a' });
const home = makeProject({ id: 'p2', name: 'Nhà' });

function routes(extra: ApiRoutes = {}): ApiRoutes {
  return {
    'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, work, plan, q4, home]),
    'GET /api/v1/projects/p1': () => jsonResponse(200, work),
    ...extra,
  };
}

describe('ProjectFormScreen', () => {
  afterEach(() => goOnline());

  it('creates a project with name, description, colour and parent, sending an Idempotency-Key, then closes', async () => {
    const { fetchMock } = await renderSignedIn(
      <ProjectFormScreen />,
      routes({ 'POST /api/v1/projects': () => jsonResponse(201, makeProject({ id: 'p9', name: 'Học' })) }),
    );

    await fireEvent.changeText(screen.getByTestId('project-form-name'), '  Học ');
    await fireEvent.changeText(screen.getByTestId('project-form-description'), 'Khoá tiếng Anh');
    await fireEvent.press(screen.getByTestId('project-color-green'));
    await fireEvent.press(screen.getByTestId('project-form-parent'));
    await fireEvent.press(await screen.findByTestId('project-form-parent-option-p2'));
    await fireEvent.press(screen.getByTestId('project-form-submit'));

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/projects')).toHaveLength(1));
    const request = requestsTo(fetchMock, 'POST', '/api/v1/projects')[0];
    expect(request.body).toEqual({ name: 'Học', color: 'green', description: 'Khoá tiếng Anh', parentId: 'p2' });
    expect(request.headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
    await waitFor(() => expect(router.back).toHaveBeenCalled());
  });

  it('defaults to charcoal, shows the counter, validates the name and keeps it after a server error', async () => {
    const { fetchMock } = await renderSignedIn(
      <ProjectFormScreen />,
      routes({ 'POST /api/v1/projects': () => problem(500, 'Error', { requestId: 'abcdef12-0000' }) }),
    );
    expect(screen.getByTestId('project-color-charcoal')).toBeSelected();
    expect(screen.getByTestId('project-form-name-counter')).toHaveTextContent('0/120');

    await fireEvent.press(screen.getByTestId('project-form-submit'));
    expect(screen.getByText(viProjects.projects.form.nameRequired)).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'POST', '/api/v1/projects')).toHaveLength(0);

    await fireEvent.changeText(screen.getByTestId('project-form-name'), 'Học');
    await fireEvent.press(screen.getByTestId('project-form-submit'));

    expect(await screen.findByText(/abcdef12/)).toBeOnTheScreen();
    expect(screen.getByTestId('project-form-name').props.value).toBe('Học');
    expect(requestsTo(fetchMock, 'POST', '/api/v1/projects')[0].body).toEqual({ name: 'Học', color: 'charcoal' });
    expect(router.back).not.toHaveBeenCalled();
  });

  it('explains the project limit (spec 2.1) and keeps the form', async () => {
    await renderSignedIn(
      <ProjectFormScreen />,
      routes({ 'POST /api/v1/projects': () => problem(422, 'Unprocessable', { code: 'limit-reached', limit: 'ACTIVE_PROJECTS', max: 300 }) }),
    );
    await fireEvent.changeText(screen.getByTestId('project-form-name'), 'Thứ 301');
    await fireEvent.press(screen.getByTestId('project-form-submit'));

    expect(await screen.findByText(vi.errors.limit.activeProjects.replace('{{max}}', '300'))).toBeOnTheScreen();
  });

  it('a parent archived meanwhile → 422 target-archived (the TARGET is archived), the form stays', async () => {
    await renderSignedIn(
      <ProjectFormScreen parentId="p2" />,
      routes({ 'POST /api/v1/projects': () => problem(422, 'Unprocessable', { code: 'target-archived' }) }),
    );
    await fireEvent.changeText(screen.getByTestId('project-form-name'), 'Học');
    await fireEvent.press(screen.getByTestId('project-form-submit'));

    expect(await screen.findByText(vi.errors.targetArchived)).toBeOnTheScreen();
    expect(screen.getByTestId('project-form-name').props.value).toBe('Học');
    expect(router.back).not.toHaveBeenCalled();
  });

  it('favorite switch: the project is created, then added to the favorites', async () => {
    const { fetchMock } = await renderSignedIn(
      <ProjectFormScreen />,
      routes({
        'POST /api/v1/projects': () => jsonResponse(201, makeProject({ id: 'p9', name: 'Học' })),
        'PUT /api/v1/projects/p9/favorite': () => jsonResponse(200, makeProject({ id: 'p9', isFavorite: true })),
      }),
    );
    await fireEvent.changeText(screen.getByTestId('project-form-name'), 'Học');
    await fireEvent.press(screen.getByTestId('project-form-favorite'));
    await fireEvent.press(screen.getByTestId('project-form-submit'));

    await waitFor(() => expect(requestsTo(fetchMock, 'PUT', '/api/v1/projects/p9/favorite')).toHaveLength(1));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
  });

  it('offers only parents that keep the tree within 3 levels, never the project itself or its subtree', async () => {
    await renderSignedIn(<ProjectFormScreen projectId="p1a" />, routes({ 'GET /api/v1/projects/p1a': () => jsonResponse(200, plan) }));
    await screen.findByDisplayValue('Kế hoạch');

    await fireEvent.press(screen.getByTestId('project-form-parent'));

    // p1a has one child (height 2): it can sit under a root only; not under itself or Q4.
    expect(await screen.findByTestId('project-form-parent-option-p1')).toBeOnTheScreen();
    expect(screen.getByTestId('project-form-parent-option-p2')).toBeOnTheScreen();
    expect(screen.queryByTestId('project-form-parent-option-p1a')).toBeNull();
    expect(screen.queryByTestId('project-form-parent-option-p1a1')).toBeNull();
    expect(screen.getByTestId('project-form-parent-option-none')).toBeOnTheScreen();
  });

  it('edits: loads the project, sends PATCH, moves under another parent and drops the favorite', async () => {
    const cottage = makeProject({ id: 'p2', name: 'Nhà', color: 'teal', description: 'Việc nhà', isFavorite: true });
    const { fetchMock } = await renderSignedIn(
      <ProjectFormScreen projectId="p2" />,
      routes({
        'GET /api/v1/projects/p2': () => jsonResponse(200, cottage),
        'PATCH /api/v1/projects/p2': () => jsonResponse(200, cottage),
        'POST /api/v1/projects/p2/move': () => jsonResponse(200, cottage),
        'DELETE /api/v1/projects/p2/favorite': () => jsonResponse(200, { ...cottage, isFavorite: false }),
      }),
    );
    await screen.findByDisplayValue('Nhà');
    expect(screen.getByTestId('project-color-teal')).toBeSelected();
    expect(screen.getByDisplayValue('Việc nhà')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByTestId('project-form-name'), 'Nhà mới');
    await fireEvent.press(screen.getByTestId('project-form-parent'));
    await fireEvent.press(await screen.findByTestId('project-form-parent-option-p1'));
    await fireEvent.press(screen.getByTestId('project-form-favorite'));
    await fireEvent.press(screen.getByTestId('project-form-submit'));

    await waitFor(() => expect(requestsTo(fetchMock, 'DELETE', '/api/v1/projects/p2/favorite')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'PATCH', '/api/v1/projects/p2')[0].body).toEqual({
      name: 'Nhà mới',
      color: 'teal',
      description: 'Việc nhà',
    });
    expect(requestsTo(fetchMock, 'POST', '/api/v1/projects/p2/move')[0].body).toEqual({ parentId: 'p1' });
    await waitFor(() => expect(router.back).toHaveBeenCalled());
  });

  it('the close button leaves without a request; offline the submit button is disabled', async () => {
    const { fetchMock } = await renderSignedIn(<ProjectFormScreen />, routes());
    await fireEvent.press(screen.getByTestId('project-form-close'));
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(requestsTo(fetchMock, 'POST', '/api/v1/projects')).toHaveLength(0);
  });

  it('cannot submit while offline', async () => {
    goOffline();
    await renderSignedIn(<ProjectFormScreen />, routes());
    await fireEvent.changeText(screen.getByTestId('project-form-name'), 'Học');
    expect(screen.getByTestId('project-form-submit')).toBeDisabled();
  });
});
