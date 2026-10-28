import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse, problem } from '../../../test/http';
import { inboxProject, makeProject, makeTask, page } from '../../../test/m1Fixtures';
import { makeComment } from '../../../test/m8bFixtures';
import { renderSignedIn } from '../../../test/screen';
import { viewOptionsRoutes } from '../../../test/viewOptionsServer';
import { ProjectScreen } from '../../projects/ProjectScreen';
import { SearchScreen } from '../../search/SearchScreen';
import { SettingsScreen } from '../../settings/SettingsScreen';
import { TaskMeta } from '../../tasks/TaskMeta';
import { ProjectCommentsScreen } from '../ProjectCommentsScreen';

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) },
    useFocusEffect: (effect: () => void | (() => void)) => {
      useEffect(effect, [effect]);
    },
  };
});

describe('comment count on a task row', () => {
  const props = { now: new Date('2026-10-28T03:00:00Z'), timeZone: 'Asia/Ho_Chi_Minh', showProject: false };

  it('shows the number of comments next to the other details', async () => {
    await render(<TaskMeta task={makeTask({ id: 't1', commentCount: 3 })} {...props} />);

    expect(screen.getByTestId('task-comments-t1')).toHaveTextContent(/3/);
    expect(screen.getByLabelText('3 bình luận')).toBeOnTheScreen();
  });

  it('shows nothing for a task without comments (or from an older server)', async () => {
    await render(<TaskMeta task={makeTask({ id: 't1', commentCount: 0 })} {...props} />);
    expect(screen.queryByTestId('task-comments-t1')).toBeNull();

    await render(<TaskMeta task={makeTask({ id: 't2' })} {...props} />);
    expect(screen.queryByTestId('task-comments-t2')).toBeNull();
  });
});

describe('ProjectCommentsScreen', () => {
  const PATH = '/api/v1/projects/p1/comments';
  const base = (archived: boolean): ApiRoutes => ({
    'GET /api/v1/projects/p1': () => jsonResponse(200, makeProject({ id: 'p1', name: 'Nhà', archivedAt: archived ? '2026-10-20T00:00:00Z' : null })),
    [`GET ${PATH}`]: () => jsonResponse(200, [makeComment({ id: 'c-p', taskId: null, projectId: 'p1', content: 'Họp dự án' })]),
    [`GET ${PATH}/mentionable`]: () => jsonResponse(200, []),
  });

  it('lists the project comments with the composer under them', async () => {
    await renderSignedIn(<ProjectCommentsScreen projectId="p1" />, base(false));

    expect(await screen.findByText('Họp dự án')).toBeOnTheScreen();
    expect(screen.getByTestId('comment-composer')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('project-comments-header-back'));
    expect(router.back).toHaveBeenCalled();
  });

  it('posts to the project comments endpoint', async () => {
    const { fetchMock } = await renderSignedIn(<ProjectCommentsScreen projectId="p1" />, {
      ...base(false),
      [`POST ${PATH}`]: (request) => jsonResponse(201, makeComment({ id: (request.body as { id: string }).id, taskId: null, projectId: 'p1' })),
    });
    await screen.findByText('Họp dự án');

    await fireEvent.changeText(screen.getByTestId('comment-input'), 'Ghi chú dự án');
    await fireEvent.press(screen.getByTestId('comment-send'));

    expect(await screen.findByTestId('comment-composer')).toBeOnTheScreen();
    await screen.findByText('Họp dự án');
    expect(requestsTo(fetchMock, 'POST', PATH)).toHaveLength(1);
  });

  it('is read-only in an archived project: comments readable, no composer', async () => {
    await renderSignedIn(<ProjectCommentsScreen projectId="p1" />, base(true));

    expect(await screen.findByText('Họp dự án')).toBeOnTheScreen();
    await screen.findByTestId('comment-thread');
    expect(screen.queryByTestId('comment-composer')).toBeNull();
  });

  it('says the project is gone when it cannot be found', async () => {
    await renderSignedIn(<ProjectCommentsScreen projectId="p1" />, {
      'GET /api/v1/projects/p1': () => problem(404, 'Not Found'),
      [`GET ${PATH}`]: () => problem(404, 'Not Found'),
    });

    expect(await screen.findByTestId('project-comments-not-found')).toBeOnTheScreen();
  });
});

describe('entry points', () => {
  it('the project menu has a Comment entry that opens the project comments', async () => {
    const project = makeProject({ id: 'p1', name: 'Nhà' });
    await renderSignedIn(<ProjectScreen projectId="p1" />, {
      'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, project]),
      'GET /api/v1/projects/p1': () => jsonResponse(200, project),
      'GET /api/v1/projects/p1/sections': () => jsonResponse(200, []),
      'GET /api/v1/tasks': () => jsonResponse(200, page([makeTask({ id: 'a', projectId: 'p1', content: 'Tưới cây' })])),
      ...viewOptionsRoutes(['project:p1']),
    });
    await screen.findByText('Tưới cây');

    await fireEvent.press(screen.getByTestId('project-menu-open'));
    await fireEvent.press(screen.getByTestId('project-menu-comments'));

    expect(router.push).toHaveBeenLastCalledWith('/project-comments/p1');
  });

  it('Settings has a Notifications row', async () => {
    await renderSignedIn(<SettingsScreen />, {});

    await fireEvent.press(await screen.findByTestId('settings-row-notification-events'));

    expect(router.push).toHaveBeenLastCalledWith('/settings/notification-events');
  });

  it('Search lists matching comments and opens the task, or the project comments', async () => {
    const routes: ApiRoutes = {
      'GET /api/v1/search': () => jsonResponse(200, page([])),
      'GET /api/v1/search/objects': () =>
        jsonResponse(200, {
          projects: [],
          sections: [],
          labels: [],
          filters: [],
          comments: [
            { id: 'c-1', taskId: 't-9', projectId: 'p-1', projectName: 'Nhà', taskContent: 'Sơn tường', content: 'Chọn màu xanh' },
            { id: 'c-2', taskId: null, projectId: 'p-2', projectName: 'Vườn', taskContent: null, content: 'Màu hoa' },
          ],
        }),
    };
    await renderSignedIn(<SearchScreen />, routes);

    await fireEvent.changeText(screen.getByTestId('search-input'), 'màu');
    await fireEvent.press(await screen.findByTestId('search-comment-c-1', undefined, { timeout: 3000 }));
    expect(router.push).toHaveBeenLastCalledWith('/task/t-9');
    await fireEvent.press(screen.getByTestId('search-comment-c-2'));
    expect(router.push).toHaveBeenLastCalledWith('/project-comments/p-2');
  });
});
