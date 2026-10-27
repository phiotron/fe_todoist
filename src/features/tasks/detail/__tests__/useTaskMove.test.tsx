import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import vi from '../../../../i18n/locales/vi.json';
import { requestsTo } from '../../../../test/apiRoutes';
import { jsonResponse, problem } from '../../../../test/http';
import { inboxProject, makeProject, makeSection, makeTask } from '../../../../test/m1Fixtures';
import { renderSignedIn } from '../../../../test/screen';
import { useTaskMove } from '../useTaskMove';

const task = makeTask({ id: 't1', projectId: 'p1', sectionId: 's1' });

function Harness() {
  const move = useTaskMove(task);
  return (
    <>
      <Pressable testID="start" onPress={move.start}>
        <Text>start</Text>
      </Pressable>
      {move.picker}
      <Text testID="move-error">{move.errorMessage ?? ''}</Text>
    </>
  );
}

const routes = (move: () => Response) => ({
  'GET /api/v1/projects': () => jsonResponse(200, [inboxProject, makeProject({ id: 'p1', name: 'Công ty' }), makeProject({ id: 'p2', name: 'Nhà' })]),
  'GET /api/v1/projects/p2/sections': () => jsonResponse(200, [makeSection({ id: 's7', projectId: 'p2', name: 'Bếp' })]),
  'GET /api/v1/projects/p-inbox/sections': () => jsonResponse(200, []),
  'POST /api/v1/tasks/t1/move': move,
});

describe('useTaskMove', () => {
  it('moves to another project and section; the subtree goes along (one request)', async () => {
    const { fetchMock } = await renderSignedIn(<Harness />, routes(() => jsonResponse(200, task)));

    await fireEvent.press(screen.getByTestId('start'));
    await fireEvent.press(await screen.findByTestId('task-move-picker-project-p2'));
    await fireEvent.press(await screen.findByTestId('task-move-picker-section-s7'));

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/move')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/move')[0].body).toEqual({ projectId: 'p2', sectionId: 's7' });
  });

  it('back to the Inbox sends the Inbox project and no section', async () => {
    const { fetchMock } = await renderSignedIn(<Harness />, routes(() => jsonResponse(200, task)));

    await fireEvent.press(screen.getByTestId('start'));
    await fireEvent.press(await screen.findByTestId('task-move-picker-project-p-inbox'));
    await fireEvent.press(await screen.findByTestId('task-move-picker-section-none'));

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/move')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/move')[0].body).toEqual({ projectId: 'p-inbox' });
  });

  it('an archived target (422 target-archived) is explained', async () => {
    await renderSignedIn(<Harness />, routes(() => problem(422, 'Unprocessable', { code: 'target-archived' })));

    await fireEvent.press(screen.getByTestId('start'));
    await fireEvent.press(await screen.findByTestId('task-move-picker-project-p2'));
    await fireEvent.press(await screen.findByTestId('task-move-picker-section-none'));

    await waitFor(() => expect(screen.getByTestId('move-error')).toHaveTextContent(vi.errors.targetArchived));
  });

  it('a source in an archived section / project is 409, not 422: the other sentence', async () => {
    await renderSignedIn(<Harness />, routes(() => problem(409, 'Conflict', { code: 'section-archived' })));

    await fireEvent.press(screen.getByTestId('start'));
    await fireEvent.press(await screen.findByTestId('task-move-picker-project-p2'));
    await fireEvent.press(await screen.findByTestId('task-move-picker-section-none'));

    await waitFor(() => expect(screen.getByTestId('move-error')).toHaveTextContent(vi.errors.sectionArchived));
  });
});
