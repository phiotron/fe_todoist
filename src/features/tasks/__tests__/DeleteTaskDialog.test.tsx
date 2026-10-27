import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { viTranslation as vi } from '../../../i18n';
import { jsonResponse, mockFetch, problem, requestAt } from '../../../test/http';
import { routeFetch } from '../../../test/m3Routes';
import { renderWithProviders } from '../../../test/render';
import { DeleteTaskDialog } from '../DeleteTaskDialog';

const TASK = { id: 't1', content: 'Pay rent', subtaskCount: 0 };

describe('DeleteTaskDialog (swipe Delete, BR-11)', () => {
  it('names the task and says it cannot be undone; Cancel calls nothing', async () => {
    const fetchMock = mockFetch();
    const onClose = jest.fn();
    await renderWithProviders(<DeleteTaskDialog task={TASK} onClose={onClose} />);

    expect(screen.getByText(vi.settings.swipeDelete.title)).toBeTruthy();
    expect(screen.getByText(vi.settings.swipeDelete.message.replace('{{name}}', 'Pay rent'))).toBeTruthy();
    await fireEvent.press(screen.getByTestId('swipe-delete-dialog-cancel'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('mentions the sub-tasks that go with it', async () => {
    mockFetch();
    await renderWithProviders(<DeleteTaskDialog task={{ ...TASK, subtaskCount: 3 }} onClose={jest.fn()} />);

    expect(
      screen.getByText(vi.settings.swipeDelete.messageWithSubtasks.replace('{{name}}', 'Pay rent').replace('{{count}}', '3')),
    ).toBeTruthy();
  });

  it('confirming deletes the task permanently and closes', async () => {
    const fetchMock = mockFetch();
    routeFetch(fetchMock, { 'DELETE /api/v1/tasks/t1': () => jsonResponse(204) });
    const onClose = jest.fn();
    await renderWithProviders(<DeleteTaskDialog task={TASK} onClose={onClose} />);

    await fireEvent.press(screen.getByTestId('swipe-delete-dialog-confirm'));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(requestAt(fetchMock, 0).method).toBe('DELETE');
    expect(requestAt(fetchMock, 0).url).toMatch(/\/api\/v1\/tasks\/t1$/);
  });

  it('a task that is already gone (404) counts as deleted', async () => {
    routeFetch(mockFetch(), { 'DELETE /api/v1/tasks/t1': () => problem(404, 'Not Found') });
    const onClose = jest.fn();
    await renderWithProviders(<DeleteTaskDialog task={TASK} onClose={onClose} />);

    await fireEvent.press(screen.getByTestId('swipe-delete-dialog-confirm'));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('a failure stays in the dialog, which stays open', async () => {
    routeFetch(mockFetch(), { 'DELETE /api/v1/tasks/t1': () => problem(503, 'Service Unavailable') });
    const onClose = jest.fn();
    await renderWithProviders(<DeleteTaskDialog task={TASK} onClose={onClose} />);

    await fireEvent.press(screen.getByTestId('swipe-delete-dialog-confirm'));

    expect(await screen.findByTestId('swipe-delete-dialog-error')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it.each([
    ['project-archived', vi.errors.projectArchived],
    ['section-archived', vi.errors.sectionArchived],
  ])('a task in an archived project / section (409 %s, spec 18.1 I15) is not deleted: the shared sentence, dialog stays open', async (code, sentence) => {
    routeFetch(mockFetch(), { 'DELETE /api/v1/tasks/t1': () => problem(409, 'Conflict', { code }) });
    const onClose = jest.fn();
    await renderWithProviders(<DeleteTaskDialog task={TASK} onClose={onClose} />);

    await fireEvent.press(screen.getByTestId('swipe-delete-dialog-confirm'));

    expect((await screen.findByTestId('swipe-delete-dialog-error')).props.children).toBe(sentence);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders nothing without a task', async () => {
    mockFetch();
    await renderWithProviders(<DeleteTaskDialog task={null} onClose={jest.fn()} />);

    expect(screen.queryByTestId('swipe-delete-dialog')).toBeNull();
  });
});
