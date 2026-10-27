import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { tokenStore } from '../../../lib/tokenStore';
import { jsonResponse, mockFetch } from '../../../test/http';
import { memorySettingsStorage } from '../../../test/memorySettingsStorage';
import { createTestQueryClient } from '../../../test/render';
import { createSettingsWrapper } from '../../../test/renderSettings';
import { serveSettings, settingsResponse } from '../../../test/settingsFixtures';
import { SessionProvider } from '../../auth/session';
import { useNavTabs } from '../navTabs';
import { useTabBarItems } from '../useTabBarItems';

const P1 = '11111111-1111-4111-8111-111111111111';
const P2 = '22222222-2222-4222-8222-222222222222';

function wrapperWith() {
  return createSettingsWrapper({
    queryClient: createTestQueryClient(),
    storage: memorySettingsStorage(),
    deviceTimeZone: 'Asia/Ho_Chi_Minh',
  });
}

function serve(navTabs: string[], projects: unknown[] = []) {
  serveSettings(mockFetch(), {
    settings: settingsResponse({ navTabs }),
    routes: { 'GET /api/v1/projects': () => jsonResponse(200, projects) },
  });
}

describe('useNavTabs / useTabBarItems', () => {
  beforeEach(async () => {
    await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  });

  it('without a settings provider the tab bar is the M1 default', async () => {
    mockFetch();
    const queryClient = createTestQueryClient();
    const { result } = await renderHook(() => useNavTabs(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
          <SessionProvider>{children}</SessionProvider>
        </QueryClientProvider>
      ),
    });
    expect(result.current).toEqual(['INBOX', 'TODAY', 'UPCOMING', 'BROWSE']);
  });

  it('follows the navTabs of the account settings', async () => {
    serve(['TODAY', 'UPCOMING', 'BROWSE']);
    const { result } = await renderHook(() => useTabBarItems(), { wrapper: wrapperWith() });

    await waitFor(() => expect(result.current.map((item) => item.key)).toEqual(['TODAY', 'UPCOMING', 'BROWSE']));
    expect(result.current.map((item) => item.route)).toEqual(['today', 'upcoming', 'browse']);
  });

  it('shows the pinned project under its name', async () => {
    serve(['INBOX', 'TODAY', `project:${P1}`, 'BROWSE'], [{ id: P1, name: 'Marketing', isInbox: false, archivedAt: null }]);
    const { result } = await renderHook(() => useTabBarItems(), { wrapper: wrapperWith() });

    await waitFor(() => expect(result.current.find((item) => item.route === 'pinned')?.title).toBe('Marketing'));
  });

  it('drops a pinned target that no longer exists once the list has loaded', async () => {
    serve(['INBOX', 'TODAY', `project:${P2}`, 'BROWSE'], [{ id: P1, name: 'Marketing', isInbox: false, archivedAt: null }]);
    const { result } = await renderHook(() => useTabBarItems(), { wrapper: wrapperWith() });

    await waitFor(() => expect(result.current.map((item) => item.key)).toEqual(['INBOX', 'TODAY', 'BROWSE']));
  });
});
