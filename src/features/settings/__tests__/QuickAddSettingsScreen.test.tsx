import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { viTranslation as vi } from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { mockFetch, problem } from '../../../test/http';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings, settingsResponse } from '../../../test/settingsFixtures';
import { QuickAddSettingsScreen } from '../QuickAddSettingsScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));

describe('QuickAddSettingsScreen (M6b)', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('defaults: Project, Date, Assignee are on; Project cannot be switched off', async () => {
    serveSettings(mockFetch());
    await renderWithSettings(<QuickAddSettingsScreen />);

    expect((await screen.findByTestId('quick-add-chip-DATE')).props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId('quick-add-chip-ASSIGNEE').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId('quick-add-chip-LABELS').props.accessibilityState).toMatchObject({ checked: false });
    expect(screen.getByTestId('quick-add-chip-PROJECT').props.accessibilityState).toMatchObject({ checked: true, disabled: true });
    expect(screen.getByTestId('quick-add-show-labels').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByTestId('quick-add-show-description').props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByText(vi.quickAdd.settings.alwaysShown)).toBeTruthy();
  });

  it('showing a hidden chip adds it at the end, hiding removes it; each change is one PATCH', async () => {
    const { patchBodies } = serveSettings(mockFetch());
    await renderWithSettings(<QuickAddSettingsScreen />);

    await fireEvent.press(await screen.findByTestId('quick-add-chip-LABELS'));
    await waitFor(() => expect(patchBodies).toEqual([{ quickAddChips: ['PROJECT', 'DATE', 'ASSIGNEE', 'LABELS'] }]));

    await fireEvent.press(screen.getByTestId('quick-add-chip-DATE'));
    await waitFor(() => expect(patchBodies[1]).toEqual({ quickAddChips: ['PROJECT', 'ASSIGNEE', 'LABELS'] }));
    expect(screen.getByTestId('quick-add-chip-DATE').props.accessibilityState).toMatchObject({ checked: false });
  });

  it('reorders in the drag dialog (arrow buttons) and saves the new order', async () => {
    const { patchBodies } = serveSettings(mockFetch(), {
      settings: settingsResponse({ quickAddChips: ['PROJECT', 'DATE', 'LABELS'] }),
    });
    await renderWithSettings(<QuickAddSettingsScreen />);

    await fireEvent.press(await screen.findByTestId('quick-add-reorder'));
    await fireEvent.press(await screen.findByTestId('quick-add-reorder-modal-up-LABELS'));

    await waitFor(() => expect(patchBodies).toEqual([{ quickAddChips: ['PROJECT', 'LABELS', 'DATE'] }]));
  });

  it('saves "Show action labels" and "Show description"; the preview follows', async () => {
    const { patchBodies } = serveSettings(mockFetch());
    await renderWithSettings(<QuickAddSettingsScreen />);

    await fireEvent.press(await screen.findByTestId('quick-add-show-description'));
    await fireEvent.press(screen.getByTestId('quick-add-show-labels'));

    await waitFor(() =>
      expect(patchBodies).toEqual([{ quickAddShowDescription: false }, { quickAddShowActionLabels: false }]),
    );
    expect(screen.getByTestId('quick-add-preview-DATE')).toBeTruthy();
  });

  it('keeps the choice and explains when saving fails', async () => {
    serveSettings(mockFetch(), { patch: () => problem(503, 'Service Unavailable') });
    await renderWithSettings(<QuickAddSettingsScreen />);

    await fireEvent.press(await screen.findByTestId('quick-add-chip-LABELS'));

    expect((await screen.findByTestId('quick-add-settings-error')).props.children).toBe(vi.settings.saveFailed);
    expect(screen.getByTestId('quick-add-chip-LABELS').props.accessibilityState).toMatchObject({ checked: true });
  });
});
