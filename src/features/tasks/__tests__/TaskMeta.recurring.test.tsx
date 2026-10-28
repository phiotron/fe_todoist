import '../../../i18n';
import { screen } from '@testing-library/react-native';
import { makeTask } from '../../../test/m1Fixtures';
import { renderWithProviders } from '../../../test/render';
import { TaskMeta } from '../TaskMeta';

const NOW = new Date('2026-10-23T03:00:00Z');

async function show(overrides: Parameters<typeof makeTask>[0], showCompletedTime = false) {
  const task = makeTask({ id: 't1', ...overrides });
  await renderWithProviders(<TaskMeta task={task} now={NOW} timeZone="Asia/Ho_Chi_Minh" showProject={false} showCompletedTime={showCompletedTime} />);
}

describe('TaskMeta — repeating task (M6c)', () => {
  it('shows the repeat icon next to the due of a repeating task', async () => {
    await show({ dueDate: '2026-10-28', recurrenceRule: 'FREQ=DAILY', isRecurring: true });
    expect(screen.getByTestId('task-recurring-t1')).toBeOnTheScreen();
    expect(screen.getByLabelText('Việc lặp lại')).toBeOnTheScreen();
  });

  it('shows nothing for a plain task', async () => {
    await show({ dueDate: '2026-10-28' });
    expect(screen.queryByTestId('task-recurring-t1')).toBeNull();
  });

  it('keeps the deadline of a repeating task', async () => {
    await show({ dueDate: '2026-10-28', deadlineDate: '2026-11-05', recurrenceRule: 'FREQ=DAILY', isRecurring: true });
    expect(screen.getByTestId('task-recurring-t1')).toBeOnTheScreen();
    expect(screen.getByTestId('task-deadline-t1')).toBeOnTheScreen();
  });

  it('the Completed screen line shows the completion time, not the repeat icon', async () => {
    await show({ completedAt: '2026-10-22T01:00:00Z', recurrenceRule: 'FREQ=DAILY', isRecurring: true }, true);
    expect(screen.queryByTestId('task-recurring-t1')).toBeNull();
  });
});
