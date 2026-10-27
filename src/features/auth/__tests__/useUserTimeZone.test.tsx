import { renderHook, waitFor } from '@testing-library/react-native';
import { DEFAULT_DATE_SETTINGS } from '../../../lib/dates/settings';
import { tokenStore } from '../../../lib/tokenStore';
import { testUser } from '../../../test/fixtures';
import { jsonResponse, mockFetch } from '../../../test/http';
import { createTestQueryClient, createWrapper } from '../../../test/render';
import { useDateSettings } from '../../settings/useDateSettings';
import { deviceTimeZone, useUserTimeZone } from '../useUserTimeZone';

describe('useUserTimeZone', () => {
  it('uses the account time zone from GET /me', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    mockFetch().mockResolvedValue(jsonResponse(200, { ...testUser, timeZone: 'Europe/Paris' }));
    const { result } = await renderHook(() => useUserTimeZone(), {
      wrapper: createWrapper(createTestQueryClient()),
    });

    await waitFor(() => expect(result.current).toBe('Europe/Paris'));
  });

  it('falls back to the device zone while the account is unknown', async () => {
    await tokenStore.clear();
    const { result } = await renderHook(() => useUserTimeZone(), {
      wrapper: createWrapper(createTestQueryClient()),
    });
    expect(result.current).toBe(deviceTimeZone());
  });
});

describe('useDateSettings', () => {
  it('returns the spec defaults in M1 (Monday / next Monday / Saturday)', async () => {
    const { result } = await renderHook(() => useDateSettings());
    expect(result.current).toEqual(DEFAULT_DATE_SETTINGS);
  });
});
