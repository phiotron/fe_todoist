import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { viTranslation as vi } from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { mockFetch, problem } from '../../../test/http';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings, settingsResponse } from '../../../test/settingsFixtures';
import { AutoAcceptSection } from '../AutoAcceptSection';

describe('AutoAcceptSection (M8a Auto accept invites)', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('is off when the server does not send the field, and saves autoAcceptInvites: true', async () => {
    const { patchBodies } = serveSettings(mockFetch());
    await renderWithSettings(<AutoAcceptSection />);

    const toggle = await screen.findByTestId('auto-accept-invites');
    expect(toggle.props.accessibilityState).toMatchObject({ checked: false });
    expect(screen.getByText(vi.settings.autoAccept.title)).toBeTruthy();
    expect(screen.getByText(vi.settings.autoAccept.hint)).toBeTruthy();

    await fireEvent.press(toggle);

    await waitFor(() => expect(patchBodies).toEqual([{ autoAcceptInvites: true }]));
    await waitFor(() => expect(screen.getByTestId('auto-accept-invites').props.accessibilityState).toMatchObject({ checked: true }));
  });

  it('shows the value the account has and turns it off', async () => {
    const { patchBodies } = serveSettings(mockFetch(), { settings: settingsResponse({ autoAcceptInvites: true }) });
    await renderWithSettings(<AutoAcceptSection />);

    const toggle = await screen.findByTestId('auto-accept-invites');
    await waitFor(() => expect(toggle.props.accessibilityState).toMatchObject({ checked: true }));
    await fireEvent.press(toggle);
    await waitFor(() => expect(patchBodies).toEqual([{ autoAcceptInvites: false }]));
  });

  it('keeps the screen usable and explains when saving fails', async () => {
    serveSettings(mockFetch(), { patch: () => problem(503, 'Service Unavailable') });
    await renderWithSettings(<AutoAcceptSection />);
    await fireEvent.press(await screen.findByTestId('auto-accept-invites'));
    expect((await screen.findByTestId('auto-accept-error')).props.children).toBe(vi.settings.saveFailed);
  });
});
