import { waitFor } from '@testing-library/react-native';
import type { LocationReminderResponse } from '../../../api/locations';
import { tokenStore } from '../../../lib/tokenStore';
import { routeApi } from '../../../test/apiRoutes';
import { testUser } from '../../../test/fixtures';
import { jsonResponse, mockFetch } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import { useLocationReminderSync } from '../LocationReminderRuntime';
import type { GeofencePlan } from '../geofencePlan';
import type { GeofencePermission, GeofencePlatform } from '../geofencePlatform';

const ITEM: LocationReminderResponse = {
  reminderId: 'r-1',
  taskId: 't-1',
  content: 'Mua sữa',
  locationId: 'l-1',
  name: 'Siêu thị',
  latitude: 10.5,
  longitude: 106.5,
  radius: 200,
  trigger: 'ON_ENTER',
};

function makePlatform(initial: GeofencePermission, afterAsk: GeofencePermission = initial) {
  let permission = initial;
  const applied: GeofencePlan[] = [];
  const platform: GeofencePlatform = {
    getPermission: jest.fn(async () => permission),
    requestPermission: jest.fn(async () => {
      permission = afterAsk;
      return permission;
    }),
    apply: jest.fn(async (plan: GeofencePlan) => {
      applied.push(plan);
    }),
    stop: jest.fn(async () => undefined),
    getCurrentPosition: jest.fn(async () => null),
  };
  return { platform, applied };
}

function Probe({ enabled, platform }: { enabled: boolean; platform: GeofencePlatform }) {
  useLocationReminderSync(enabled, { platform });
  return null;
}

async function mount(enabled: boolean, platform: GeofencePlatform, items: LocationReminderResponse[] = [ITEM]) {
  await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  const fetchMock = mockFetch();
  routeApi(fetchMock, {
    'GET /api/v1/me': () => jsonResponse(200, testUser),
    'GET /api/v1/tasks/location-reminders': () => jsonResponse(200, items),
  });
  const rendered = await renderWithProviders(<Probe enabled={enabled} platform={platform} />);
  return { fetchMock, ...rendered };
}

describe('useLocationReminderSync', () => {
  it('registers one region per location reminder once signed in', async () => {
    const { platform, applied } = makePlatform('granted');

    await mount(true, platform);

    await waitFor(() => expect(applied).toHaveLength(1));
    expect(applied[0].regions).toEqual([
      { identifier: 'r-1', latitude: 10.5, longitude: 106.5, radius: 200, notifyOnEnter: true, notifyOnExit: false },
    ]);
    expect(platform.requestPermission).not.toHaveBeenCalled();
  });

  it('asks for the location permission once, and registers nothing when it is refused', async () => {
    const { platform, applied } = makePlatform('denied');

    await mount(true, platform);

    await waitFor(() => expect(platform.requestPermission).toHaveBeenCalledTimes(1));
    expect(applied).toHaveLength(0);
  });

  it('registers after the user grants the permission when asked', async () => {
    const { platform, applied } = makePlatform('denied', 'foregroundOnly');

    await mount(true, platform);

    await waitFor(() => expect(applied).toHaveLength(1));
  });

  it('does not ask for permission when there is nothing to watch', async () => {
    const { platform, applied } = makePlatform('denied');

    await mount(true, platform, []);

    await waitFor(() => expect(applied).toHaveLength(1));
    expect(applied[0].regions).toEqual([]);
    expect(platform.requestPermission).not.toHaveBeenCalled();
  });

  it('with reminders off it stops watching and does not even fetch', async () => {
    const { platform, applied } = makePlatform('granted');

    const { fetchMock } = await mount(false, platform);

    await waitFor(() => expect(platform.stop).toHaveBeenCalled());
    expect(applied).toHaveLength(0);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('location-reminders'))).toBe(false);
  });
});
