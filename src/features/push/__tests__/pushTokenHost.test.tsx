import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { tokenStore } from '../../../lib/tokenStore';
import { requestsTo, routeApi } from '../../../test/apiRoutes';
import { testUser } from '../../../test/fixtures';
import { jsonResponse, mockFetch } from '../../../test/http';
import { createTestQueryClient, createWrapper } from '../../../test/render';
import { renderSignedIn } from '../../../test/screen';
import { useSession } from '../../auth/session';
import { PushTokenHost } from '../PushTokenHost';
import { createAppPushRegistrar, readDevicePushToken, setPushRegistrar } from '../registerPushToken';

const ROUTES = {
  'GET /api/v1/me': () => jsonResponse(200, testUser),
  'POST /api/v1/me/push-tokens': () => jsonResponse(204),
  'POST /api/v1/me/push-tokens/unregister': () => jsonResponse(204),
  'POST /api/v1/auth/logout': () => jsonResponse(204),
};

function installFakeDevice(granted = true) {
  setPushRegistrar(
    createAppPushRegistrar({
      isPermissionGranted: async () => granted,
      getDeviceToken: async () => 'fcm-device-1',
      log: () => undefined,
    }),
  );
}

describe('PushTokenHost (M13c F6)', () => {
  afterEach(() => setPushRegistrar(null));

  it('registers the device token once the user is signed in and the permission is granted', async () => {
    installFakeDevice();
    const { fetchMock } = await renderSignedIn(<PushTokenHost />, ROUTES);

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/me/push-tokens')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/me/push-tokens')[0].body).toEqual({
      token: 'fcm-device-1',
      platform: 'ANDROID',
    });
  });

  it('registers nothing without the notification permission', async () => {
    installFakeDevice(false);
    const { fetchMock } = await renderSignedIn(<PushTokenHost />, ROUTES);

    await waitFor(() => expect(requestsTo(fetchMock, 'GET', '/api/v1/me')).not.toHaveLength(0));
    await act(async () => undefined);
    expect(requestsTo(fetchMock, 'POST', '/api/v1/me/push-tokens')).toHaveLength(0);
  });

  it('sign-out unregisters the token before the session is revoked', async () => {
    installFakeDevice();
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    const fetchMock = mockFetch();
    routeApi(fetchMock, ROUTES);
    const { result } = await renderHook(
      () => {
        const session = useSession();
        return session;
      },
      { wrapper: ({ children }) => createWrapper(createTestQueryClient())({ children: <>{children}<PushTokenHost /></> }) },
    );
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/me/push-tokens')).toHaveLength(1));

    await act(async () => {
      await result.current.signOut();
    });

    const paths = fetchMock.mock.calls.map(([input]) => new URL(String(input)).pathname);
    const unregisterAt = paths.indexOf('/api/v1/me/push-tokens/unregister');
    expect(unregisterAt).toBeGreaterThan(-1);
    expect(unregisterAt).toBeLessThan(paths.indexOf('/api/v1/auth/logout'));
    expect(requestsTo(fetchMock, 'POST', '/api/v1/me/push-tokens/unregister')[0].body).toEqual({ token: 'fcm-device-1' });
    expect(requestsTo(fetchMock, 'POST', '/api/v1/me/push-tokens/unregister')[0].headers.Authorization).toBe('Bearer acc-1');
    expect(result.current.status).toBe('signedOut');
  });

  it('sign-out still works when the unregister request fails', async () => {
    installFakeDevice();
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
    const fetchMock = mockFetch();
    routeApi(fetchMock, {
      ...ROUTES,
      'POST /api/v1/me/push-tokens/unregister': () => {
        throw new TypeError('Network request failed');
      },
    });
    const { result } = await renderHook(() => useSession(), {
      wrapper: ({ children }) => createWrapper(createTestQueryClient())({ children: <>{children}<PushTokenHost /></> }),
    });
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/me/push-tokens')).toHaveLength(1));

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.status).toBe('signedOut');
    expect(result.current.expired).toBe(false);
  });
});

describe('readDevicePushToken', () => {
  it('returns the FCM token on Android', async () => {
    jest.mocked(Notifications.getDevicePushTokenAsync).mockResolvedValueOnce({ type: 'android', data: 'fcm-xyz' });
    await expect(readDevicePushToken('android')).resolves.toBe('fcm-xyz');
  });

  it('null on other platforms, without asking the OS', async () => {
    await expect(readDevicePushToken('ios')).resolves.toBeNull();
    expect(Notifications.getDevicePushTokenAsync).not.toHaveBeenCalled();
  });

  it('passes the error on when Firebase is not configured', async () => {
    jest.mocked(Notifications.getDevicePushTokenAsync).mockRejectedValueOnce(new Error('FirebaseApp not initialized'));
    await expect(readDevicePushToken('android')).rejects.toThrow('FirebaseApp');
  });
});
