import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Pressable } from 'react-native';
import { requestsTo } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { makeTask, taskChange } from '../../../test/m1Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { useCompleteWithUndo } from '../useTaskActions';

const PENDING = makeTask({ id: 't1', reviewStatus: 'PENDING', reviewRequestedBy: 'u1', reviewRequestedAt: '2026-10-29T03:00:00Z' });
const NONE = makeTask({ id: 't1' });

function Host({ wasPending = false }: { wasPending?: boolean }) {
  const { complete } = useCompleteWithUndo();
  return <Pressable testID="tick" onPress={() => complete('t1', { wasPending })} />;
}

describe('tick of a task that needs review', () => {
  it('a PENDING answer shows "Đã gửi yêu cầu duyệt" with Undo (not "Đã hoàn thành")', async () => {
    await renderSignedIn(<Host />, { 'POST /api/v1/tasks/t1/close': () => jsonResponse(200, taskChange(PENDING)) });
    await fireEvent.press(screen.getByTestId('tick'));
    expect(await screen.findByText('Đã gửi yêu cầu duyệt')).toBeOnTheScreen();
    expect(screen.queryByText('Đã hoàn thành 1 công việc')).toBeNull();
    expect(screen.getByTestId('snackbar-action')).toBeOnTheScreen();
  });

  it('Undo of the request cancels it: the same close is sent again', async () => {
    const { fetchMock } = await renderSignedIn(<Host />, { 'POST /api/v1/tasks/t1/close': () => jsonResponse(200, taskChange(PENDING)) });
    await fireEvent.press(screen.getByTestId('tick'));
    await fireEvent.press(await screen.findByTestId('snackbar-action'));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/close')).toHaveLength(2));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/tasks/t1/reopen')).toHaveLength(0);
  });

  it('ticking my pending task again cancels the request: "Đã huỷ yêu cầu duyệt" + Undo', async () => {
    await renderSignedIn(<Host wasPending />, { 'POST /api/v1/tasks/t1/close': () => jsonResponse(200, taskChange(NONE)) });
    await fireEvent.press(screen.getByTestId('tick'));
    expect(await screen.findByText('Đã huỷ yêu cầu duyệt')).toBeOnTheScreen();
    expect(screen.getByTestId('snackbar-action')).toBeOnTheScreen();
  });

  it('a normal completion keeps its message (Admin / personal project)', async () => {
    await renderSignedIn(<Host />, {
      'POST /api/v1/tasks/t1/close': () => jsonResponse(200, taskChange(makeTask({ id: 't1', completedAt: '2026-10-29T03:00:00Z' }))),
    });
    await fireEvent.press(screen.getByTestId('tick'));
    expect(await screen.findByText('Đã hoàn thành 1 công việc')).toBeOnTheScreen();
  });
});
