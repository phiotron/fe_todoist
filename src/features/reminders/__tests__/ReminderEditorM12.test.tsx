import { fireEvent, screen } from '@testing-library/react-native';
import { renderWithProviders } from '../../../test/render';
import { ReminderEditorModal } from '../ReminderEditorModal';

const PLACES = [
  { id: 'l-1', name: 'Nhà' },
  { id: 'l-2', name: 'Văn phòng' },
];

async function open(extra: Partial<Parameters<typeof ReminderEditorModal>[0]> = {}) {
  const onAdd = jest.fn();
  await renderWithProviders(
    <ReminderEditorModal
      visible
      onClose={jest.fn()}
      items={[]}
      onAdd={onAdd}
      onRemove={jest.fn()}
      hasTime
      timeZone="Asia/Ho_Chi_Minh"
      timeFormat="H24"
      {...extra}
    />,
  );
  return { onAdd };
}

describe('ReminderEditorModal — M12', () => {
  it('a relative reminder is a normal one until the urgent switch is on', async () => {
    const { onAdd } = await open();

    await fireEvent.press(screen.getByTestId('reminder-add-relative-30'));
    await fireEvent.press(screen.getByTestId('reminder-urgent-switch'));
    await fireEvent.press(screen.getByTestId('reminder-add-relative-10'));

    expect(onAdd).toHaveBeenNthCalledWith(1, { type: 'RELATIVE', minuteOffset: 30 });
    expect(onAdd).toHaveBeenNthCalledWith(2, { type: 'RELATIVE', minuteOffset: 10, urgent: true });
  });

  it('explains that urgent reminders only ring on the chosen device', async () => {
    await open();

    expect(screen.getByText('Chỉ có tác dụng trên thiết bị đã chọn trong Cài đặt › Nhắc nhở.')).toBeOnTheScreen();
  });

  it('offers arriving / leaving for every saved place and adds a location draft', async () => {
    const { onAdd } = await open({ places: PLACES });

    expect(screen.getByText('Khi tới Nhà')).toBeOnTheScreen();
    expect(screen.getByText('Khi rời Văn phòng')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('reminder-add-location-l-2-ON_LEAVE'));

    expect(onAdd).toHaveBeenCalledWith({ type: 'LOCATION', locationId: 'l-2', trigger: 'ON_LEAVE', locationName: 'Văn phòng' });
  });

  it('location reminders need no due time: the chips stay available while relative ones ask for a time', async () => {
    await open({ places: PLACES, hasTime: false });

    expect(screen.getByTestId('reminder-relative-needs-time')).toBeOnTheScreen();
    expect(screen.getByTestId('reminder-add-location-l-1-ON_ENTER')).toBeOnTheScreen();
  });

  it('with no saved place it points to Settings › Reminders › Places', async () => {
    await open({ places: [] });

    expect(screen.getByTestId('reminder-location-none')).toBeOnTheScreen();
    expect(screen.queryByTestId('reminder-add-location-l-1-ON_ENTER')).toBeNull();
  });

  it('the places section is hidden when the caller gives none', async () => {
    await open();

    expect(screen.queryByText('Khi tới hoặc rời một địa điểm')).toBeNull();
  });

  it('read-only (completed task): no urgent switch, no location chips', async () => {
    await open({ readOnly: true, places: PLACES });

    expect(screen.queryByTestId('reminder-urgent-switch')).toBeNull();
    expect(screen.queryByTestId('reminder-add-location-l-1-ON_ENTER')).toBeNull();
  });
});
