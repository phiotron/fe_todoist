import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { jsonResponse } from '../../../test/http';
import { inboxProject } from '../../../test/m1Fixtures';
import { renderSignedIn } from '../../../test/screen';
import { BrowseScreen } from '../BrowseScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));

describe('Browse → Settings entry points (spec 9.2)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('the gear in the header opens Settings', async () => {
    await renderSignedIn(<BrowseScreen />, {});

    await fireEvent.press(await screen.findByTestId('browse-settings'));

    expect(router.push).toHaveBeenCalledWith('/settings');
  });

  it('the Settings block of Browse opens Settings too', async () => {
    // The extra blocks appear once the projects are loaded.
    await renderSignedIn(<BrowseScreen />, {
      'GET /api/v1/projects': () => jsonResponse(200, [inboxProject]),
      'GET /api/v1/favorites': () => jsonResponse(200, []),
    });

    await fireEvent.press(await screen.findByTestId('browse-settings-row'));

    expect(router.push).toHaveBeenCalledWith('/settings');
  });
});
