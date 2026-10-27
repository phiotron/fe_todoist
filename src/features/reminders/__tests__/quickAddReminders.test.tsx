import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { requestsTo } from '../../../test/apiRoutes';
import { jsonResponse } from '../../../test/http';
import { inboxProject, makeTask } from '../../../test/m1Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { QuickAddSheet } from '../../quickAdd/QuickAddSheet';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('../../../lib/useNow', () => ({ useNow: () => new Date('2026-10-23T03:00:00Z') }));
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));

type PickerOptions = Parameters<typeof DateTimePickerAndroid.open>[0];
const pickerCall = (index: number) => jest.mocked(DateTimePickerAndroid.open).mock.calls[index][0] as PickerOptions;
const set = (date: Date) => ({ type: 'set' as const, nativeEvent: { timestamp: date.getTime(), utcOffset: 0 } });
const REMINDERS_PATH = '/api/v1/tasks/t-9/reminders';

describe('Quick Add reminders', () => {
  it('creates the reminders of a task added from Quick Add', async () => {
    jest.mocked(DateTimePickerAndroid.open).mockClear();
    const { fetchMock } = await renderSignedIn(<QuickAddSheet params={{}} />, {
      'GET /api/v1/projects': () => jsonResponse(200, [inboxProject]),
      'GET /api/v1/projects/p-inbox/sections': () => jsonResponse(200, []),
      'POST /api/v1/tasks': () => jsonResponse(201, makeTask({ id: 't-9', content: 'Gọi khách' })),
      [`POST ${REMINDERS_PATH}`]: (request) =>
        jsonResponse(201, { id: 'r-1', taskId: 't-9', at: null, minuteOffset: null, createdAt: '2026-10-23T03:00:00Z', ...(request.body as object) }),
    });
    await screen.findByText('Inbox'); // the project chip resolves the Inbox name

    await fireEvent.changeText(screen.getByTestId('quick-add-name'), 'Gọi khách');
    await fireEvent.press(screen.getByTestId('quick-add-reminder-chip'));
    await fireEvent.press(screen.getByTestId('reminder-add-absolute'));
    await act(async () => {
      pickerCall(0).onChange?.(set(new Date(2040, 0, 15)), new Date(2040, 0, 15));
    });
    await act(async () => {
      pickerCall(1).onChange?.(set(new Date(2040, 0, 15, 9, 0)), new Date(2040, 0, 15, 9, 0));
    });
    await fireEvent.press(screen.getByTestId('reminder-editor-close'));
    await fireEvent.press(screen.getByTestId('quick-add-submit'));

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', REMINDERS_PATH)).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', REMINDERS_PATH)[0].body).toEqual({ type: 'ABSOLUTE', at: '2040-01-15T09:00' });
  });
});
