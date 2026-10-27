import '../../../../i18n';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../../../test/render';
import { StyleSheet } from 'react-native';
import { makeTask } from '../../../../test/m1Fixtures';
import { lightPalette as palette } from '../../../../theme';
import { draftFromTask } from '../draft';
import { TaskChips } from '../TaskChips';

jest.mock('../../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

const NOW = new Date('2026-10-23T03:00:00Z'); // Fri 23/10 10:00 local

function pickerAnswers(value: Date) {
  jest.mocked(DateTimePickerAndroid.open).mockImplementationOnce((params) => {
    params.onChange?.({ type: 'set', nativeEvent: { timestamp: value.getTime() } } as never, value);
  });
}

async function show(overrides: Parameters<typeof makeTask>[0] = {}) {
  const task = makeTask({ id: 't1', ...overrides });
  const onCommit = jest.fn();
  const onMove = jest.fn();
  await renderWithProviders(<TaskChips task={task} draft={draftFromTask(task)} now={NOW} timeZone="Asia/Ho_Chi_Minh" onCommit={onCommit} onMove={onMove} />);
  return { onCommit, onMove };
}

describe('TaskChips', () => {
  it('with no date: "Thêm ngày"; a shortcut sets an all-day due', async () => {
    const { onCommit } = await show();
    expect(screen.getByTestId('task-date')).toHaveTextContent(/Thêm ngày/);

    await fireEvent.press(screen.getByTestId('task-date'));
    await fireEvent.press(await screen.findByTestId('task-date-sheet-tomorrow'));

    expect(onCommit).toHaveBeenCalledWith({ dueDate: '2026-10-24', dueDatetime: null, durationMinutes: null });
  });

  it('shows the timed due with its end time in the date tone, and saves a day + time + duration with "Xong"', async () => {
    const { onCommit } = await show({ dueDatetime: '2026-10-23T14:30:00', durationMinutes: 30 });
    expect(screen.getByTestId('task-date')).toHaveTextContent(/Hôm nay 14:30–15:00/);
    expect(StyleSheet.flatten(screen.getByText('Hôm nay 14:30–15:00').props.style)).toMatchObject({ color: palette.ok });

    await fireEvent.press(screen.getByTestId('task-date'));
    await fireEvent.press(await screen.findByTestId('task-date-sheet-day-2026-10-25'));
    pickerAnswers(new Date(2026, 9, 25, 14, 0));
    await fireEvent.press(screen.getByTestId('task-date-sheet-time'));
    await fireEvent.press(screen.getByTestId('task-date-sheet-duration-60'));
    await fireEvent.press(screen.getByTestId('task-date-sheet-done'));

    expect(onCommit).toHaveBeenCalledWith({ dueDate: null, dueDatetime: '2026-10-25T14:00:00', durationMinutes: 60 });
  });

  it('"Không có ngày" clears the whole due with explicit nulls', async () => {
    const { onCommit } = await show({ dueDate: '2026-10-30' });
    await fireEvent.press(screen.getByTestId('task-date'));
    await fireEvent.press(await screen.findByTestId('task-date-sheet-noDate'));
    expect(onCommit).toHaveBeenCalledWith({ dueDate: null, dueDatetime: null, durationMinutes: null });
  });

  it('a completed task shows its date muted', async () => {
    await show({ dueDate: '2026-10-22', completedAt: '2026-10-22T01:00:00Z' });
    expect(StyleSheet.flatten(screen.getByText('Hôm qua').props.style)).toMatchObject({ color: palette.mute });
  });

  it('the deadline chip sets a date only, turns red when passed, and can be removed', async () => {
    const { onCommit } = await show();
    expect(screen.getByTestId('task-deadline-chip')).toHaveTextContent(/Hạn chót/);
    await fireEvent.press(screen.getByTestId('task-deadline-chip'));
    expect(screen.queryByTestId('task-deadline-sheet-time')).toBeNull();
    await fireEvent.press(await screen.findByTestId('task-deadline-sheet-tomorrow'));
    expect(onCommit).toHaveBeenLastCalledWith({ deadlineDate: '2026-10-24' });

    await fireEvent.press(screen.getByTestId('task-deadline-chip'));
    await fireEvent.press(await screen.findByTestId('task-deadline-sheet-noDate'));
    expect(onCommit).toHaveBeenLastCalledWith({ deadlineDate: null });
  });

  it('shows an existing deadline as a date; red once it has passed', async () => {
    await show({ deadlineDate: '2026-10-20' });
    expect(screen.getByTestId('task-deadline-chip')).toHaveTextContent(/20\/10/);
    expect(StyleSheet.flatten(screen.getByTestId('task-deadline-chip').props.style)).toMatchObject({ borderColor: palette.warn });
  });

  it('the priority chip shows the level in its colour and changes it from the menu', async () => {
    const { onCommit } = await show({ priority: 2 });
    expect(screen.getByTestId('task-priority-chip')).toHaveTextContent(/P2/);
    expect(StyleSheet.flatten(screen.getByTestId('task-priority-chip').props.style)).toMatchObject({ borderColor: palette.p2 });

    await fireEvent.press(screen.getByTestId('task-priority-chip'));
    await fireEvent.press(screen.getByTestId('priority-menu-1'));

    expect(onCommit).toHaveBeenCalledWith({ priority: 1 });
  });

  it('"Chuyển tới" asks the screen to open the project picker', async () => {
    const { onMove } = await show();
    await fireEvent.press(screen.getByTestId('task-move-chip'));
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it('readOnly (completed task or archived project / section) locks the date row and every chip', async () => {
    const task = makeTask({ id: 't1', dueDate: '2026-10-30', priority: 2 });
    const onCommit = jest.fn();
    const onMove = jest.fn();
    await renderWithProviders(
      <TaskChips task={task} draft={draftFromTask(task)} now={NOW} timeZone="Asia/Ho_Chi_Minh" onCommit={onCommit} onMove={onMove} readOnly />,
    );

    expect(screen.getByTestId('task-date')).toBeDisabled();
    expect(screen.getByTestId('task-deadline-chip')).toBeDisabled();
    expect(screen.getByTestId('task-priority-chip')).toBeDisabled();
    expect(screen.getByTestId('task-move-chip')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('task-date'));
    expect(screen.queryByTestId('task-date-sheet-tomorrow')).toBeNull();
    expect(onCommit).not.toHaveBeenCalled();
    // The values are still shown.
    expect(screen.getByTestId('task-priority-chip')).toHaveTextContent(/P2/);
  });
});
