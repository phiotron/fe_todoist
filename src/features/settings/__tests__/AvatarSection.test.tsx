import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import vi from '../../../i18n/locales/vi/avatar.json';
import { setFilePickerPlatform } from '../../../lib/filePicker';
import { requestsTo } from '../../../test/apiRoutes';
import { testUser } from '../../../test/fixtures';
import { jsonResponse, problem } from '../../../test/http';
import { installFakeFilePicker } from '../../../test/m8bFixtures';
import { renderSignedIn } from '../../../test/screen';
import { AvatarSection } from '../AvatarSection';

const WITH_AVATAR = { ...testUser, avatarUrl: '/api/v1/users/00000000-0000-0000-0000-000000000001/avatar?v=1' };
const PNG = { uri: 'file:///cache/me.png', name: 'me.png', mimeType: 'image/png', size: 1024 };

afterEach(() => setFilePickerPlatform(null));

describe('AvatarSection', () => {
  it('offers only "change" while there is no picture', async () => {
    await renderSignedIn(<AvatarSection />);

    expect(await screen.findByTestId('avatar-change')).toBeOnTheScreen();
    expect(screen.queryByTestId('avatar-remove')).toBeNull();
  });

  it('offers "remove" as well once there is a picture', async () => {
    await renderSignedIn(<AvatarSection />, { 'GET /api/v1/me': () => jsonResponse(200, WITH_AVATAR) });

    expect(await screen.findByTestId('avatar-remove')).toBeOnTheScreen();
    expect(screen.getByTestId('avatar-change')).toBeOnTheScreen();
  });

  it('picks a JPEG / PNG, uploads it as multipart and caches the answered user', async () => {
    const picker = installFakeFilePicker(PNG);
    const { fetchMock } = await renderSignedIn(<AvatarSection />, {
      'POST /api/v1/me/avatar': () => jsonResponse(200, WITH_AVATAR),
    });
    await screen.findByTestId('avatar-change');

    await fireEvent.press(screen.getByTestId('avatar-change'));

    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/v1/me/avatar')).toHaveLength(1));
    expect(picker.calls).toEqual([{ types: ['image/jpeg', 'image/png'] }]);
    const upload = fetchMock.mock.calls.find(([input]) => String(input).endsWith('/api/v1/me/avatar'));
    expect(upload?.[1]?.body).toBeInstanceOf(FormData);
    expect(await screen.findByTestId('avatar-remove')).toBeOnTheScreen();
  });

  it('does nothing when the picker is closed', async () => {
    installFakeFilePicker(null);
    const { fetchMock } = await renderSignedIn(<AvatarSection />);
    await screen.findByTestId('avatar-change');

    await fireEvent.press(screen.getByTestId('avatar-change'));

    expect(requestsTo(fetchMock, 'POST', '/api/v1/me/avatar')).toHaveLength(0);
    expect(screen.queryByTestId('avatar-error')).toBeNull();
  });

  it('refuses a picture over 4 MB or of another type without calling the server', async () => {
    installFakeFilePicker({ ...PNG, size: 4 * 1024 * 1024 + 1 });
    const { fetchMock } = await renderSignedIn(<AvatarSection />);
    await screen.findByTestId('avatar-change');
    await fireEvent.press(screen.getByTestId('avatar-change'));
    expect(await screen.findByTestId('avatar-error')).toHaveTextContent(vi.avatar.tooLarge);

    installFakeFilePicker({ ...PNG, mimeType: 'image/gif' });
    await fireEvent.press(screen.getByTestId('avatar-change'));
    await waitFor(() => expect(screen.getByTestId('avatar-error')).toHaveTextContent(vi.avatar.wrongType));

    expect(requestsTo(fetchMock, 'POST', '/api/v1/me/avatar')).toHaveLength(0);
  });

  it('shows the server message when the upload is refused', async () => {
    installFakeFilePicker(PNG);
    await renderSignedIn(<AvatarSection />, {
      'POST /api/v1/me/avatar': () => problem(400, 'Bad Request', { detail: 'Ảnh đại diện vượt quá 4 MB' }),
    });
    await screen.findByTestId('avatar-change');

    await fireEvent.press(screen.getByTestId('avatar-change'));

    expect(await screen.findByTestId('avatar-error')).toBeOnTheScreen();
  });

  it('removes the picture with DELETE', async () => {
    const { fetchMock } = await renderSignedIn(<AvatarSection />, {
      'GET /api/v1/me': () => jsonResponse(200, WITH_AVATAR),
      'DELETE /api/v1/me/avatar': () => jsonResponse(200, testUser),
    });
    await fireEvent.press(await screen.findByTestId('avatar-remove'));

    await waitFor(() => expect(requestsTo(fetchMock, 'DELETE', '/api/v1/me/avatar')).toHaveLength(1));
    await waitFor(() => expect(screen.queryByTestId('avatar-remove')).toBeNull());
  });
});
