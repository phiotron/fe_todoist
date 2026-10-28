import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Pressable } from 'react-native';
import viRecurrence from '../../../i18n/locales/vi/recurrence.json';
import viTaskList from '../../../i18n/locales/vi/taskList.json';
import { requestsTo } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { makeTask, taskChange } from '../../../test/m1Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { useCompleteWithUndo } from '../useTaskActions';

const YEAR = new Date().getFullYear(); // the toast leaves the year out when it is the current one
const DONE_AT = `${YEAR}-10-23T03:00:00Z`;

function Host() {
  const { complete } = useCompleteWithUndo();
  return (
    <>
      <Pressable testID="plain" onPress={() => complete('t1')} />
      <Pressable testID="forever" onPress={() => complete('t1', { forever: true })} />
      <Pressable testID="reset" onPress={() => complete('t1', { resetSubtasks: true })} />
    </>
  );
}

const repeating = (extra: Parameters<typeof makeTask>[0] = {}) =>
  makeTask({ id: 't1', dueDate: `${YEAR}-12-05`, recurrenceRule: 'FREQ=WEEKLY;BYDAY=TH', isRecurring: true, version: 1, ...extra });

describe('completing a repeating task (M6c)', () => {
  it('a plain close sends no body; the task stays open, so the toast says when it comes next', async () => {
    const { fetchMock } = await renderSignedIn(<Host />, {
      'POST /api/v1/tasks/t1/close': () => jsonResponse(200, taskChange(repeating())),
    });

    await fireEvent.press(screen.getByTestId('plain'));

    expect(await screen.findByText(viRecurrence.recurrence.completedNext.replace('{{date}}', '05/12'))).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/close')[0].body).toBeUndefined();
  });

  it('Undo reopens with undo: true (the server brings the previous due back)', async () => {
    const { fetchMock } = await renderSignedIn(<Host />, {
      'POST /api/v1/tasks/t1/close': () => jsonResponse(200, taskChange(repeating())),
      'POST /api/v1/tasks/t1/reopen': () => jsonResponse(200, taskChange(repeating({ dueDate: `${YEAR}-11-28`, version: 2 }))),
    });

    await fireEvent.press(screen.getByTestId('plain'));
    await fireEvent.press(await screen.findByTestId('snackbar-action'));

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/reopen')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/reopen')[0].body).toEqual({ undo: true });
  });

  it('Complete forever sends {forever: true}; the task is really completed and the toast says so', async () => {
    const { fetchMock } = await renderSignedIn(<Host />, {
      'POST /api/v1/tasks/t1/close': () => jsonResponse(200, taskChange(repeating({ completedAt: DONE_AT, version: 2 }))),
    });

    await fireEvent.press(screen.getByTestId('forever'));

    expect(await screen.findByText(viRecurrence.recurrence.completedForever)).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/close')[0].body).toEqual({ forever: true });
  });

  it('Complete & reset sub-tasks sends {resetSubtasks: true}', async () => {
    const { fetchMock } = await renderSignedIn(<Host />, {
      'POST /api/v1/tasks/t1/close': () =>
        jsonResponse(200, taskChange(repeating(), [{ id: 'k1', version: 2, completedAt: null }])),
    });

    await fireEvent.press(screen.getByTestId('reset'));

    expect(await screen.findByTestId('snackbar-action')).toBeOnTheScreen();
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/close')[0].body).toEqual({ resetSubtasks: true });
  });

  it('a task that is not repeating keeps the old toast', async () => {
    await renderSignedIn(<Host />, {
      'POST /api/v1/tasks/t1/close': () => jsonResponse(200, taskChange(makeTask({ id: 't1', completedAt: DONE_AT, version: 1 }))),
    });
    await fireEvent.press(screen.getByTestId('plain'));
    expect(await screen.findByText(viTaskList.taskList.completedOne)).toBeOnTheScreen();
  });

  it('a repeating task whose cycle ended (completedAt set) also keeps the old toast', async () => {
    await renderSignedIn(<Host />, {
      'POST /api/v1/tasks/t1/close': () => jsonResponse(200, taskChange(repeating({ completedAt: DONE_AT, version: 2 }))),
    });
    await fireEvent.press(screen.getByTestId('plain'));
    expect(await screen.findByText(viTaskList.taskList.completedOne)).toBeOnTheScreen();
  });
});
