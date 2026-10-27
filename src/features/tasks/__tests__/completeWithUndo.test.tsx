import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { SNACKBAR_DURATION_MS } from '../../../components/Snackbar';
import viTaskList from '../../../i18n/locales/vi/taskList.json';
import vi from '../../../i18n/locales/vi.json';
import { requestsTo } from '../../../test/apiRoutes';
import { deferred } from '../../../test/deferred';
import { jsonResponse, problem } from '../../../test/http';
import { affected, makeTask, taskChange } from '../../../test/m1Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { useCompleteWithUndo } from '../useTaskActions';

const DONE_AT = '2026-10-23T03:00:00Z';

/** The screen that started a write can be gone (navigated away, selection cleared) before the answer arrives. */
function Host({ onError }: { onError?: (error: unknown) => void }) {
  const [shown, setShown] = useState(true);
  return <>{shown ? <Inner onError={onError} hide={() => setShown(false)} /> : null}<Pressable testID="host-hide" onPress={() => setShown(false)} /></>;
}

function Inner({ onError, hide }: { onError?: (error: unknown) => void; hide: () => void }) {
  const { complete, completeMany, errorMessage } = useCompleteWithUndo();
  return (
    <>
      <Pressable testID="one" onPress={() => complete('t1', { onError })} />
      {errorMessage ? <Text testID="inline-error">{errorMessage}</Text> : null}
      <Pressable testID="many" onPress={() => completeMany(['t1', 't2'], { onSuccess: hide })} />
    </>
  );
}

describe('useCompleteWithUndo when the screen is gone before the answer arrives', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('still shows the Undo snackbar after a successful close', async () => {
    const reply = deferred<Response>();
    const { fetchMock } = await renderSignedIn(<Host />, { 'POST /api/v1/tasks/t1/close': () => reply.promise });

    await fireEvent.press(screen.getByTestId('one'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/close')).toHaveLength(1));
    await fireEvent.press(screen.getByTestId('host-hide'));
    reply.resolve(jsonResponse(200, taskChange(makeTask({ id: 't1', version: 2, completedAt: DONE_AT }), [])));

    expect(await screen.findByText(viTaskList.taskList.completedOne)).toBeOnTheScreen();
    expect(screen.getByTestId('snackbar-action')).toBeOnTheScreen();
  });

  it('still reports a failed close (404) to the caller', async () => {
    const reply = deferred<Response>();
    const onError = jest.fn();
    const { fetchMock } = await renderSignedIn(<Host onError={onError} />, { 'POST /api/v1/tasks/t1/close': () => reply.promise });

    await fireEvent.press(screen.getByTestId('one'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/close')).toHaveLength(1));
    await fireEvent.press(screen.getByTestId('host-hide'));
    reply.resolve(problem(404, 'Not Found'));

    await waitFor(() => expect(onError).toHaveBeenCalledWith(expect.objectContaining({ status: 404 })));
  });

  it('shows the error of a failed bulk Undo even though the selection bar is already gone', async () => {
    let batches = 0;
    await renderSignedIn(<Host />, {
      'POST /api/v1/tasks/batch': () => {
        batches += 1;
        return batches === 1
          ? jsonResponse(200, affected(['t1', 't2']))
          : problem(500, 'Error', { requestId: '7f3c9a12-aaaa-4bbb-8ccc-dddddddddddd' });
      },
    });

    await fireEvent.press(screen.getByTestId('many'));
    await fireEvent.press(await screen.findByTestId('snackbar-action'));

    expect(await screen.findByText(vi.errors.server.replace('{{code}}', '7f3c9a12'))).toBeOnTheScreen();
  });

  it('a failed Undo is reported once (snackbar), not also as the inline error line of the screen', async () => {
    const serverError = vi.errors.server.replace('{{code}}', '7f3c9a12');
    await renderSignedIn(<Host />, {
      'POST /api/v1/tasks/t1/close': () => jsonResponse(200, taskChange(makeTask({ id: 't1', version: 2, completedAt: DONE_AT }), [])),
      'POST /api/v1/tasks/t1/reopen': () => problem(500, 'Error', { requestId: '7f3c9a12-aaaa-4bbb-8ccc-dddddddddddd' }),
    });

    await fireEvent.press(screen.getByTestId('one'));
    await fireEvent.press(await screen.findByTestId('snackbar-action'));

    expect(await screen.findByText(serverError)).toBeOnTheScreen();
    expect(screen.queryByTestId('inline-error')).toBeNull();
  });

  it('a failed bulk Undo does not hide a newer bulk close that is still in flight', async () => {
    const reopenReply = deferred<Response>();
    const closeReply = deferred<Response>();
    function Bar() {
      const { completeMany, batchPending, errorMessage } = useCompleteWithUndo();
      return (
        <>
          <Pressable testID="first" onPress={() => completeMany(['t1', 't2'])} />
          <Pressable testID="second" onPress={() => completeMany(['t3'])} />
          <Text testID="pending">{batchPending ? 'pending' : 'idle'}</Text>
          {errorMessage ? <Text testID="inline-error">{errorMessage}</Text> : null}
        </>
      );
    }
    await renderSignedIn(<Bar />, {
      'POST /api/v1/tasks/batch': ({ body }) => {
        const request = body as { action: string; taskIds: string[] };
        if (request.action === 'REOPEN') return reopenReply.promise;
        return request.taskIds.length === 2 ? jsonResponse(200, affected(['t1', 't2'])) : closeReply.promise;
      },
    });

    await fireEvent.press(screen.getByTestId('first'));
    await fireEvent.press(await screen.findByTestId('snackbar-action'));
    await fireEvent.press(screen.getByTestId('second'));
    await waitFor(() => expect(screen.getByTestId('pending')).toHaveTextContent('pending'));

    reopenReply.resolve(problem(500, 'Error', { requestId: '7f3c9a12-aaaa-4bbb-8ccc-dddddddddddd' }));
    await screen.findByText(vi.errors.server.replace('{{code}}', '7f3c9a12'));
    expect(screen.getByTestId('pending')).toHaveTextContent('pending');

    closeReply.resolve(problem(500, 'Error', { requestId: 'bbbbbbbb-aaaa-4bbb-8ccc-dddddddddddd' }));
    await waitFor(() => expect(screen.getByTestId('pending')).toHaveTextContent('idle'));
  });

  it('a failed bulk close is reported even when the Undo of an earlier close has taken over the shared observer', async () => {
    const closeReply = deferred<Response>();
    function Bar() {
      const { completeMany, errorMessage } = useCompleteWithUndo();
      return (
        <>
          <Pressable testID="first" onPress={() => completeMany(['t1', 't2'])} />
          <Pressable testID="second" onPress={() => completeMany(['t3'])} />
          {errorMessage ? <Text testID="inline-error">{errorMessage}</Text> : null}
        </>
      );
    }
    await renderSignedIn(<Bar />, {
      'POST /api/v1/tasks/batch': ({ body }) => {
        const request = body as { action: string; taskIds: string[] };
        if (request.action === 'REOPEN') return jsonResponse(200, affected(['t1', 't2']));
        return request.taskIds.length === 2 ? jsonResponse(200, affected(['t1', 't2'])) : closeReply.promise;
      },
    });

    await fireEvent.press(screen.getByTestId('first'));
    const undoA = await screen.findByTestId('snackbar-action');
    await fireEvent.press(screen.getByTestId('second'));
    await fireEvent.press(undoA);
    closeReply.resolve(problem(409, 'Conflict', { requestId: 'cccccccc-aaaa-4bbb-8ccc-dddddddddddd' }));

    expect(await screen.findByText(vi.errors.conflict)).toBeOnTheScreen();
  });

  it('an Undo error is not wiped by the next toast, and its own toast does not wipe a newer Undo button', async () => {
    const reopenReply = deferred<Response>();
    function Bar() {
      const { complete } = useCompleteWithUndo();
      return (
        <>
          <Pressable testID="c1" onPress={() => complete('t1')} />
          <Pressable testID="c2" onPress={() => complete('t2')} />
        </>
      );
    }
    const { fetchMock } = await renderSignedIn(<Bar />, {
      'POST /api/v1/tasks/t1/close': () => jsonResponse(200, taskChange(makeTask({ id: 't1', version: 2, completedAt: DONE_AT }), [])),
      'POST /api/v1/tasks/t2/close': () => jsonResponse(200, taskChange(makeTask({ id: 't2', version: 2, completedAt: DONE_AT }), [])),
      'POST /api/v1/tasks/t1/reopen': () => reopenReply.promise,
    });

    jest.useFakeTimers();
    await fireEvent.press(screen.getByTestId('c1'));
    await fireEvent.press(await screen.findByTestId('snackbar-action'));
    await fireEvent.press(screen.getByTestId('c2'));
    expect(await screen.findByTestId('snackbar-action')).toBeOnTheScreen();
    reopenReply.resolve(problem(500, 'Error', { requestId: '7f3c9a12-aaaa-4bbb-8ccc-dddddddddddd' }));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/reopen')).toHaveLength(1));
    await act(async () => {
      await Promise.resolve();
    });

    // the toast of t2 (with its Undo) is still on screen; the error waits its turn
    const errorText = vi.errors.server.replace('{{code}}', '7f3c9a12');
    expect(screen.getByTestId('snackbar-action')).toBeOnTheScreen();
    expect(screen.queryByText(errorText)).toBeNull();
    await act(async () => {
      jest.advanceTimersByTime(SNACKBAR_DURATION_MS);
    });
    expect(await screen.findByText(errorText)).toBeOnTheScreen();
  });

  it('completing t1 then t2: the toast on screen is t2 and its Undo reopens t2 (not t1)', async () => {
    function Bar() {
      const { complete } = useCompleteWithUndo();
      return (
        <>
          <Pressable testID="c1" onPress={() => complete('t1')} />
          <Pressable testID="c2" onPress={() => complete('t2')} />
        </>
      );
    }
    const { fetchMock } = await renderSignedIn(<Bar />, {
      'POST /api/v1/tasks/t1/close': () => jsonResponse(200, taskChange(makeTask({ id: 't1', version: 2, completedAt: DONE_AT }), [])),
      'POST /api/v1/tasks/t2/close': () => jsonResponse(200, taskChange(makeTask({ id: 't2', version: 2, completedAt: DONE_AT }), [])),
      'POST /api/v1/tasks/t1/reopen': () => jsonResponse(200, taskChange(makeTask({ id: 't1', version: 3 }), [])),
      'POST /api/v1/tasks/t2/reopen': () => jsonResponse(200, taskChange(makeTask({ id: 't2', version: 3 }), [])),
    });

    await fireEvent.press(screen.getByTestId('c1'));
    await screen.findByTestId('snackbar-action');
    await fireEvent.press(screen.getByTestId('c2'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t2/close')).toHaveLength(1));
    await act(async () => {
      await Promise.resolve();
    });
    await fireEvent.press(screen.getByTestId('snackbar-action'));

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t2/reopen')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/reopen')).toHaveLength(0);
  });
});
