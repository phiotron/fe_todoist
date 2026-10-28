import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { resetDeviceSettingsForTests, setDeviceSettings } from '../../../lib/device/deviceSettings';
import { setTasklyAndroidForTests, type SystemAccentColors, type TasklyAndroidModule } from '../../../lib/native/tasklyAndroid';
import { tokenStore } from '../../../lib/tokenStore';
import { routeApi } from '../../../test/apiRoutes';
import { jsonResponse, mockFetch, problem } from '../../../test/http';
import { createTestQueryClient, createWrapper } from '../../../test/render';
import { ThemeProvider, useTheme } from '../../../theme';
import { darkPalette, lightPalette } from '../../../theme/palette';
import { paletteFor } from '../../../theme/themes';
import { useCloseTask } from '../useTaskActions';

const TASK = { id: 't-1', content: 'Việc', completedAt: null, version: 1 };

describe('task complete tone (M12)', () => {
  let playCompletionTone: jest.Mock;

  beforeEach(async () => {
    await AsyncStorage.clear();
    resetDeviceSettingsForTests();
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    playCompletionTone = jest.fn();
    setTasklyAndroidForTests({ playCompletionTone } as unknown as TasklyAndroidModule);
    routeApi(mockFetch(), {
      'POST /api/v1/tasks/t-1/close': () =>
        jsonResponse(200, { task: { ...TASK, completedAt: '2026-10-23T03:00:00Z', version: 2 }, cascaded: [] }),
      'POST /api/v1/tasks/t-bad/close': () => problem(500, 'Internal Server Error'),
    });
  });
  afterEach(() => setTasklyAndroidForTests(undefined));

  const close = async (taskId: string) => {
    const { result } = await renderHook(() => useCloseTask(), { wrapper: createWrapper(createTestQueryClient()) });
    await result.current.mutateAsync(taskId).catch(() => undefined);
  };

  it('plays after a task is completed, by default', async () => {
    await close('t-1');

    expect(playCompletionTone).toHaveBeenCalledTimes(1);
  });

  it('is silent when the setting is off', async () => {
    await setDeviceSettings({ completionTone: false });

    await close('t-1');

    expect(playCompletionTone).not.toHaveBeenCalled();
  });

  it('is silent when completing fails', async () => {
    await close('t-bad');

    expect(playCompletionTone).not.toHaveBeenCalled();
  });
});

const COLORS: SystemAccentColors = {
  accentLight: '#9C4146',
  accentLightStrong: '#7D2A30',
  accentLightSoft: '#FFDADA',
  accentDark: '#FFB3B4',
  accentDarkStrong: '#FFDADA',
  accentDarkSoft: '#5E1319',
};

describe('ThemeProvider with Dynamic Color', () => {
  const wrapper =
    (props: { dynamicColors?: SystemAccentColors | null; appearance?: 'LIGHT' | 'DARK' }) =>
    ({ children }: { children: ReactNode }) => (
      <ThemeProvider theme="TASKLY" appearance={props.appearance ?? 'LIGHT'} dynamicColors={props.dynamicColors}>
        {children}
      </ThemeProvider>
    );

  it('takes the accent from the system colours', async () => {
    const { result } = await renderHook(() => useTheme(), { wrapper: wrapper({ dynamicColors: COLORS }) });

    await waitFor(() => expect(result.current.palette.acc).toBe(COLORS.accentLight));
    expect(result.current.colors.primary).toBe(COLORS.accentLight);
    expect(result.current.palette.ink).toBe(lightPalette.ink);
  });

  it('uses the dark accents in dark mode', async () => {
    const { result } = await renderHook(() => useTheme(), { wrapper: wrapper({ dynamicColors: COLORS, appearance: 'DARK' }) });

    expect(result.current.palette.acc).toBe(COLORS.accentDark);
    expect(result.current.palette.ink).toBe(darkPalette.ink);
  });

  it('keeps the named theme colours when Dynamic Color is off', async () => {
    const { result } = await renderHook(() => useTheme(), { wrapper: wrapper({ dynamicColors: null }) });

    expect(result.current.palette).toEqual(paletteFor('TASKLY', 'light'));
  });
});
