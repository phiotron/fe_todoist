import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { viTranslation as vi } from '../../../i18n';
import { setExternalBrowser } from '../../../lib/externalBrowser';
import { tokenStore } from '../../../lib/tokenStore';
import { FakeExternalBrowser } from '../../../test/fakeExternalBrowser';
import { mockFetch } from '../../../test/http';
import { renderWithProviders } from '../../../test/render';
import { forgetSocialFlow } from '../../social/socialFlow';
import { LoginScreen } from '../LoginScreen';
import { RegisterScreen } from '../RegisterScreen';
import { SocialSignInButtons } from '../SocialSignInButtons';

jest.mock('expo-router', () => ({
  router: {
    replace: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
    dismissAll: jest.fn(),
    canGoBack: jest.fn(() => true),
    canDismiss: jest.fn(() => true),
  },
}));

describe('SocialSignInButtons', () => {
  let browser: FakeExternalBrowser;

  beforeEach(async () => {
    browser = new FakeExternalBrowser();
    setExternalBrowser(browser);
    forgetSocialFlow();
    await tokenStore.clear();
    mockFetch();
  });

  afterEach(() => {
    setExternalBrowser(null);
    forgetSocialFlow();
  });

  it('shows both buttons on the login and the register screens, in vi', async () => {
    await renderWithProviders(<LoginScreen />);
    expect(screen.getByText(vi.social.continueApple)).toBeTruthy();
    expect(screen.getByText(vi.social.continueFacebook)).toBeTruthy();
    expect(screen.getByTestId('login-social-apple')).toBeTruthy();
    expect(screen.getByTestId('login-social-facebook')).toBeTruthy();
  });

  it('is also on the register screen', async () => {
    await renderWithProviders(<RegisterScreen />);
    expect(screen.getByTestId('register-social-apple')).toBeTruthy();
    expect(screen.getByTestId('register-social-facebook')).toBeTruthy();
  });

  it('says "not configured" and opens nothing while the build has no Apple / Facebook ids', async () => {
    await renderWithProviders(<SocialSignInButtons testID="s" />);

    await fireEvent.press(screen.getByTestId('s-apple'));

    expect((await screen.findByTestId('s-message')).props.children).toBe('Bản app này chưa được cấu hình đăng nhập Apple');
    expect(browser.opened).toEqual([]);

    await fireEvent.press(screen.getByTestId('s-facebook'));
    await waitFor(() =>
      expect(screen.getByTestId('s-message').props.children).toBe('Bản app này chưa được cấu hình đăng nhập Facebook'),
    );
  });

  it('does nothing while the surrounding form is submitting', async () => {
    await renderWithProviders(<SocialSignInButtons testID="s" disabled />);

    await fireEvent.press(screen.getByTestId('s-apple'));

    expect(screen.queryByTestId('s-message')).toBeNull();
    expect(browser.opened).toEqual([]);
  });
});
