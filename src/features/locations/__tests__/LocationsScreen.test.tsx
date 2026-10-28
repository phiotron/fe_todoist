import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { LocationResponse } from '../../../api/locations';
import { jsonResponse, problem } from '../../../test/http';
import { renderSignedIn } from '../../../test/screen';
import { LocationsScreen } from '../LocationsScreen';
import { setGeofencePlatform, type GeofencePlatform } from '../geofencePlatform';

const HOME: LocationResponse = {
  id: 'l-1',
  name: 'Nhà',
  latitude: 10.7769,
  longitude: 106.7009,
  radius: 150,
  createdAt: '2026-10-23T03:00:00Z',
};

function fakePlatform(position: { latitude: number; longitude: number } | null, permission: 'granted' | 'denied' = 'granted') {
  return {
    getPermission: jest.fn(async () => permission),
    requestPermission: jest.fn(async () => permission),
    apply: jest.fn(async () => undefined),
    stop: jest.fn(async () => undefined),
    getCurrentPosition: jest.fn(async () => position),
  } satisfies GeofencePlatform;
}

describe('LocationsScreen (Settings › Reminders › Places)', () => {
  afterEach(() => setGeofencePlatform(null));

  it('lists the saved places with their radius, or says there are none', async () => {
    await renderSignedIn(<LocationsScreen />, { 'GET /api/v1/locations': () => jsonResponse(200, [HOME]) });

    await waitFor(() => expect(screen.getByText('Nhà · 150 m')).toBeOnTheScreen());
    expect(screen.queryByTestId('places-empty')).toBeNull();
  });

  it('empty list', async () => {
    await renderSignedIn(<LocationsScreen />, { 'GET /api/v1/locations': () => jsonResponse(200, []) });

    await waitFor(() => expect(screen.getByTestId('places-empty')).toBeOnTheScreen());
  });

  it('adds a place from typed coordinates (comma decimals), then shows it', async () => {
    let places: LocationResponse[] = [];
    const { fetchMock } = await renderSignedIn(<LocationsScreen />, {
      'GET /api/v1/locations': () => jsonResponse(200, places),
      'POST /api/v1/locations': (request) => {
        places = [{ ...HOME, ...(request.body as object) } as LocationResponse];
        return jsonResponse(201, places[0]);
      },
    });
    await waitFor(() => expect(screen.getByTestId('place-add')).toBeOnTheScreen());

    await fireEvent.press(screen.getByTestId('place-add'));
    await fireEvent.changeText(screen.getByTestId('place-name'), '  Văn phòng ');
    await fireEvent.changeText(screen.getByTestId('place-latitude'), '10,7769');
    await fireEvent.changeText(screen.getByTestId('place-longitude'), '106.7009');
    await fireEvent.press(screen.getByTestId('place-save'));

    await waitFor(() => expect(screen.getByText('Văn phòng · 200 m')).toBeOnTheScreen());
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(post?.[1]?.body as string)).toEqual({ name: 'Văn phòng', latitude: 10.7769, longitude: 106.7009, radius: 200 });
    expect(screen.queryByTestId('place-form')).toBeNull();
  });

  it('shows form errors and sends nothing while the form is wrong', async () => {
    const { fetchMock } = await renderSignedIn(<LocationsScreen />, { 'GET /api/v1/locations': () => jsonResponse(200, []) });
    await waitFor(() => expect(screen.getByTestId('place-add')).toBeOnTheScreen());

    await fireEvent.press(screen.getByTestId('place-add'));
    await fireEvent.changeText(screen.getByTestId('place-latitude'), '95');
    await fireEvent.changeText(screen.getByTestId('place-radius'), '50');
    await fireEvent.press(screen.getByTestId('place-save'));

    expect(screen.getByText('Hãy nhập tên')).toBeOnTheScreen();
    expect(screen.getByText('Vĩ độ phải từ -90 đến 90')).toBeOnTheScreen();
    expect(screen.getByText('Bán kính phải từ 100 đến 5000 mét')).toBeOnTheScreen();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('"use my current location" fills the coordinates', async () => {
    setGeofencePlatform(fakePlatform({ latitude: 21.0285, longitude: 105.8542 }));
    await renderSignedIn(<LocationsScreen />, { 'GET /api/v1/locations': () => jsonResponse(200, []) });
    await waitFor(() => expect(screen.getByTestId('place-add')).toBeOnTheScreen());

    await fireEvent.press(screen.getByTestId('place-add'));
    await fireEvent.press(screen.getByTestId('place-use-current'));

    await waitFor(() => expect(screen.getByTestId('place-latitude').props.value).toBe('21.0285'));
    expect(screen.getByTestId('place-longitude').props.value).toBe('105.8542');
  });

  it('explains when the location is not allowed', async () => {
    setGeofencePlatform(fakePlatform(null, 'denied'));
    await renderSignedIn(<LocationsScreen />, { 'GET /api/v1/locations': () => jsonResponse(200, []) });
    await waitFor(() => expect(screen.getByTestId('place-add')).toBeOnTheScreen());

    await fireEvent.press(screen.getByTestId('place-add'));
    await fireEvent.press(screen.getByTestId('place-use-current'));

    await waitFor(() => expect(screen.getByTestId('place-location-denied')).toBeOnTheScreen());
    expect(screen.getByTestId('place-open-settings')).toBeOnTheScreen();
  });

  it('asks before removing, then deletes the place (and says its reminders go too)', async () => {
    let places = [HOME];
    const { fetchMock } = await renderSignedIn(<LocationsScreen />, {
      'GET /api/v1/locations': () => jsonResponse(200, places),
      'DELETE /api/v1/locations/l-1': () => {
        places = [];
        return jsonResponse(204);
      },
    });
    await waitFor(() => expect(screen.getByTestId('place-remove-l-1')).toBeOnTheScreen());

    await fireEvent.press(screen.getByTestId('place-remove-l-1'));
    expect(screen.getByText('Các nhắc nhở dùng “Nhà” cũng bị xoá.')).toBeOnTheScreen();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
    await fireEvent.press(screen.getByTestId('place-remove-dialog-confirm'));

    await waitFor(() => expect(screen.getByTestId('places-empty')).toBeOnTheScreen());
  });

  it('cancelling the confirmation deletes nothing', async () => {
    const { fetchMock } = await renderSignedIn(<LocationsScreen />, { 'GET /api/v1/locations': () => jsonResponse(200, [HOME]) });
    await waitFor(() => expect(screen.getByTestId('place-remove-l-1')).toBeOnTheScreen());

    await fireEvent.press(screen.getByTestId('place-remove-l-1'));
    await fireEvent.press(screen.getByTestId('place-remove-dialog-cancel'));

    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
    expect(screen.getByText('Nhà · 150 m')).toBeOnTheScreen();
  });

  it('shows the server error when saving fails (limit reached)', async () => {
    const { setRoutes } = await renderSignedIn(<LocationsScreen />, { 'GET /api/v1/locations': () => jsonResponse(200, []) });
    setRoutes({
      'GET /api/v1/locations': () => jsonResponse(200, []),
      'POST /api/v1/locations': () => problem(422, 'Unprocessable', { code: 'limit-reached', limit: 'LOCATIONS', max: 100 }),
    });
    await waitFor(() => expect(screen.getByTestId('place-add')).toBeOnTheScreen());

    await fireEvent.press(screen.getByTestId('place-add'));
    await fireEvent.changeText(screen.getByTestId('place-name'), 'Nhà');
    await fireEvent.changeText(screen.getByTestId('place-latitude'), '10');
    await fireEvent.changeText(screen.getByTestId('place-longitude'), '106');
    await fireEvent.press(screen.getByTestId('place-save'));

    await waitFor(() => expect(screen.getByTestId('place-error')).toBeOnTheScreen());
    expect(screen.getByTestId('place-form')).toBeOnTheScreen();
  });
});
