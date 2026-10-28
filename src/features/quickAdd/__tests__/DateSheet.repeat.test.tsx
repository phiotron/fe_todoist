import '../../../i18n';
import { fireEvent, screen } from '@testing-library/react-native';
import { jsonResponse } from '../../../test/http';
import { renderSignedIn } from '../../../test/screen';
import { toRRule } from '../../../lib/recurrence/rrule';
import type { RecurrenceSpec } from '../../../lib/recurrence/types';
import type { DueValue } from '../../schedule/dueValue';
import { DateSheet } from '../DateSheet';

// Today in the tests: Friday 2026-10-23, 10:00 in Vietnam.
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

const WEDNESDAY: DueValue = { dueDate: '2026-10-28', dueDatetime: null, durationMinutes: null };

async function open(extra: { repeat?: RecurrenceSpec | null } = {}) {
  const onSelect = jest.fn();
  const onClose = jest.fn();
  await renderSignedIn(<DateSheet visible value={WEDNESDAY} onSelect={onSelect} onClose={onClose} {...extra} />, {
    'GET /api/v1/tasks/day-counts': () => jsonResponse(200, { counts: {} }),
  });
  return { onSelect, onClose };
}

describe('DateSheet — Repeat row (M6b + M6c)', () => {
  it('is absent unless the caller passes `repeat`', async () => {
    await open();
    expect(screen.queryByTestId('date-sheet-repeat')).toBeNull();
  });

  it('without touching Repeat, Save reports the unchanged rule (null)', async () => {
    const { onSelect } = await open({ repeat: null });
    expect(screen.getByTestId('date-sheet-repeat-value')).toHaveTextContent('Không lặp');
    await fireEvent.press(screen.getByTestId('date-sheet-save'));
    expect(onSelect).toHaveBeenCalledWith(WEDNESDAY, null);
  });

  it('picks a preset in the Repeat sheet and saves it with the date; the rule follows a later day change', async () => {
    const { onSelect } = await open({ repeat: null });
    await fireEvent.press(screen.getByTestId('date-sheet-repeat'));
    await fireEvent.press(await screen.findByTestId('date-sheet-repeat-sheet-preset-weekly'));
    expect(screen.getByTestId('date-sheet-repeat-value')).toHaveTextContent('Mỗi tuần vào Thứ Tư');
    expect(onSelect).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('date-sheet-day-2026-10-30')); // a Friday
    await fireEvent.press(screen.getByTestId('date-sheet-save'));

    expect(onSelect.mock.calls[0][0]).toMatchObject({ dueDate: '2026-10-30' });
    expect(toRRule(onSelect.mock.calls[0][1] as RecurrenceSpec)).toBe('FREQ=WEEKLY;BYDAY=FR');
  });
});
