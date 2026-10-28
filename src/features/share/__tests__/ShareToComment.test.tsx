import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import vi from '../../../i18n/locales/vi/shareTarget.json';
import { setTasklyAndroidForTests, type TasklyAndroidModule } from '../../../lib/native/tasklyAndroid';
import { recentDestinationsStorageKey } from '../../../lib/share/shareDestination';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse, problem } from '../../../test/http';
import { inboxProject, makeProject, makeTask, page } from '../../../test/m1Fixtures';
import { makeComment } from '../../../test/m8bFixtures';
import { testUser } from '../../../test/fixtures';
import { renderSignedIn } from '../../../test/screen';
import { ShareIntentHandler } from '../ShareIntentHandler';

let mockPath = '/';
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  usePathname: () => mockPath,
}));

const s = vi.shareTarget;
const TEXT = 'Đọc bài này\nhttps://news.example/a?x=1';
const EMPTY_OBJECTS = { projects: [], sections: [], labels: [], filters: [] };

type Listener = (event: { text: string }) => void;

function fakeModule(initial: string | null = null) {
  let listener: Listener | undefined;
  const module = {
    takeSharedText: jest.fn(() => initial),
    addListener: jest.fn((_event: string, callback: Listener) => {
      listener = callback;
      return { remove: jest.fn() };
    }),
  } as unknown as TasklyAndroidModule;
  return { module, share: (text: string) => act(() => listener?.({ text })) };
}

const project = makeProject({ id: 'p-home', name: 'Nhà' });
const task = makeTask({ id: 't-1', content: 'Viết báo cáo', projectId: 'p-home', projectName: 'Nhà' });

function routes(extra: ApiRoutes = {}): ApiRoutes {
  return {
    'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, project]),
    'GET /api/v1/projects/p-home': () => jsonResponse(200, project),
    'GET /api/v1/tasks/t-1': () => jsonResponse(200, task),
    'GET /api/v1/search': () => jsonResponse(200, page([task])),
    'GET /api/v1/search/objects': () => jsonResponse(200, EMPTY_OBJECTS),
    'POST /api/v1/tasks/t-1/comments': (request) =>
      jsonResponse(201, makeComment({ id: (request.body as { id: string }).id, content: (request.body as { content: string }).content })),
    'POST /api/v1/projects/p-home/comments': (request) =>
      jsonResponse(201, makeComment({ id: (request.body as { id: string }).id, taskId: null, projectId: 'p-home' })),
    ...extra,
  };
}

async function receive(extra: ApiRoutes = {}, path = '/') {
  mockPath = path;
  const fake = fakeModule(TEXT);
  const view = await renderSignedIn(<ShareIntentHandler module={fake.module} />, routes(extra));
  await screen.findByTestId('share-sheet');
  return { ...view, fake };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

afterEach(() => setTasklyAndroidForTests(undefined));

describe('shared text → Task or Comment', () => {
  it('asks what to do with the text instead of opening Quick Add straight away', async () => {
    await receive();

    expect(screen.getByText(s.title)).toBeOnTheScreen();
    expect(screen.getByTestId('share-preview')).toHaveTextContent(/Đọc/);
    expect(screen.getByTestId('share-choose-task')).toBeOnTheScreen();
    expect(screen.getByTestId('share-choose-comment')).toBeOnTheScreen();
    expect(router.push).not.toHaveBeenCalled();
  });

  it('"Create task" opens Quick Add with the name and description and closes the sheet', async () => {
    await receive();

    await fireEvent.press(screen.getByTestId('share-choose-task'));

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/quick-add',
      params: { content: 'Đọc bài này', description: 'https://news.example/a?x=1' },
    });
    expect(screen.queryByTestId('share-sheet')).toBeNull();
  });

  it('Cancel closes the sheet and sends nothing', async () => {
    const { fetchMock } = await receive();

    await fireEvent.press(screen.getByTestId('share-cancel'));

    expect(screen.queryByTestId('share-sheet')).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
  });

  it('a blank share shows nothing', async () => {
    const fake = fakeModule('  \n ');
    await renderSignedIn(<ShareIntentHandler module={fake.module} />, routes());

    expect(screen.queryByTestId('share-sheet')).toBeNull();
  });

  it('a share that arrives later (the app is open) shows the sheet too', async () => {
    const fake = fakeModule(null);
    await renderSignedIn(<ShareIntentHandler module={fake.module} />, routes());
    expect(screen.queryByTestId('share-sheet')).toBeNull();

    await fake.share('Link https://a.example');

    expect(await screen.findByTestId('share-sheet')).toBeOnTheScreen();
  });
});

describe('Comment on the task that is open', () => {
  it('goes straight to the comment box with the text in it and sends it to that task', async () => {
    const { fetchMock } = await receive({}, '/task/t-1');

    await fireEvent.press(screen.getByTestId('share-choose-comment'));

    expect(await screen.findByTestId('share-compose')).toBeOnTheScreen();
    expect(screen.queryByTestId('share-target-picker')).toBeNull();
    expect(screen.getByTestId('share-compose-target')).toHaveTextContent(/Viết báo cáo/);
    expect(screen.getByTestId('comment-input').props.value).toBe(TEXT);

    await fireEvent.press(screen.getByTestId('comment-send'));

    await waitFor(() => expect(screen.queryByTestId('share-sheet')).toBeNull());
    const [post] = requestsTo(fetchMock, 'POST', '/api/v1/tasks/t-1/comments');
    expect(post.body).toMatchObject({ content: TEXT });
    expect(post.headers['Idempotency-Key']).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
    expect(await screen.findByText(s.sent)).toBeOnTheScreen();
  });

  it('the text can be edited before sending, and the destination is remembered as recent', async () => {
    const { fetchMock } = await receive({}, '/task/t-1');
    await fireEvent.press(screen.getByTestId('share-choose-comment'));
    await screen.findByTestId('share-compose');

    await fireEvent.changeText(screen.getByTestId('comment-input'), 'Ghi chú ngắn');
    await fireEvent.press(screen.getByTestId('comment-send'));

    await waitFor(() => expect(screen.queryByTestId('share-sheet')).toBeNull());
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t-1/comments')[0].body).toMatchObject({ content: 'Ghi chú ngắn' });
    const stored = await AsyncStorage.getItem(recentDestinationsStorageKey(testUser.id));
    expect(JSON.parse(stored ?? '[]')).toEqual([{ kind: 'task', id: 't-1', name: 'Viết báo cáo' }]);
  });

  it('a completed task takes the comment, with a note', async () => {
    await receive(
      { 'GET /api/v1/tasks/t-1': () => jsonResponse(200, { ...task, completedAt: '2026-10-27T00:00:00Z' }) },
      '/task/t-1',
    );
    await fireEvent.press(screen.getByTestId('share-choose-comment'));

    expect(await screen.findByTestId('share-task-completed')).toHaveTextContent(new RegExp(s.taskCompleted.slice(0, 12)));
    expect(screen.getByTestId('comment-composer')).toBeOnTheScreen();
  });

  it('a task in an archived project cannot take a comment: notice, no comment box', async () => {
    await receive(
      { 'GET /api/v1/projects/p-home': () => jsonResponse(200, { ...project, archivedAt: '2026-10-20T00:00:00Z' }) },
      '/task/t-1',
    );
    await fireEvent.press(screen.getByTestId('share-choose-comment'));

    expect(await screen.findByTestId('share-archived')).toHaveTextContent(new RegExp(s.archived.slice(0, 12)));
    expect(screen.queryByTestId('comment-composer')).toBeNull();
  });

  it('"Choose another" leaves the open task for the picker', async () => {
    await receive({}, '/task/t-1');
    await fireEvent.press(screen.getByTestId('share-choose-comment'));
    await screen.findByTestId('share-compose');

    await fireEvent.press(screen.getByTestId('share-change'));

    expect(await screen.findByTestId('share-target-picker')).toBeOnTheScreen();
    expect(screen.queryByTestId('comment-composer')).toBeNull();
  });
});

describe('Comment on a project that is open', () => {
  it('sends the text to the project comments', async () => {
    const { fetchMock } = await receive({}, '/project/p-home');
    await fireEvent.press(screen.getByTestId('share-choose-comment'));

    expect(await screen.findByTestId('share-compose-target')).toHaveTextContent(/Nhà/);
    await fireEvent.press(screen.getByTestId('comment-send'));

    await waitFor(() => expect(screen.queryByTestId('share-sheet')).toBeNull());
    expect(requestsTo(fetchMock, 'POST', '/api/v1/projects/p-home/comments')).toHaveLength(1);
  });

  it('the project comments screen counts as the open project', async () => {
    await receive({}, '/project-comments/p-home');
    await fireEvent.press(screen.getByTestId('share-choose-comment'));

    expect(await screen.findByTestId('share-compose')).toBeOnTheScreen();
  });
});

describe('Comment when nothing is open: the picker', () => {
  it('lists the active projects (and the recent destinations) while the box is empty; a project goes to its comment box', async () => {
    await AsyncStorage.setItem(
      recentDestinationsStorageKey(testUser.id),
      JSON.stringify([{ kind: 'task', id: 't-1', name: 'Viết báo cáo' }]),
    );
    const { fetchMock } = await receive();
    await fireEvent.press(screen.getByTestId('share-choose-comment'));

    expect(await screen.findByText(s.pickTitle)).toBeOnTheScreen();
    expect(await screen.findByTestId('share-target-project-p-home')).toBeOnTheScreen();
    expect(await screen.findByTestId('share-target-task-t-1')).toBeOnTheScreen();
    expect(screen.getByText(s.recent)).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('share-target-project-p-home'));
    await screen.findByTestId('share-compose');
    await fireEvent.press(screen.getByTestId('comment-send'));

    await waitFor(() => expect(screen.queryByTestId('share-sheet')).toBeNull());
    expect(requestsTo(fetchMock, 'POST', '/api/v1/projects/p-home/comments')[0].body).toMatchObject({ content: TEXT });
  });

  it('finds a task by search (open tasks only) and comments on it', async () => {
    const { fetchMock } = await receive();
    await fireEvent.press(screen.getByTestId('share-choose-comment'));

    await fireEvent.changeText(await screen.findByTestId('share-target-input'), 'báo cáo');
    const row = await screen.findByTestId('share-target-task-t-1');
    expect(screen.getByText(/Nhà/)).toBeOnTheScreen();
    const searches = requestsTo(fetchMock, 'GET', '/api/v1/search');
    expect(searches).toHaveLength(1);
    expect(searches[0].query.get('q')).toBe('báo cáo');
    expect(searches[0].query.get('completed')).toBeNull();

    await fireEvent.press(row);
    await screen.findByTestId('share-compose');
    await fireEvent.press(screen.getByTestId('comment-send'));

    await waitFor(() => expect(screen.queryByTestId('share-sheet')).toBeNull());
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t-1/comments')[0].body).toMatchObject({ content: TEXT });
  });

  it('says so when nothing matches', async () => {
    await receive({ 'GET /api/v1/search': () => jsonResponse(200, page([])) });
    await fireEvent.press(screen.getByTestId('share-choose-comment'));

    await fireEvent.changeText(await screen.findByTestId('share-target-input'), 'không có');

    expect(await screen.findByTestId('share-target-empty')).toHaveTextContent(new RegExp(s.noResults.slice(0, 12)));
  });

  it('shows a search error with a retry', async () => {
    let fail = true;
    await receive({
      'GET /api/v1/search': () => (fail ? problem(500, 'boom') : jsonResponse(200, page([task]))),
    });
    await fireEvent.press(screen.getByTestId('share-choose-comment'));

    await fireEvent.changeText(await screen.findByTestId('share-target-input'), 'báo');
    expect(await screen.findByTestId('share-target-error')).toBeOnTheScreen();

    fail = false;
    await fireEvent.press(screen.getByTestId('share-target-retry'));
    expect(await screen.findByTestId('share-target-task-t-1')).toBeOnTheScreen();
  });

  it('a keyword over 100 characters is not searched', async () => {
    const { fetchMock } = await receive();
    await fireEvent.press(screen.getByTestId('share-choose-comment'));

    await fireEvent.changeText(await screen.findByTestId('share-target-input'), 'a'.repeat(101));

    expect(screen.getByTestId('share-target-too-long')).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'GET', '/api/v1/search')).toHaveLength(0);
  });
});

describe('when the comment cannot be added', () => {
  async function openComposer(extra: ApiRoutes) {
    const view = await receive(extra, '/task/t-1');
    await fireEvent.press(screen.getByTestId('share-choose-comment'));
    await screen.findByTestId('share-compose');
    return view;
  }

  it('403 on send: the reason is shown and the text stays in the box', async () => {
    await openComposer({ 'POST /api/v1/tasks/t-1/comments': () => problem(403, 'Forbidden') });

    await fireEvent.press(screen.getByTestId('comment-send'));

    expect(await screen.findByTestId('comment-error')).toBeOnTheScreen();
    expect(screen.getByTestId('share-sheet')).toBeOnTheScreen();
    expect(screen.getByTestId('comment-input').props.value).toBe(TEXT);
  });

  it('404 on send (the task was deleted meanwhile): the text stays so another destination can be chosen', async () => {
    await openComposer({ 'POST /api/v1/tasks/t-1/comments': () => problem(404, 'Not Found') });

    await fireEvent.press(screen.getByTestId('comment-send'));

    expect(await screen.findByTestId('comment-error')).toBeOnTheScreen();
    expect(screen.getByTestId('comment-input').props.value).toBe(TEXT);
    await fireEvent.press(screen.getByTestId('share-change'));
    expect(await screen.findByTestId('share-target-picker')).toBeOnTheScreen();
    expect(screen.getByTestId('share-preview')).toHaveTextContent(/Đọc/);
  });

  it('403 / 404 when opening the destination: the reason and "Choose another", no comment box', async () => {
    await receive({ 'GET /api/v1/tasks/t-1': () => problem(404, 'Not Found') }, '/task/t-1');
    await fireEvent.press(screen.getByTestId('share-choose-comment'));

    expect(await screen.findByTestId('share-compose-error')).toBeOnTheScreen();
    expect(screen.queryByTestId('comment-composer')).toBeNull();

    await fireEvent.press(screen.getByTestId('share-choose-another'));
    expect(await screen.findByTestId('share-target-picker')).toBeOnTheScreen();
  });

  it('a lost connection on send keeps the text, and the same attempt is retried with the same id', async () => {
    let calls = 0;
    const { fetchMock } = await openComposer({
      'POST /api/v1/tasks/t-1/comments': (request) => {
        calls += 1;
        if (calls === 1) throw new TypeError('Network request failed');
        return jsonResponse(201, makeComment({ id: (request.body as { id: string }).id }));
      },
    });

    await fireEvent.press(screen.getByTestId('comment-send'));
    expect(await screen.findByTestId('comment-error')).toBeOnTheScreen();
    expect(screen.getByTestId('comment-input').props.value).toBe(TEXT);

    await fireEvent.press(screen.getByTestId('comment-send'));
    await waitFor(() => expect(screen.queryByTestId('share-sheet')).toBeNull());
    const posts = requestsTo(fetchMock, 'POST', '/api/v1/tasks/t-1/comments');
    expect(posts).toHaveLength(2);
    expect((posts[1].body as { id: string }).id).toBe((posts[0].body as { id: string }).id);
  });

  it('a text over 15 000 characters is kept whole and cannot be sent until it is shortened', async () => {
    const long = 'x'.repeat(15_001);
    mockPath = '/task/t-1';
    const fake = fakeModule(long);
    await renderSignedIn(<ShareIntentHandler module={fake.module} />, routes());
    await screen.findByTestId('share-sheet');
    await fireEvent.press(screen.getByTestId('share-choose-comment'));
    await screen.findByTestId('share-compose');

    expect(screen.getByTestId('comment-input').props.value).toHaveLength(15_001);
    expect(screen.getByTestId('comment-too-long')).toBeOnTheScreen();
  });
});
