import '../../../../i18n';
import { fireEvent, screen } from '@testing-library/react-native';
import { makeTask } from '../../../../test/m1Fixtures';
import { renderWithProviders } from '../../../../test/render';
import { draftFromTask } from '../draft';
import { TaskChips } from '../TaskChips';

jest.mock('../../../reminders/TaskReminderChip', () => ({ TaskReminderChip: () => null }));
jest.mock('../../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

const NOW = new Date('2026-10-23T03:00:00Z');

async function show(overrides: Parameters<typeof makeTask>[0] = {}, readOnly = false) {
  const task = makeTask({ id: 't1', ...overrides });
  const onCommit = jest.fn();
  await renderWithProviders(
    <TaskChips task={task} draft={draftFromTask(task)} now={NOW} timeZone="Asia/Ho_Chi_Minh" onCommit={onCommit} onMove={jest.fn()} readOnly={readOnly} />,
  );
  return { onCommit };
}

describe('TaskChips — repeat (M6c)', () => {
  it('shows the rule in words under the date row', async () => {
    await show({ dueDate: '2026-10-28', recurrenceRule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=WE', isRecurring: true });
    expect(screen.getByTestId('task-repeat-text')).toHaveTextContent('Mỗi 2 tuần vào Thứ Tư');
  });

  it('says it is counted from the completed date for every!', async () => {
    await show({ dueDate: '2026-10-28', recurrenceRule: 'FREQ=DAILY;INTERVAL=3', recurrenceFromCompletion: true, isRecurring: true });
    expect(screen.getByTestId('task-repeat-text')).toHaveTextContent('Mỗi 3 ngày, tính từ ngày hoàn thành');
  });

  it('shows no repeat line for a plain task', async () => {
    await show({ dueDate: '2026-10-28' });
    expect(screen.queryByTestId('task-repeat')).toBeNull();
  });

  it('saves the rule with the due when a preset is picked in the date sheet', async () => {
    const { onCommit } = await show({ dueDate: '2026-10-28' });
    await fireEvent.press(screen.getByTestId('task-date'));
    await fireEvent.press(await screen.findByTestId('task-date-sheet-repeat'));
    await fireEvent.press(await screen.findByTestId('task-date-sheet-repeat-sheet-preset-weekly'));
    await fireEvent.press(screen.getByTestId('task-date-sheet-done'));

    expect(onCommit).toHaveBeenCalledWith({
      dueDate: '2026-10-28',
      dueDatetime: null,
      durationMinutes: null,
      recurrenceRule: 'FREQ=WEEKLY;BYDAY=WE',
      recurrenceFromCompletion: false,
    });
  });

  it('a Custom "Completed date" rule saves recurrenceFromCompletion: true', async () => {
    const { onCommit } = await show({ dueDate: '2026-10-28' });
    await fireEvent.press(screen.getByTestId('task-date'));
    await fireEvent.press(await screen.findByTestId('task-date-sheet-repeat'));
    await fireEvent.press(await screen.findByTestId('task-date-sheet-repeat-sheet-custom'));
    await fireEvent.press(screen.getByTestId('task-date-sheet-repeat-sheet-based-on-completed'));
    await fireEvent.changeText(screen.getByTestId('task-date-sheet-repeat-sheet-every'), '3');
    await fireEvent.press(screen.getByTestId('task-date-sheet-repeat-sheet-custom-done'));
    await fireEvent.press(screen.getByTestId('task-date-sheet-done'));

    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({ recurrenceRule: 'FREQ=DAILY;INTERVAL=3', recurrenceFromCompletion: true }),
    );
  });

  it('"Bỏ lặp lại" saves recurrenceRule: null', async () => {
    const { onCommit } = await show({ dueDate: '2026-10-28', recurrenceRule: 'FREQ=DAILY', isRecurring: true });
    await fireEvent.press(screen.getByTestId('task-date'));
    await fireEvent.press(await screen.findByTestId('task-date-sheet-repeat'));
    await fireEvent.press(await screen.findByTestId('task-date-sheet-repeat-sheet-clear'));
    await fireEvent.press(screen.getByTestId('task-date-sheet-done'));
    expect(onCommit).toHaveBeenCalledWith(expect.objectContaining({ recurrenceRule: null, recurrenceFromCompletion: false }));
  });

  it('moving the date of a repeating task sends the date only — the rule is untouched', async () => {
    const { onCommit } = await show({ dueDate: '2026-10-28', recurrenceRule: 'FREQ=WEEKLY;BYDAY=WE', isRecurring: true });
    await fireEvent.press(screen.getByTestId('task-date'));
    await fireEvent.press(await screen.findByTestId('task-date-sheet-tomorrow'));
    expect(onCommit).toHaveBeenCalledWith({ dueDate: '2026-10-24', dueDatetime: null, durationMinutes: null });
  });

  it('a rule this app cannot read is shown nowhere and never rewritten (no Repeat row)', async () => {
    const { onCommit } = await show({ dueDate: '2026-10-28', recurrenceRule: 'FREQ=DAILY;COUNT=3', isRecurring: true });
    expect(screen.queryByTestId('task-repeat')).toBeNull();
    await fireEvent.press(screen.getByTestId('task-date'));
    expect(screen.queryByTestId('task-date-sheet-repeat')).toBeNull();
    await fireEvent.press(await screen.findByTestId('task-date-sheet-tomorrow'));
    expect(onCommit).toHaveBeenCalledWith({ dueDate: '2026-10-24', dueDatetime: null, durationMinutes: null });
  });

  it('read only: the rule is shown, the Repeat row cannot be reached', async () => {
    await show({ dueDate: '2026-10-28', recurrenceRule: 'FREQ=DAILY', isRecurring: true }, true);
    expect(screen.getByTestId('task-repeat-text')).toHaveTextContent('Mỗi ngày');
    expect(screen.getByTestId('task-date')).toBeDisabled();
  });
});
