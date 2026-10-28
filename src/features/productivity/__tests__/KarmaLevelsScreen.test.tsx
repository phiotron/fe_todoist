import { screen } from '@testing-library/react-native';
import { jsonResponse } from '../../../test/http';
import { productivity } from '../../../test/m10Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { KarmaLevelsScreen } from '../KarmaLevelsScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
}));

describe('KarmaLevelsScreen', () => {
  it('lists the 8 levels with their thresholds and marks the current one', async () => {
    await renderSignedIn(<KarmaLevelsScreen />, { 'GET /api/v1/productivity': () => jsonResponse(200, productivity()) });

    expect(screen.getByTestId('karma-level-BEGINNER')).toBeOnTheScreen();
    expect(screen.getByTestId('karma-level-ENLIGHTENED')).toBeOnTheScreen();
    expect(screen.getByText('từ 50000 điểm')).toBeOnTheScreen();
    expect(await screen.findByText(/Cấp hiện tại/)).toBeOnTheScreen();
  });

  it('still shows the levels when Productivity cannot be loaded', async () => {
    await renderSignedIn(<KarmaLevelsScreen />, {});

    expect(screen.getAllByTestId(/^karma-level-/)).toHaveLength(8);
  });
});
