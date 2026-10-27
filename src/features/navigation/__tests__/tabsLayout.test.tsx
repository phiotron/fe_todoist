import '../../../i18n';
import { act, render, screen } from '@testing-library/react-native';
import TabsLayout from '../../../app/(app)/(tabs)/_layout';
import { TaskSelectionProvider, useTaskSelection } from '../../tasks/selection';

const mockTabsRender = jest.fn();

jest.mock('expo-router', () => {
  const Tabs = () => {
    mockTabsRender();
    return null;
  };
  Tabs.Screen = () => null;
  return { Tabs, usePathname: () => '/today' };
});
jest.mock('../../auth/useUserTimeZone', () => ({
  useUserTimeZone: () => 'Asia/Ho_Chi_Minh',
  deviceTimeZone: () => 'Asia/Ho_Chi_Minh',
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

describe('TabsLayout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockTabsRender.mockClear();
  });
  afterEach(() => jest.useRealTimers());

  it('draws the + button, and the minute clock behind it does not re-render the navigator', async () => {
    await render(<TabsLayout />);
    expect(screen.getByTestId('tab-fab')).toBeOnTheScreen();
    const rendersAtStart = mockTabsRender.mock.calls.length;

    await act(async () => {
      await jest.advanceTimersByTimeAsync(180_000);
    });

    expect(mockTabsRender.mock.calls.length).toBe(rendersAtStart);
  });

  it('hides the + button while a screen is in multi-select mode (it would cover the action bar) and brings it back after', async () => {
    let selection: ReturnType<typeof useTaskSelection> = null;
    function Probe() {
      selection = useTaskSelection();
      return null;
    }
    await render(
      <>
        {/* a screen's provider is NOT an ancestor of the layout's + button: they only meet through the shared flag */}
        <TaskSelectionProvider>
          <Probe />
        </TaskSelectionProvider>
        <TabsLayout />
      </>,
    );
    expect(screen.getByTestId('tab-fab')).toBeOnTheScreen();
    await act(async () => selection?.start('t1'));
    expect(screen.queryByTestId('tab-fab')).toBeNull();
    await act(async () => selection?.clear());
    expect(screen.getByTestId('tab-fab')).toBeOnTheScreen();
  });
});
