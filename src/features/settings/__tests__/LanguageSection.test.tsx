import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import i18n, { enTranslation as en, viTranslation as vi } from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { mockFetch, problem } from '../../../test/http';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings } from '../../../test/settingsFixtures';
import { LanguageSection } from '../LanguageSection';

describe('LanguageSection', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('vi');
    });
  });

  it('names each language in that language, with the current one checked', async () => {
    serveSettings(mockFetch());
    await renderWithSettings(<LanguageSection />);

    expect(await screen.findByText(vi.settings.language.title)).toBeTruthy();
    expect(screen.getByText('Tiếng Việt')).toBeTruthy();
    expect(screen.getByText('English')).toBeTruthy();
    expect(screen.getByTestId('language-vi').props.accessibilityState).toMatchObject({ checked: true });
  });

  it('switches every text to English at once and saves the language', async () => {
    const { patchBodies } = serveSettings(mockFetch());
    await renderWithSettings(<LanguageSection />);

    await fireEvent.press(await screen.findByTestId('language-en'));

    expect(await screen.findByText(en.settings.language.title)).toBeTruthy();
    expect(screen.getByTestId('language-en').props.accessibilityState).toMatchObject({ checked: true });
    await waitFor(() => expect(patchBodies).toEqual([{ locale: 'en' }]));
  });

  it('keeps the language and explains when saving fails', async () => {
    serveSettings(mockFetch(), { patch: () => problem(503, 'Service Unavailable') });
    await renderWithSettings(<LanguageSection />);

    await fireEvent.press(await screen.findByTestId('language-en'));

    expect((await screen.findByTestId('language-error')).props.children).toBe(en.settings.saveFailed);
    expect(screen.getByTestId('language-en').props.accessibilityState).toMatchObject({ checked: true });
  });
});
