import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import vi from '../../../i18n/locales/vi/reminders.json';
import { renderSignedIn } from '../../../test/screen';
import { QuickAddReminderChip } from '../QuickAddReminderChip';
import { useQuickAddReminders } from '../useQuickAddReminders';

function Harness() {
  const reminders = useQuickAddReminders(true);
  return <QuickAddReminderChip reminders={reminders} hasTime timeZone="Asia/Ho_Chi_Minh" />;
}

describe('QuickAddReminderChip', () => {
  it('collects reminders for the task being added', async () => {
    await renderSignedIn(<Harness />);
    expect(await screen.findByText(vi.reminders.chip.label)).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('quick-add-reminder-chip'));
    await fireEvent.press(screen.getByTestId('reminder-add-relative-30'));

    await waitFor(() => expect(screen.getByTestId('quick-add-reminder-chip')).toHaveTextContent(/30 phút trước/));
  });
});
