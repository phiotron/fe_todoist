import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { viTranslation as vi } from '../../../i18n';
import { tokenStore } from '../../../lib/tokenStore';
import { jsonResponse, mockFetch } from '../../../test/http';
import { memorySettingsStorage } from '../../../test/memorySettingsStorage';
import { renderWithSettings } from '../../../test/renderSettings';
import { serveSettings, settingsResponse } from '../../../test/settingsFixtures';
import { PinnedScreen } from '../PinnedScreen';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() } }));
jest.mock('../../labels/LabelScreen', () => {
  const { Text } = require('react-native');
  return { LabelScreen: ({ labelId, tab }: { labelId: string; tab?: boolean }) => <Text testID="pinned-label" accessibilityHint={String(tab)}>{labelId}</Text> };
});
jest.mock('../../filters/FilterScreen', () => {
  const { Text } = require('react-native');
  return { FilterScreen: ({ filterId, tab }: { filterId: string; tab?: boolean }) => <Text testID="pinned-filter" accessibilityHint={String(tab)}>{filterId}</Text> };
});
jest.mock('../../projects/ProjectScreen', () => {
  const { Text } = require('react-native');
  return {
    ProjectScreen: ({ projectId, tab }: { projectId: string; tab?: boolean }) => (
      <Text testID="pinned-project" accessibilityHint={String(tab)}>
        {projectId}
      </Text>
    ),
  };
});

const ID = '11111111-1111-4111-8111-111111111111';

async function renderWith(navTabs: string[]) {
  serveSettings(mockFetch(), {
    settings: settingsResponse({ navTabs }),
    routes: {
      'GET /api/v1/projects': () => jsonResponse(200, [{ id: ID, name: 'Marketing', isInbox: false, archivedAt: null }]),
      'GET /api/v1/labels': () => jsonResponse(200, [{ id: ID, name: 'urgent' }]),
      'GET /api/v1/filters': () => jsonResponse(200, [{ id: ID, name: 'Next 7 days' }]),
    },
  });
  return renderWithSettings(<PinnedScreen />, { storage: memorySettingsStorage() });
}

describe('PinnedScreen (the pinned tab)', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('shows the pinned project as a tab screen (no back button)', async () => {
    await renderWith(['INBOX', 'TODAY', `project:${ID}`, 'BROWSE']);

    const node = await screen.findByTestId('pinned-project');
    expect(node.props.children).toBe(ID);
    expect(node.props.accessibilityHint).toBe('true');
  });

  it.each(['label', 'filter'])('a pinned %s shows its screen as a tab screen (no back button)', async (kind) => {
    await renderWith(['INBOX', 'TODAY', `${kind}:${ID}`, 'BROWSE']);

    const node = await screen.findByTestId(`pinned-${kind}`);
    expect(node.props.children).toBe(ID);
    expect(node.props.accessibilityHint).toBe('true');
  });

  it('with nothing pinned it explains and links to the tab bar settings', async () => {
    await renderWith(['INBOX', 'TODAY', 'UPCOMING', 'BROWSE']);

    expect(await screen.findByText(vi.settings.navigation.pinnedEmpty)).toBeTruthy();
    await fireEvent.press(screen.getByText(vi.settings.navigation.openSettings));
    expect(router.push).toHaveBeenCalledWith('/settings/navigation');
  });
});
