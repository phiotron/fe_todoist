import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { MeResponse } from '../../../api/auth';
import { viTranslation as vi } from '../../../i18n';
import { setGoogleSignInPlatform } from '../../../lib/googleSignIn';
import { tokenStore } from '../../../lib/tokenStore';
import { FakeGoogleSignInPlatform } from '../../../test/fakeGoogleSignInPlatform';
import { testMe, testUser } from '../../../test/fixtures';
import { jsonResponse, mockFetch, problem, requestAt, type FetchMock } from '../../../test/http';
import { routeFetch } from '../../../test/m3Routes';
import { renderWithProviders } from '../../../test/render';
import { GoogleLinkSection } from '../GoogleLinkSection';
import { googleLinkState } from '../googleLinkState';

const IDENTITY_PATH = '/api/v1/me/identities/google';

/** Serves GET me from a variable the identities handlers can change, like the real server would. */
function serve(
  initialMe: MeResponse,
  identities: {
    post?: (setMe: (next: MeResponse) => void) => Response;
    delete?: (setMe: (next: MeResponse) => void) => Response;
  },
) {
  let me = initialMe;
  const setMe = (next: MeResponse) => {
    me = next;
  };
  const fetchMock = mockFetch();
  routeFetch(fetchMock, {
    'GET /api/v1/me': () => jsonResponse(200, me),
    [`POST ${IDENTITY_PATH}`]: () => (identities.post ? identities.post(setMe) : notCalled()),
    [`DELETE ${IDENTITY_PATH}`]: () => (identities.delete ? identities.delete(setMe) : notCalled()),
  });
  return fetchMock;
}

function identityRequests(fetchMock: FetchMock): number[] {
  return fetchMock.mock.calls.flatMap(([input], index) => (String(input).endsWith(IDENTITY_PATH) ? [index] : []));
}

function notCalled(): never {
  throw new Error('identities endpoint must not be called');
}

describe('googleLinkState', () => {
  it('reads the M5 fields', () => {
    expect(googleLinkState(testMe({ linkedProviders: ['GOOGLE'], hasPassword: false }))).toEqual({
      linked: true,
      hasPassword: false,
    });
    expect(googleLinkState(testMe())).toEqual({ linked: false, hasPassword: true });
  });

  it('treats missing fields as "not linked" and "has a password" (the server has the last word)', () => {
    expect(googleLinkState(testUser)).toEqual({ linked: false, hasPassword: true });
  });
});

describe('GoogleLinkSection', () => {
  let google: FakeGoogleSignInPlatform;

  beforeEach(async () => {
    google = new FakeGoogleSignInPlatform();
    setGoogleSignInPlatform(google);
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  afterEach(() => setGoogleSignInPlatform(null));

  it('links Google with a fresh ID token and then shows the account as linked', async () => {
    google.queue({ type: 'success', idToken: 'gid-1', email: 'an@example.com' });
    const fetchMock = serve(testMe(), {
      post: (setMe) => {
        setMe(testMe({ linkedProviders: ['GOOGLE'] }));
        return jsonResponse(204);
      },
    });
    await renderWithProviders(<GoogleLinkSection />);
    expect(await screen.findByText(vi.google.settings.notLinked)).toBeTruthy();
    expect(screen.getByTestId('settings-section-google')).toBeTruthy();
    // The section title and the button read the same in Vietnamese ("Liên kết Google").
    expect(screen.getAllByText(vi.google.settings.title)).toHaveLength(2);

    await fireEvent.press(screen.getByTestId('settings-google-link'));

    expect(await screen.findByText(vi.google.settings.linked)).toBeTruthy();
    expect(screen.getByTestId('settings-google-message').props.children).toBe(vi.google.settings.linkSuccess);
    const [post] = identityRequests(fetchMock);
    expect(requestAt(fetchMock, post).body).toEqual({ idToken: 'gid-1' });
    expect(requestAt(fetchMock, post).headers.Authorization).toBe('Bearer acc-1');
  });

  it('does nothing when the user cancels Google', async () => {
    google.queue({ type: 'cancelled' });
    const fetchMock = serve(testMe(), {});
    await renderWithProviders(<GoogleLinkSection />);
    await screen.findByText(vi.google.settings.notLinked);

    await fireEvent.press(screen.getByTestId('settings-google-link'));

    await waitFor(() => expect(screen.getByTestId('settings-google-link').props.accessibilityState.busy).toBe(false));
    expect(identityRequests(fetchMock)).toEqual([]);
    expect(screen.queryByTestId('settings-google-message')).toBeNull();
  });

  it('says "not configured" while no native adapter is installed, and sends nothing', async () => {
    setGoogleSignInPlatform(null);
    const fetchMock = serve(testMe(), {});
    await renderWithProviders(<GoogleLinkSection />);
    await screen.findByText(vi.google.settings.notLinked);

    await fireEvent.press(screen.getByTestId('settings-google-link'));

    expect((await screen.findByTestId('settings-google-message')).props.children).toBe(
      vi.google.errors.notConfigured,
    );
    expect(identityRequests(fetchMock)).toEqual([]);
  });

  it('explains when the Google account is already linked to another Taskly account (409)', async () => {
    google.queue({ type: 'success', idToken: 'gid-1', email: 'an@example.com' });
    serve(testMe(), { post: () => problem(409, 'Conflict') });
    await renderWithProviders(<GoogleLinkSection />);
    await screen.findByText(vi.google.settings.notLinked);

    await fireEvent.press(screen.getByTestId('settings-google-link'));

    const message = await screen.findByTestId('settings-google-message');
    expect(message.props.children).toBe(vi.google.errors.linkConflict);
    expect(message.props.accessibilityRole).toBe('alert');
    expect(screen.getByText(vi.google.settings.notLinked)).toBeTruthy();
  });

  it('unlinks Google when the account has a password', async () => {
    const fetchMock = serve(testMe({ linkedProviders: ['GOOGLE'] }), {
      delete: (setMe) => {
        setMe(testMe());
        return jsonResponse(204);
      },
    });
    await renderWithProviders(<GoogleLinkSection />);
    await screen.findByText(vi.google.settings.linked);

    await fireEvent.press(screen.getByTestId('settings-google-unlink'));

    expect(await screen.findByText(vi.google.settings.notLinked)).toBeTruthy();
    expect(screen.getByTestId('settings-google-message').props.children).toBe(vi.google.settings.unlinkSuccess);
    expect(requestAt(fetchMock, identityRequests(fetchMock)[0]).method).toBe('DELETE');
    expect(google.signInCalls).toBe(0);
  });

  it('points at "Forgot your password?" and disables unlinking when the account has none', async () => {
    const fetchMock = serve(testMe({ linkedProviders: ['GOOGLE'], hasPassword: false }), {});
    await renderWithProviders(<GoogleLinkSection />);
    await screen.findByText(vi.google.settings.linked);

    expect(screen.getByTestId('settings-google-need-password').props.children).toBe(vi.google.settings.needPassword);
    expect(screen.getByTestId('settings-google-unlink').props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.press(screen.getByTestId('settings-google-unlink'));
    expect(identityRequests(fetchMock)).toEqual([]);
  });

  it('shows "set a password first" when the server refuses the unlink with 409 password-required', async () => {
    // The cached GET me still says "has a password" (no M5 field), the server knows better.
    const me: MeResponse = { ...testUser, linkedProviders: ['GOOGLE'] };
    serve(me, { delete: () => problem(409, 'Conflict', { code: 'password-required', detail: 'Set a password first' }) });
    await renderWithProviders(<GoogleLinkSection />);
    await screen.findByText(vi.google.settings.linked);

    await fireEvent.press(screen.getByTestId('settings-google-unlink'));

    expect((await screen.findByTestId('settings-google-message')).props.children).toBe(vi.google.settings.needPassword);
  });

  it('treats 404 (already unlinked, e.g. from another device) as unlinked and refreshes the status', async () => {
    serve(testMe({ linkedProviders: ['GOOGLE'] }), {
      delete: (setMe) => {
        setMe(testMe());
        return problem(404, 'Not Found');
      },
    });
    await renderWithProviders(<GoogleLinkSection />);
    await screen.findByText(vi.google.settings.linked);

    await fireEvent.press(screen.getByTestId('settings-google-unlink'));

    expect(await screen.findByText(vi.google.settings.notLinked)).toBeTruthy();
    expect(screen.getByTestId('settings-google-message').props.children).toBe(vi.google.settings.unlinkSuccess);
  });
});
