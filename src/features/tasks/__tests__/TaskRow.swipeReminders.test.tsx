import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { makeTask } from '../../../test/m1Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { TaskRow } from '../TaskRow';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('../swipe', () => ({
  ...jest.requireActual('../swipe'),
  useSwipeSettings: () => ({ right: 'REMINDERS', left: 'NONE' }),
}));

describe('TaskRow swipe "Reminders" (spec 9.2)', () => {
  it('opens the task screen with the reminder editor shown, without changing the task', async () => {
    const { fetchMock } = await renderSignedIn(
      <TaskRow task={makeTask({ id: 't1' })} now={new Date('2026-10-23T03:00:00Z')} timeZone="Asia/Ho_Chi_Minh" onToggle={jest.fn()} />,
    );

    // The panel that opens when the row moves right is the "left" one (swipeSide in swipe.ts).
    await fireEvent(screen.getByTestId('task-swipe-t1'), 'swipeableOpen', 'left');

    expect(router.push).toHaveBeenCalledWith({ pathname: '/task/[id]', params: { id: 't1', reminders: '1' } });
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method && init.method !== 'GET')).toHaveLength(0);
  });
});
