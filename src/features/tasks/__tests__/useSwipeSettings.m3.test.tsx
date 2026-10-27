import { renderHook } from '@testing-library/react-native';
import { memorySettingsStorage } from '../../../test/memorySettingsStorage';
import { createTestQueryClient, createWrapper } from '../../../test/render';
import { createSettingsWrapper } from '../../../test/renderSettings';
import { storedSettings, testAppSettings } from '../../../test/settingsFixtures';
import { useSwipeSettings } from '../swipe';

describe('useSwipeSettings reads the account settings', () => {
  it('without a settings provider: right = Complete, left = Schedule (spec 9.2)', async () => {
    const { result } = await renderHook(() => useSwipeSettings(), { wrapper: createWrapper(createTestQueryClient()) });
    expect(result.current).toEqual({ right: 'COMPLETE', left: 'SCHEDULE' });
  });

  it('inside the provider: swipeRight and swipeLeft of the settings', async () => {
    const storage = memorySettingsStorage(storedSettings({ applied: testAppSettings({ swipeLeft: 'DELETE', swipeRight: 'SELECT' }) }));
    const { result } = await renderHook(() => useSwipeSettings(), {
      wrapper: createSettingsWrapper({ queryClient: createTestQueryClient(), storage, deviceTimeZone: 'Asia/Ho_Chi_Minh' }),
    });

    expect(result.current).toEqual({ right: 'SELECT', left: 'DELETE' });
  });
});
