import '../../../i18n';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { toRRule } from '../../../lib/recurrence/rrule';
import type { RecurrenceSpec } from '../../../lib/recurrence/types';
import { NO_DUE, type DueValue } from '../dueValue';
import { ScheduleSheet, type ScheduleSheetProps } from '../ScheduleSheet';

// Fri 23/10/2026 10:00 in Vietnam.
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

const WEDNESDAY: DueValue = { dueDate: '2026-10-28', dueDatetime: null, durationMinutes: null };
const WEEKLY_WE: RecurrenceSpec = { freq: 'WEEKLY', interval: 1, byDay: [{ weekday: 'WE' }], fromCompletion: false };

async function open(value: DueValue, extra: Partial<ScheduleSheetProps> = {}) {
  const onSelect = jest.fn();
  const onClose = jest.fn();
  await render(<ScheduleSheet visible value={value} onSelect={onSelect} onClose={onClose} {...extra} />);
  return { onSelect, onClose };
}

const sentRule = (onSelect: jest.Mock): string | null => {
  const rule = onSelect.mock.calls[0][1] as RecurrenceSpec | null;
  return rule ? toRRule(rule) : null;
};

describe('ScheduleSheet — Repeat row (M6c)', () => {
  it('is absent unless the caller opts in with `repeat`, and absent for date-only sheets', async () => {
    await open(WEDNESDAY);
    expect(screen.queryByTestId('schedule-repeat')).toBeNull();
  });

  it('is absent in date mode (deadline, reschedule) even with `repeat`', async () => {
    await open(WEDNESDAY, { repeat: null, mode: 'date' });
    expect(screen.queryByTestId('schedule-repeat')).toBeNull();
  });

  it('says "Không lặp" without a rule and describes the rule when there is one', async () => {
    await open(WEDNESDAY, { repeat: null });
    expect(screen.getByTestId('schedule-repeat-value')).toHaveTextContent('Không lặp');
  });

  it('shows the current rule in words', async () => {
    await open(WEDNESDAY, { repeat: WEEKLY_WE });
    expect(screen.getByTestId('schedule-repeat-value')).toHaveTextContent('Mỗi tuần vào Thứ Tư');
  });

  it('a plain date without touching the repeat reports the unchanged rule', async () => {
    const { onSelect } = await open(WEDNESDAY, { repeat: null });
    await fireEvent.press(screen.getByTestId('schedule-done'));
    expect(onSelect).toHaveBeenCalledWith(WEDNESDAY, null);
  });

  it('picks a preset in the Repeat sheet and saves it with the due on "Xong"', async () => {
    const { onSelect } = await open(WEDNESDAY, { repeat: null });
    await fireEvent.press(screen.getByTestId('schedule-repeat'));
    await fireEvent.press(await screen.findByTestId('schedule-repeat-sheet-preset-weekly'));
    expect(screen.getByTestId('schedule-repeat-value')).toHaveTextContent('Mỗi tuần vào Thứ Tư');
    expect(onSelect).not.toHaveBeenCalled(); // nothing is saved before "Xong"

    await fireEvent.press(screen.getByTestId('schedule-done'));

    expect(onSelect).toHaveBeenCalledWith(WEDNESDAY, expect.objectContaining({ freq: 'WEEKLY' }));
    expect(sentRule(onSelect)).toBe('FREQ=WEEKLY;BYDAY=WE');
  });

  it('a rule needs a day: with no date the sheet takes today (Friday 23/10)', async () => {
    const { onSelect } = await open(NO_DUE, { repeat: null });
    await fireEvent.press(screen.getByTestId('schedule-repeat'));
    await fireEvent.press(await screen.findByTestId('schedule-repeat-sheet-preset-weekly'));
    await fireEvent.press(screen.getByTestId('schedule-done'));

    expect(onSelect.mock.calls[0][0]).toEqual({ dueDate: '2026-10-23', dueDatetime: null, durationMinutes: null });
    expect(sentRule(onSelect)).toBe('FREQ=WEEKLY;BYDAY=FR');
  });

  it('a rule chosen here follows the day when the day changes before "Xong"', async () => {
    const { onSelect } = await open(WEDNESDAY, { repeat: null });
    await fireEvent.press(screen.getByTestId('schedule-repeat'));
    await fireEvent.press(await screen.findByTestId('schedule-repeat-sheet-preset-weekly'));
    await fireEvent.press(screen.getByTestId('schedule-day-2026-10-30')); // a Friday
    await fireEvent.press(screen.getByTestId('schedule-done'));

    expect(onSelect.mock.calls[0][0]).toMatchObject({ dueDate: '2026-10-30' });
    expect(sentRule(onSelect)).toBe('FREQ=WEEKLY;BYDAY=FR');
  });

  it('moving only this occurrence keeps the rule as it is (spec 5.3: edit once, keep the repeat)', async () => {
    const { onSelect } = await open(WEDNESDAY, { repeat: WEEKLY_WE });
    await fireEvent.press(screen.getByTestId('schedule-day-2026-10-30'));
    await fireEvent.press(screen.getByTestId('schedule-done'));

    expect(onSelect.mock.calls[0][0]).toMatchObject({ dueDate: '2026-10-30' });
    expect(sentRule(onSelect)).toBe('FREQ=WEEKLY;BYDAY=WE');
  });

  it('"Bỏ lặp lại" saves a null rule', async () => {
    const { onSelect } = await open(WEDNESDAY, { repeat: WEEKLY_WE });
    await fireEvent.press(screen.getByTestId('schedule-repeat'));
    await fireEvent.press(await screen.findByTestId('schedule-repeat-sheet-clear'));
    expect(screen.getByTestId('schedule-repeat-value')).toHaveTextContent('Không lặp');
    await fireEvent.press(screen.getByTestId('schedule-done'));
    expect(onSelect).toHaveBeenCalledWith(WEDNESDAY, null);
  });

  it('"Không có ngày" drops the rule too (a rule needs a due)', async () => {
    const { onSelect } = await open(WEDNESDAY, { repeat: WEEKLY_WE });
    await fireEvent.press(screen.getByTestId('schedule-noDate'));
    expect(onSelect).toHaveBeenCalledWith(NO_DUE, null);
  });

  it('a shortcut applies the pending rule at once', async () => {
    const { onSelect } = await open(WEDNESDAY, { repeat: WEEKLY_WE });
    await fireEvent.press(screen.getByTestId('schedule-tomorrow'));
    expect(onSelect.mock.calls[0][0]).toMatchObject({ dueDate: '2026-10-24' });
    expect(sentRule(onSelect)).toBe('FREQ=WEEKLY;BYDAY=WE');
  });
});
