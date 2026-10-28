import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { viTranslation as vi } from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { mockFetch, problem } from '../../../test/http';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings, settingsResponse } from '../../../test/settingsFixtures';
import { ResetSubtasksSection } from '../ResetSubtasksSection';

describe('ResetSubtasksSection', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('is off by default, explains itself and saves resetSubtasks', async () => {
    const { patchBodies } = serveSettings(mockFetch());
    await renderWithSettings(<ResetSubtasksSection />);

    const toggle = await screen.findByTestId('reset-subtasks');
    expect(toggle.props.accessibilityState).toMatchObject({ checked: false });
    expect(screen.getByText(vi.recurrence.settings.resetSubtasks.hint)).toBeTruthy();

    await fireEvent.press(toggle);

    await waitFor(() => expect(patchBodies).toEqual([{ resetSubtasks: true }]));
    expect(screen.getByTestId('reset-subtasks').props.accessibilityState).toMatchObject({ checked: true });
  });

  it('shows the saved value', async () => {
    serveSettings(mockFetch(), { settings: settingsResponse({ resetSubtasks: true }) });
    await renderWithSettings(<ResetSubtasksSection />);
    await waitFor(() => expect(screen.getByTestId('reset-subtasks').props.accessibilityState).toMatchObject({ checked: true }));
  });

  it('explains when saving fails and keeps the choice', async () => {
    serveSettings(mockFetch(), { patch: () => problem(503, 'Service Unavailable') });
    await renderWithSettings(<ResetSubtasksSection />);

    await fireEvent.press(await screen.findByTestId('reset-subtasks'));

    expect((await screen.findByTestId('reset-subtasks-error')).props.children).toBe(vi.settings.saveFailed);
  });

  it('shows its title', async () => {
    serveSettings(mockFetch());
    await renderWithSettings(<ResetSubtasksSection />);
    expect(await screen.findByText(vi.recurrence.settings.resetSubtasks.title)).toBeOnTheScreen();
  });
});
