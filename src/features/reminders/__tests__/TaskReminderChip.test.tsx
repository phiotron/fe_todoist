import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import viCore from '../../../i18n/locales/vi.json';
import vi from '../../../i18n/locales/vi/reminders.json';
import { requestsTo, type ApiRoutes } from '../../../test/apiRoutes';
import { jsonResponse, problem } from '../../../test/http';
import { renderSignedIn } from '../../../test/screen';
import { OpenRemindersContext } from '../OpenRemindersContext';
import { openTaskReminders } from '../openTaskReminders';
import { TaskReminderChip, type ReminderChipTask } from '../TaskReminderChip';

const REMINDERS_PATH = '/api/v1/tasks/t-1/reminders';
const CREATED_AT = '2026-10-23T03:00:00Z';
const ABSOLUTE = { id: 'r-1', taskId: 't-1', type: 'ABSOLUTE', at: '2026-10-24T09:00:00', minuteOffset: null, createdAt: CREATED_AT };
const RELATIVE = { id: 'r-2', taskId: 't-1', type: 'RELATIVE', at: null, minuteOffset: 30, createdAt: CREATED_AT };
const TIMED_TASK: ReminderChipTask = { id: 't-1', dueDatetime: '2026-10-24T10:00:00' };

function routes(initial: object[] = [], extra: ApiRoutes = {}): ApiRoutes {
  let current = [...initial];
  return {
    [`GET ${REMINDERS_PATH}`]: () => jsonResponse(200, current),
    [`POST ${REMINDERS_PATH}`]: (request) => {
      const created = { id: `r-${current.length + 10}`, taskId: 't-1', at: null, minuteOffset: null, createdAt: CREATED_AT, ...(request.body as object) };
      current = [...current, created];
      return jsonResponse(201, created);
    },
    [`DELETE ${REMINDERS_PATH}/r-1`]: () => {
      current = current.filter((reminder) => (reminder as { id: string }).id !== 'r-1');
      return jsonResponse(204);
    },
    ...extra,
  };
}

describe('TaskReminderChip', () => {
  it('says "Nhắc nhở" when the task has no reminder', async () => {
    await renderSignedIn(<TaskReminderChip task={TIMED_TASK} />, routes());

    expect(await screen.findByText(vi.reminders.chip.label)).toBeOnTheScreen();
  });

  it('shows the value on the chip and lists the reminders in the editor', async () => {
    await renderSignedIn(<TaskReminderChip task={TIMED_TASK} />, routes([ABSOLUTE, RELATIVE]));

    // Design M-TaskDetail: the chip shows the value; with two reminders, the first one + " +1".
    expect(await screen.findByText('24/10/2026 09:00 +1')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('task-reminder-chip'));

    expect(screen.getByText('24/10/2026 09:00')).toBeOnTheScreen();
    expect(screen.getAllByText('30 phút trước').length).toBeGreaterThanOrEqual(2); // list row + "before due" choice
  });

  it('adds a reminder before the due time with an Idempotency-Key and refreshes the list', async () => {
    const { fetchMock } = await renderSignedIn(<TaskReminderChip task={TIMED_TASK} />, routes());
    await fireEvent.press(await screen.findByTestId('task-reminder-chip'));

    await fireEvent.press(screen.getByTestId('reminder-add-relative-15'));

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', REMINDERS_PATH)).toHaveLength(1));
    const [post] = requestsTo(fetchMock, 'POST', REMINDERS_PATH);
    expect(post.body).toEqual({ type: 'RELATIVE', minuteOffset: 15 });
    expect(post.headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
    await waitFor(() => expect(screen.getByTestId('task-reminder-chip')).toHaveTextContent(/15 phút trước/));
  });

  it('removes a reminder', async () => {
    await renderSignedIn(<TaskReminderChip task={TIMED_TASK} />, routes([ABSOLUTE]));
    await screen.findByText('24/10/2026 09:00');
    await fireEvent.press(screen.getByTestId('task-reminder-chip'));

    await fireEvent.press(screen.getByTestId('reminder-remove-r-1'));

    await waitFor(() => expect(screen.queryAllByText('24/10/2026 09:00')).toHaveLength(0));
    expect(screen.getByTestId('task-reminder-chip')).toHaveTextContent(new RegExp(vi.reminders.chip.label));
  });

  it('treats a reminder that is already gone (404) as removed', async () => {
    const { fetchMock } = await renderSignedIn(<TaskReminderChip task={TIMED_TASK} />, routes([ABSOLUTE], {
      [`DELETE ${REMINDERS_PATH}/r-1`]: () => problem(404, 'Not Found'),
    }));
    await screen.findByText('24/10/2026 09:00');
    await fireEvent.press(screen.getByTestId('task-reminder-chip'));

    await fireEvent.press(screen.getByTestId('reminder-remove-r-1'));

    await waitFor(() => expect(requestsTo(fetchMock, 'DELETE', `${REMINDERS_PATH}/r-1`)).toHaveLength(1));
    await waitFor(() => expect(screen.getByTestId('reminder-remove-r-1').props.accessibilityState.disabled).toBe(false));
    expect(screen.queryByTestId('reminder-editor-error')).toBeNull();
  });

  it('says how many reminders are allowed when the 700 limit is reached', async () => {
    await renderSignedIn(<TaskReminderChip task={TIMED_TASK} />, routes([], {
      [`POST ${REMINDERS_PATH}`]: () => problem(422, 'Unprocessable', { code: 'limit-reached', limit: 'REMINDERS', max: 700 }),
    }));
    await fireEvent.press(await screen.findByTestId('task-reminder-chip'));

    await fireEvent.press(screen.getByTestId('reminder-add-relative-30'));

    expect(await screen.findByTestId('reminder-editor-error')).toHaveTextContent(
      viCore.errors.limit.reminders.replace('{{max}}', '700'),
    );
  });

  it('opens the editor right away when the Reminders swipe action asked for it', async () => {
    await renderSignedIn(
      <OpenRemindersContext.Provider value>
        <TaskReminderChip task={TIMED_TASK} />
      </OpenRemindersContext.Provider>,
      routes(),
    );

    expect(await screen.findByTestId('reminder-editor')).toBeOnTheScreen();
  });

  it('cannot remind before the due time of a task without a time', async () => {
    await renderSignedIn(<TaskReminderChip task={{ ...TIMED_TASK, dueDatetime: null }} />, routes());
    await fireEvent.press(await screen.findByTestId('task-reminder-chip'));

    expect(screen.getByText(vi.reminders.editor.relativeNeedsTime)).toBeOnTheScreen();
  });

  it('is read-only when the task screen says so (completed task, archived project / section): the list shows, nothing can be added or removed', async () => {
    await renderSignedIn(<TaskReminderChip task={TIMED_TASK} readOnly />, routes([ABSOLUTE]));
    await screen.findByText('24/10/2026 09:00');
    await fireEvent.press(screen.getByTestId('task-reminder-chip'));

    // Once on the chip, once in the list.
    expect(screen.getAllByText('24/10/2026 09:00')).toHaveLength(2);
    expect(screen.queryByTestId('reminder-add-absolute')).toBeNull();
    expect(screen.queryByTestId('reminder-remove-r-1')).toBeNull();
  });
});

describe('openTaskReminders', () => {
  it('opens the task screen with its reminders shown', () => {
    const router = { push: jest.fn() };

    openTaskReminders(router, 't-1');

    expect(router.push).toHaveBeenCalledWith({ pathname: '/task/[id]', params: { id: 't-1', reminders: '1' } });
  });
});
