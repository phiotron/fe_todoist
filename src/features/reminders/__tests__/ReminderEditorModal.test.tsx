import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import vi from '../../../i18n/locales/vi/reminders.json';
import { renderWithProviders } from '../../../test/render';
import { ReminderEditorModal, type ReminderEditorModalProps } from '../ReminderEditorModal';

const texts = vi.reminders.editor;
/** 10:00 on 23 Oct 2026 in Asia/Ho_Chi_Minh. */
const NOW = Date.parse('2026-10-23T03:00:00Z');

type PickerOptions = Parameters<typeof DateTimePickerAndroid.open>[0];
const pickerCall = (index: number) => jest.mocked(DateTimePickerAndroid.open).mock.calls[index][0] as PickerOptions;
const set = (date: Date) => ({ type: 'set' as const, nativeEvent: { timestamp: date.getTime(), utcOffset: 0 } });

async function setup(overrides: Partial<ReminderEditorModalProps> = {}) {
  const props: ReminderEditorModalProps = {
    visible: true,
    onClose: jest.fn(),
    items: [],
    onAdd: jest.fn(),
    onRemove: jest.fn(),
    hasTime: true,
    timeZone: 'Asia/Ho_Chi_Minh',
    timeFormat: 'H24',
    now: () => NOW,
    ...overrides,
  };
  await renderWithProviders(<ReminderEditorModal {...props} />);
  return props;
}

async function pickDateTime(date: Date, time: Date) {
  await act(async () => {
    pickerCall(0).onChange?.(set(date), date);
  });
  await act(async () => {
    pickerCall(1).onChange?.(set(time), time);
  });
}

describe('ReminderEditorModal', () => {
  beforeEach(() => {
    jest.mocked(DateTimePickerAndroid.open).mockClear();
  });

  it('lists the reminders, or says there are none', async () => {
    await setup();
    expect(screen.getByText(texts.empty)).toBeOnTheScreen();

    await setup({ items: [{ id: 'r-1', label: '24/10/2026 09:00' }] });
    expect(screen.getByText('24/10/2026 09:00')).toBeOnTheScreen();
    expect(screen.queryByText(texts.empty)).toBeNull();
  });

  it('removes a reminder', async () => {
    const props = await setup({ items: [{ id: 'r-1', label: '24/10/2026 09:00' }] });

    await fireEvent.press(screen.getByTestId('reminder-remove-r-1'));

    expect(props.onRemove).toHaveBeenCalledWith('r-1');
  });

  it('adds a reminder at a picked date and time', async () => {
    const props = await setup();

    await fireEvent.press(screen.getByTestId('reminder-add-absolute'));
    await pickDateTime(new Date(2026, 9, 24), new Date(2026, 9, 24, 9, 30));

    await waitFor(() => expect(props.onAdd).toHaveBeenCalledWith({ type: 'ABSOLUTE', at: '2026-10-24T09:30' }));
  });

  it('refuses a time in the past', async () => {
    const props = await setup();

    await fireEvent.press(screen.getByTestId('reminder-add-absolute'));
    await pickDateTime(new Date(2026, 9, 23), new Date(2026, 9, 23, 9, 0));

    expect(await screen.findByText(texts.pastTime)).toBeOnTheScreen();
    expect(props.onAdd).not.toHaveBeenCalled();
  });

  it('adds a reminder before the due time', async () => {
    const props = await setup();

    await fireEvent.press(screen.getByTestId('reminder-add-relative-30'));

    expect(props.onAdd).toHaveBeenCalledWith({ type: 'RELATIVE', minuteOffset: 30 });
  });

  it('explains why there is no "before due" choice for a task without a time', async () => {
    await setup({ hasTime: false });

    expect(screen.queryByTestId('reminder-add-relative-30')).toBeNull();
    expect(screen.getByText(texts.relativeNeedsTime)).toBeOnTheScreen();
  });

  it('only shows the list when read-only', async () => {
    await setup({ readOnly: true, items: [{ id: 'r-1', label: '24/10/2026 09:00' }] });

    expect(screen.getByText('24/10/2026 09:00')).toBeOnTheScreen();
    expect(screen.queryByTestId('reminder-add-absolute')).toBeNull();
    expect(screen.queryByTestId('reminder-remove-r-1')).toBeNull();
  });

  it('shows the last error and closes', async () => {
    const props = await setup({ error: 'Đã đạt giới hạn' });

    expect(screen.getByTestId('reminder-editor-error')).toHaveTextContent('Đã đạt giới hạn');
    await fireEvent.press(screen.getByTestId('reminder-editor-close'));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
