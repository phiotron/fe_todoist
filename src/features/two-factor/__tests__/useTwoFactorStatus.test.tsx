import { renderHook, waitFor } from '@testing-library/react-native';
import { tokenStore } from '../../../lib/tokenStore';
import { jsonResponse, mockFetch } from '../../../test/http';
import { routeFetch } from '../../../test/m3Routes';
import { createTestQueryClient, createWrapper } from '../../../test/render';
import { useTwoFactorStatus } from '../useTwoFactorStatus';

describe('useTwoFactorStatus', () => {
  it('reads GET me/2fa while signed in', async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    routeFetch(mockFetch(), { 'GET /api/v1/me/2fa': () => jsonResponse(200, { enabled: true, recoveryCodesLeft: 8 }) });

    const { result } = await renderHook(() => useTwoFactorStatus(), { wrapper: createWrapper(createTestQueryClient()) });

    await waitFor(() => expect(result.current.data).toEqual({ enabled: true, recoveryCodesLeft: 8 }));
  });

  it('does nothing while signed out', async () => {
    await tokenStore.clear();
    const fetchMock = mockFetch();
    const { result } = await renderHook(() => useTwoFactorStatus(), { wrapper: createWrapper(createTestQueryClient()) });

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
