import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { viTranslation as vi } from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { testUser } from '../../../test/fixtures';
import { jsonResponse, mockFetch, problem } from '../../../test/http';
import type { RouteHandler } from '../../../test/m3Routes';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings } from '../../../test/settingsFixtures';
import { meQueryKey } from '../../auth/session';
import { ProfileSection } from '../ProfileSection';

function serveProfile(patch?: RouteHandler) {
  const profileBodies: unknown[] = [];
  serveSettings(mockFetch(), {
    routes: {
      'GET /api/v1/me': () => jsonResponse(200, testUser),
      'PATCH /api/v1/me': (request) => {
        profileBodies.push(request.body);
        return patch ? patch(request) : jsonResponse(200, { ...testUser, ...(request.body as object) });
      },
    },
  });
  return { profileBodies };
}

describe('ProfileSection', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('shows the account email and the current display name', async () => {
    serveProfile();
    await renderWithSettings(<ProfileSection />);

    expect(await screen.findByText(vi.settings.profile.email.replace('{{email}}', testUser.email))).toBeTruthy();
    expect(await screen.findByDisplayValue(testUser.displayName)).toBeTruthy();
  });

  it('checks the name on the device first', async () => {
    const { profileBodies } = serveProfile();
    await renderWithSettings(<ProfileSection />);
    await screen.findByDisplayValue(testUser.displayName);

    await fireEvent.changeText(screen.getByTestId('profile-displayName'), '   ');
    await fireEvent.press(screen.getByTestId('profile-save'));

    expect(screen.getByTestId('profile-displayName-error').props.children).toBe(vi.auth.validation.displayNameRequired);
    expect(profileBodies).toEqual([]);
  });

  it('saves the trimmed name, updates the cached user and confirms', async () => {
    const { profileBodies } = serveProfile();
    const { queryClient } = await renderWithSettings(<ProfileSection />);
    await screen.findByDisplayValue(testUser.displayName);

    await fireEvent.changeText(screen.getByTestId('profile-displayName'), '  Bình  ');
    await fireEvent.press(screen.getByTestId('profile-save'));

    expect((await screen.findByTestId('profile-saved')).props.children).toBe(vi.settings.saved);
    expect(profileBodies).toEqual([{ displayName: 'Bình' }]);
    expect(queryClient.getQueryData(meQueryKey)).toMatchObject({ displayName: 'Bình' });
    expect(screen.getByTestId('profile-displayName').props.value).toBe('Bình');
  });

  it('shows a 400 field error under the input and keeps what was typed', async () => {
    serveProfile(() =>
      problem(400, 'Bad Request', { errors: [{ field: 'displayName', message: 'Tên không hợp lệ' }] }),
    );
    await renderWithSettings(<ProfileSection />);
    await screen.findByDisplayValue(testUser.displayName);

    await fireEvent.changeText(screen.getByTestId('profile-displayName'), 'Tên mới');
    await fireEvent.press(screen.getByTestId('profile-save'));

    expect((await screen.findByTestId('profile-displayName-error')).props.children).toBe('Tên không hợp lệ');
    expect(screen.getByTestId('profile-displayName').props.value).toBe('Tên mới');
  });

  it('shows the shared "server unreachable" sentence and keeps what was typed', async () => {
    serveProfile(() => {
      throw new TypeError('Network request failed');
    });
    await renderWithSettings(<ProfileSection />);
    await screen.findByDisplayValue(testUser.displayName);

    await fireEvent.changeText(screen.getByTestId('profile-displayName'), 'Tên mới');
    await fireEvent.press(screen.getByTestId('profile-save'));

    await waitFor(() => expect(screen.getByTestId('profile-error').props.children).toBe(vi.errors.network));
    expect(screen.getByTestId('profile-displayName').props.value).toBe('Tên mới');
  });
});
