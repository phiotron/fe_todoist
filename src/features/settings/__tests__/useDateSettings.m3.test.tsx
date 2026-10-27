import { renderHook } from '@testing-library/react-native';
import { quickDates } from '../../../lib/dates';
import { DEFAULT_DATE_SETTINGS } from '../../../lib/dates/settings';
import { memorySettingsStorage } from '../../../test/memorySettingsStorage';
import { createTestQueryClient, createWrapper } from '../../../test/render';
import { createSettingsWrapper } from '../../../test/renderSettings';
import { storedSettings, testAppSettings } from '../../../test/settingsFixtures';
import { useDateSettings } from '../useDateSettings';

describe('useDateSettings reads the account settings', () => {
  it('without a settings provider: the spec defaults (Monday / next Monday / Saturday)', async () => {
    const { result } = await renderHook(() => useDateSettings(), { wrapper: createWrapper(createTestQueryClient()) });
    expect(result.current).toEqual(DEFAULT_DATE_SETTINGS);
  });

  it('inside the provider: startDay, nextWeek and weekendStartDay of the settings', async () => {
    const storage = memorySettingsStorage(
      storedSettings({ applied: testAppSettings({ startDay: 7, nextWeek: 3, weekendStartDay: 5 }) }),
    );
    const { result } = await renderHook(() => useDateSettings(), {
      wrapper: createSettingsWrapper({ queryClient: createTestQueryClient(), storage, deviceTimeZone: 'Asia/Ho_Chi_Minh' }),
    });

    expect(result.current).toEqual({ startDay: 7, nextWeek: 3, weekendStartDay: 5 });
  });

  it('"This weekend" follows weekendStartDay and is the nearest such day AFTER today (spec 5.2, 18.1 m8)', async () => {
    const storage = memorySettingsStorage(storedSettings({ applied: testAppSettings({ weekendStartDay: 5 }) }));
    const { result } = await renderHook(() => useDateSettings(), {
      wrapper: createSettingsWrapper({ queryClient: createTestQueryClient(), storage, deviceTimeZone: 'Asia/Ho_Chi_Minh' }),
    });

    expect(quickDates('2026-10-22', result.current).thisWeekend).toBe('2026-10-23'); // Thursday → Friday
    expect(quickDates('2026-10-23', result.current).thisWeekend).toBe('2026-10-30'); // Friday itself → next Friday
    expect(quickDates('2026-10-24', DEFAULT_DATE_SETTINGS).thisWeekend).toBe('2026-10-31'); // Saturday, default → next Saturday
  });

  it('keeps the same object while the three values do not change (no useless re-renders)', async () => {
    const storage = memorySettingsStorage(storedSettings());
    const { result, rerender } = await renderHook(() => useDateSettings(), {
      wrapper: createSettingsWrapper({ queryClient: createTestQueryClient(), storage, deviceTimeZone: 'Asia/Ho_Chi_Minh' }),
    });
    const first = result.current;

    await rerender({});

    expect(result.current).toBe(first);
  });
});
