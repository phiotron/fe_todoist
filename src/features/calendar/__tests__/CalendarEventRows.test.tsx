import { screen } from '@testing-library/react-native';
import type { CalendarEventResponse } from '../../../api/calendar';
import { viTranslation as vi } from '../../../i18n';
import { renderWithProviders } from '../../../test/render';
import { CalendarEventRows } from '../CalendarEventRows';

const TIMED: CalendarEventResponse = {
  id: 'e1',
  title: 'Họp nhóm',
  allDay: false,
  startDate: '2026-11-02',
  endDate: '2026-11-02',
  startDatetime: '2026-11-02T09:00:00',
  endDatetime: '2026-11-02T10:30:00',
  location: 'Phòng 3',
};
const ALL_DAY: CalendarEventResponse = {
  id: 'e2',
  title: 'Nghỉ lễ',
  allDay: true,
  startDate: '2026-11-02',
  endDate: '2026-11-02',
  startDatetime: null,
  endDatetime: null,
  location: null,
};

describe('CalendarEventRows', () => {
  it('shows time range and place for a timed event, "all day" for the others, with an optional heading', async () => {
    await renderWithProviders(<CalendarEventRows events={[ALL_DAY, TIMED]} testID="block" showTitle />);

    expect(screen.getByText(vi.calendar.events.title)).toBeTruthy();
    expect(screen.getByText('Họp nhóm')).toBeTruthy();
    expect(screen.getByText('09:00 – 10:30 · Phòng 3')).toBeTruthy();
    expect(screen.getByText(vi.calendar.events.allDay)).toBeTruthy();
    expect(screen.getByTestId('calendar-event-e1')).toBeTruthy();
  });

  it('events are plain information: not pressable', async () => {
    await renderWithProviders(<CalendarEventRows events={[TIMED]} testID="block" />);

    expect(screen.getByTestId('calendar-event-e1').props.onPress).toBeUndefined();
    expect(screen.queryByText(vi.calendar.events.title)).toBeNull();
  });

  it('renders nothing for an empty list', async () => {
    await renderWithProviders(<CalendarEventRows events={[]} testID="block" />);

    expect(screen.queryByTestId('block')).toBeNull();
  });
});
