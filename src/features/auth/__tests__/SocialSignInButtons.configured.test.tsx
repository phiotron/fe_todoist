import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { viTranslation as vi } from '../../../i18n';
import { setExternalBrowser } from '../../../lib/externalBrowser';
import { FakeExternalBrowser } from '../../../test/fakeExternalBrowser';
import { mockFetch } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import { forgetSocialFlow } from '../../social/socialFlow';
import { SocialSignInButtons } from '../SocialSignInButtons';

jest.mock('../../../lib/socialConfig', () => ({
  SOCIAL_CONFIG: {
    appleServiceId: 'svc.taskly',
    appleRedirectUri: 'https://api.example.com/api/v1/auth/apple/callback',
    facebookAppId: '42',
    facebookRedirectUri: 'https://api.example.com/api/v1/auth/facebook/callback',
  },
}));

describe('SocialSignInButtons with a configured build', () => {
  let browser: FakeExternalBrowser;

  beforeEach(() => {
    browser = new FakeExternalBrowser();
    setExternalBrowser(browser);
    forgetSocialFlow();
    mockFetch();
  });

  afterEach(() => {
    setExternalBrowser(null);
    forgetSocialFlow();
  });

  it('Apple opens the Apple page in the browser and tells the user', async () => {
    await renderWithProviders(<SocialSignInButtons testID="s" />);

    await fireEvent.press(screen.getByTestId('s-apple'));

    await waitFor(() => expect(browser.opened).toHaveLength(1));
    const url = new URL(browser.opened[0]);
    expect(url.host).toBe('appleid.apple.com');
    expect(url.searchParams.get('client_id')).toBe('svc.taskly');
    expect(url.searchParams.get('state')).toBeTruthy();
    expect((await screen.findByTestId('s-message')).props.children).toBe(vi.social.opening);
  });

  it('Facebook opens the Facebook dialog', async () => {
    await renderWithProviders(<SocialSignInButtons testID="s" />);

    await fireEvent.press(screen.getByTestId('s-facebook'));

    await waitFor(() => expect(browser.opened).toHaveLength(1));
    const url = new URL(browser.opened[0]);
    expect(url.host).toBe('www.facebook.com');
    expect(url.searchParams.get('client_id')).toBe('42');
  });

  it('reports a browser that cannot be opened', async () => {
    browser.failNext();
    await renderWithProviders(<SocialSignInButtons testID="s" />);

    await fireEvent.press(screen.getByTestId('s-apple'));

    expect((await screen.findByTestId('s-message')).props.children).toBe('Không mở được trình duyệt để đăng nhập Apple');
  });
});
