import '../../../i18n';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { fireEvent, screen } from '@testing-library/react-native';
import { jsonResponse } from '../../../test/http';
import { renderSignedIn } from '../../../test/screen';
import { requestsTo } from '../../../test/apiRoutes';
import { NO_DUE, type DueValue } from '../../schedule/dueValue';
import { DateSheet } from '../DateSheet';
import { monthRange } from '../useDayCounts';

// Today in the tests: Friday 2026-10-23, 10:00 in Vietnam.
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

function pickerAnswers(value: Date | null) {
  jest.mocked(DateTimePickerAndroid.open).mockImplementationOnce((params) => {
    params.onChange?.(
      { type: value ? 'set' : 'dismissed', nativeEvent: { timestamp: value?.getTime() ?? 0 } } as never,
      value ?? undefined,
    );
  });
}

const DAY_COUNTS = '/api/v1/tasks/day-counts';
const counts = { '2026-10-23': 1, '2026-10-24': 3, '2026-10-28': 2 };

async function open(value: DueValue = NO_DUE) {
  const onSelect = jest.fn();
  const onClose = jest.fn();
  const rendered = await renderSignedIn(<DateSheet visible value={value} onSelect={onSelect} onClose={onClose} />, {
    [`GET ${DAY_COUNTS}`]: () => jsonResponse(200, { counts }),
  });
  return { onSelect, onClose, ...rendered };
}

describe('monthRange', () => {
  it('first to last day of the month (within the 62-day limit)', () => {
    expect(monthRange('2026-10-23')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(monthRange('2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
});

describe('DateSheet (M6b)', () => {
  it('asks day-counts for the month shown and writes the number under each day', async () => {
    const { fetchMock } = await open();

    expect(await screen.findByTestId('date-sheet-count-2026-10-24')).toHaveTextContent('3');
    const [request] = requestsTo(fetchMock, 'GET', DAY_COUNTS);
    expect(request.query.get('from')).toBe('2026-10-01');
    expect(request.query.get('to')).toBe('2026-10-31');
  });

  it('presets: Tomorrow applies at once; Later this week = today + 2; "No date" clears', async () => {
    const { onSelect, onClose } = await open();
    // Friday: today + 2 (Sunday) is not before the weekend (Saturday), so "Later this week" is not offered.
    expect(screen.queryByTestId('date-sheet-laterThisWeek')).toBeNull();

    await fireEvent.press(screen.getByTestId('date-sheet-tomorrow'));
    expect(onSelect).toHaveBeenLastCalledWith({ dueDate: '2026-10-24', dueDatetime: null, durationMinutes: null });
    expect(onClose).toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('date-sheet-noDate'));
    expect(onSelect).toHaveBeenLastCalledWith(NO_DUE);
  });

  it('typing a date shows a preview and Save applies it, time and duration included', async () => {
    const { onSelect } = await open();

    await fireEvent.changeText(screen.getByTestId('date-sheet-input'), 'next friday 3pm for 30 min');

    expect(screen.getByTestId('date-sheet-preview')).toHaveTextContent(/30\/10/);
    await fireEvent.press(screen.getByTestId('date-sheet-save'));
    // Today is Friday 23/10 → "next friday" = Friday of next week (30/10).
    expect(onSelect).toHaveBeenCalledWith({ dueDate: null, dueDatetime: '2026-10-30T15:00:00', durationMinutes: 30 });
  });

  it('a text that is not a date blocks Save and says so', async () => {
    const { onSelect } = await open();

    await fireEvent.changeText(screen.getByTestId('date-sheet-input'), 'blah');

    expect(screen.getByTestId('date-sheet-preview')).toBeOnTheScreen();
    expect(screen.getByTestId('date-sheet-save')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('date-sheet-save'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('calendar day → "· 3 tasks" line; the time chip has a cross that removes the time and the duration', async () => {
    const { onSelect } = await open({ dueDate: null, dueDatetime: '2026-10-24T09:00:00', durationMinutes: 60 });
    expect(await screen.findByTestId('date-sheet-day-count')).toHaveTextContent(/3/);

    await fireEvent.press(screen.getByTestId('date-sheet-remove-time'));
    await fireEvent.press(screen.getByTestId('date-sheet-save'));

    expect(onSelect).toHaveBeenCalledWith({ dueDate: '2026-10-24', dueDatetime: null, durationMinutes: null });
  });

  it('the Duration tab needs a time; with one it sets the duration', async () => {
    const { onSelect } = await open();
    await fireEvent.press(screen.getByTestId('date-sheet-day-2026-10-25'));
    await fireEvent.press(screen.getByTestId('date-sheet-tabs-duration'));
    expect(screen.queryByTestId('date-sheet-duration-30')).toBeNull();

    await fireEvent.press(screen.getByTestId('date-sheet-tabs-time'));
    pickerAnswers(new Date(2026, 9, 25, 14, 0));
    await fireEvent.press(screen.getByTestId('date-sheet-time'));
    await fireEvent.press(screen.getByTestId('date-sheet-tabs-duration'));
    await fireEvent.press(screen.getByTestId('date-sheet-duration-30'));
    await fireEvent.press(screen.getByTestId('date-sheet-save'));

    expect(onSelect).toHaveBeenCalledWith({ dueDate: null, dueDatetime: '2026-10-25T14:00:00', durationMinutes: 30 });
  });
});
