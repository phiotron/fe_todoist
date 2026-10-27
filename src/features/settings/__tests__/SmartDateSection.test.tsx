import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { viTranslation as vi } from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { mockFetch, problem } from '../../../test/http';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings } from '../../../test/settingsFixtures';
import { SmartDateSection } from '../SmartDateSection';

describe('SmartDateSection', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('is on by default and saves the switch', async () => {
    const { patchBodies } = serveSettings(mockFetch());
    await renderWithSettings(<SmartDateSection />);

    const toggle = await screen.findByTestId('smart-date');
    expect(toggle.props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByText(vi.settings.smartDate.hint)).toBeTruthy();

    await fireEvent.press(toggle);

    await waitFor(() => expect(patchBodies).toEqual([{ smartDateRecognition: false }]));
    expect(screen.getByTestId('smart-date').props.accessibilityState).toMatchObject({ checked: false });
  });

  it('keeps the choice and explains when saving fails', async () => {
    serveSettings(mockFetch(), { patch: () => problem(503, 'Service Unavailable') });
    await renderWithSettings(<SmartDateSection />);

    await fireEvent.press(await screen.findByTestId('smart-date'));

    expect((await screen.findByTestId('smart-date-error')).props.children).toBe(vi.settings.saveFailed);
    expect(screen.getByTestId('smart-date').props.accessibilityState).toMatchObject({ checked: false });
  });
});
