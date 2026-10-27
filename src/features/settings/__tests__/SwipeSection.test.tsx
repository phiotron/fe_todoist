import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { viTranslation as vi } from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { mockFetch, problem } from '../../../test/http';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings, settingsResponse } from '../../../test/settingsFixtures';
import { SwipeSection } from '../SwipeSection';

const action = (key: 'COMPLETE' | 'SCHEDULE' | 'DELETE' | 'SELECT' | 'NONE' | 'REMINDERS') => vi.settings.swipe.actions[key];

describe('SwipeSection', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('shows the defaults: right = Complete, left = Schedule (spec 9.2)', async () => {
    serveSettings(mockFetch());
    await renderWithSettings(<SwipeSection />);

    expect((await screen.findByTestId('swipe-right')).props.accessibilityLabel).toBe(
      `${vi.settings.swipe.right}, ${action('COMPLETE')}`,
    );
    expect(screen.getByTestId('swipe-left').props.accessibilityLabel).toBe(`${vi.settings.swipe.left}, ${action('SCHEDULE')}`);
  });

  it('offers Complete, Schedule, Delete, Select and None, and saves the chosen side only', async () => {
    const { patchBodies } = serveSettings(mockFetch());
    await renderWithSettings(<SwipeSection />);

    await fireEvent.press(await screen.findByTestId('swipe-left'));
    for (const key of ['COMPLETE', 'SCHEDULE', 'DELETE', 'SELECT', 'NONE']) {
      expect(screen.getByTestId(`swipe-left-option-${key}`)).toBeTruthy();
    }
    expect(screen.queryByTestId('swipe-left-option-REMINDERS')).toBeNull();
    await fireEvent.press(screen.getByTestId('swipe-left-option-DELETE'));

    await waitFor(() => expect(patchBodies).toEqual([{ swipeLeft: 'DELETE' }]));
  });

  it('keeps showing a value from a later milestone (Reminders) that the account already has', async () => {
    serveSettings(mockFetch(), { settings: settingsResponse({ swipeRight: 'REMINDERS' }) });
    await renderWithSettings(<SwipeSection />);

    await fireEvent.press(await screen.findByTestId('swipe-right'));

    expect(screen.getByTestId('swipe-right-option-REMINDERS').props.accessibilityState).toMatchObject({ checked: true });
  });

  it('keeps the choice and explains when saving fails', async () => {
    serveSettings(mockFetch(), { patch: () => problem(503, 'Service Unavailable') });
    await renderWithSettings(<SwipeSection />);

    await fireEvent.press(await screen.findByTestId('swipe-right'));
    await fireEvent.press(screen.getByTestId('swipe-right-option-NONE'));

    expect((await screen.findByTestId('swipe-error')).props.children).toBe(vi.settings.saveFailed);
    expect(screen.getByTestId('swipe-right').props.accessibilityLabel).toBe(`${vi.settings.swipe.right}, ${action('NONE')}`);
  });
});
