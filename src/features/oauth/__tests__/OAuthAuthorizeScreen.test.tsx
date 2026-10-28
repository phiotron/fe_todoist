import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Linking } from 'react-native';
import { viTranslation as vi } from '../../../i18n';
import { requestsTo } from '../../../test/apiRoutes';
import { jsonResponse, problem } from '../../../test/http';
import { renderSignedIn } from '../../../test/screen';
import { OAuthAuthorizeScreen } from '../OAuthAuthorizeScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));

const PARAMS = {
  client_id: 'tkc_abc',
  redirect_uri: 'https://client.example/callback',
  scope: 'data:read,task:add',
  state: 'xyz',
  code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  code_challenge_method: 'S256',
};

const PREVIEW = '/api/v1/oauth/authorize/preview';
const AUTHORIZE = '/api/v1/oauth/authorize';

const previewBody = {
  clientId: 'tkc_abc',
  appName: 'Notes Sync',
  redirectUri: 'https://client.example/callback',
  scopes: ['data:read', 'task:add'],
};

describe('OAuthAuthorizeScreen (M13c F2)', () => {
  let openURL: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  });

  afterEach(() => {
    openURL.mockRestore();
  });

  it('asks the server about the request and shows the app and what it can do', async () => {
    const { fetchMock } = await renderSignedIn(<OAuthAuthorizeScreen params={PARAMS} />, {
      [`GET ${PREVIEW}`]: () => jsonResponse(200, previewBody),
    });

    expect(await screen.findByText(vi.oauth.heading.replace('{{app}}', 'Notes Sync'))).toBeTruthy();
    expect(screen.getByTestId('oauth-scope-data:read')).toBeTruthy();
    expect(screen.getByText(`• ${vi.oauth.scopes.taskAdd}`)).toBeTruthy();
    const preview = requestsTo(fetchMock, 'GET', PREVIEW)[0];
    expect(preview.query.get('clientId')).toBe('tkc_abc');
    expect(preview.query.get('redirectUri')).toBe('https://client.example/callback');
    expect(preview.query.get('scope')).toBe('data:read,task:add');
  });

  it('Allow posts the consent and opens the returned address', async () => {
    const { fetchMock } = await renderSignedIn(<OAuthAuthorizeScreen params={PARAMS} />, {
      [`GET ${PREVIEW}`]: () => jsonResponse(200, previewBody),
      [`POST ${AUTHORIZE}`]: () => jsonResponse(200, { redirectUrl: 'https://client.example/callback?code=abc&state=xyz' }),
    });

    await fireEvent.press(await screen.findByTestId('oauth-allow'));

    await waitFor(() => expect(openURL).toHaveBeenCalledWith('https://client.example/callback?code=abc&state=xyz'));
    expect(requestsTo(fetchMock, 'POST', AUTHORIZE)[0].body).toEqual({
      clientId: 'tkc_abc',
      redirectUri: 'https://client.example/callback',
      scope: 'data:read,task:add',
      state: 'xyz',
      codeChallenge: PARAMS.code_challenge,
      codeChallengeMethod: 'S256',
    });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  });

  it('Deny opens the return address with error=access_denied and never calls authorize', async () => {
    const { fetchMock } = await renderSignedIn(<OAuthAuthorizeScreen params={PARAMS} />, {
      [`GET ${PREVIEW}`]: () => jsonResponse(200, previewBody),
    });

    await fireEvent.press(await screen.findByTestId('oauth-deny'));

    await waitFor(() => expect(openURL).toHaveBeenCalledWith('https://client.example/callback?error=access_denied&state=xyz'));
    expect(requestsTo(fetchMock, 'POST', AUTHORIZE)).toHaveLength(0);
  });

  it('a server refusal of Allow shows a toast and stays on the screen', async () => {
    await renderSignedIn(<OAuthAuthorizeScreen params={PARAMS} />, {
      [`GET ${PREVIEW}`]: () => jsonResponse(200, previewBody),
      [`POST ${AUTHORIZE}`]: () => problem(500, 'Internal Server Error', { requestId: 'abcdef123456' }),
    });

    await fireEvent.press(await screen.findByTestId('oauth-allow'));

    expect(await screen.findByTestId('snackbar')).toBeTruthy();
    expect(openURL).not.toHaveBeenCalled();
    expect(screen.getByTestId('oauth-consent')).toBeTruthy();
  });

  it('a link that cannot be opened shows a toast', async () => {
    openURL.mockRejectedValue(new Error('no handler'));
    await renderSignedIn(<OAuthAuthorizeScreen params={PARAMS} />, {
      [`GET ${PREVIEW}`]: () => jsonResponse(200, previewBody),
      [`POST ${AUTHORIZE}`]: () => jsonResponse(200, { redirectUrl: 'myapp://cb?code=1' }),
    });

    await fireEvent.press(await screen.findByTestId('oauth-allow'));

    expect(await screen.findByText(vi.oauth.openFailed)).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('an incomplete link is an invalid request and calls no API', async () => {
    const { fetchMock } = await renderSignedIn(<OAuthAuthorizeScreen params={{ client_id: 'tkc_abc' }} />);

    expect(await screen.findByText(vi.oauth.invalidLink)).toBeTruthy();
    expect(requestsTo(fetchMock, 'GET', PREVIEW)).toHaveLength(0);
    await fireEvent.press(screen.getByTestId('oauth-invalid-action'));
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('a server 400 (unknown app, wrong return address, bad scope) is an invalid request, never a redirect', async () => {
    await renderSignedIn(<OAuthAuthorizeScreen params={PARAMS} />, {
      [`GET ${PREVIEW}`]: () => problem(400, 'Bad Request'),
    });

    expect(await screen.findByText(vi.oauth.invalidServer)).toBeTruthy();
    expect(openURL).not.toHaveBeenCalled();
  });

  it('a network-level failure shows the retry state instead', async () => {
    await renderSignedIn(<OAuthAuthorizeScreen params={PARAMS} />, {
      [`GET ${PREVIEW}`]: () => problem(503, 'Unavailable'),
    });

    expect(await screen.findByTestId('oauth-state-action')).toBeTruthy();
  });
});
