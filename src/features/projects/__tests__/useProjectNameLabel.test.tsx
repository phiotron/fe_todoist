import { act, renderHook } from '@testing-library/react-native';
import { queryKeys } from '../../../api/queryKeys';
import i18n from '../../../i18n';
import { inboxProject, makeProject } from '../../../test/m1Fixtures';
import { createTestQueryClient, createWrapper } from '../../../test/render';
import { useProjectNameLabel } from '../useProjectNameLabel';

/** VIUI: a task / section / comment only carries its project's server name; the Inbox one follows the app language. */
describe('useProjectNameLabel', () => {
  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('vi');
    });
  });

  async function label(cached: boolean) {
    const queryClient = createTestQueryClient();
    if (cached) {
      queryClient.setQueryData(queryKeys.projects.list(false), [
        inboxProject,
        makeProject({ id: 'p-own', name: 'Inbox' }),
        makeProject({ id: 'p1', name: 'Công ty' }),
      ]);
    }
    const { result } = await renderHook(() => useProjectNameLabel(), { wrapper: createWrapper(queryClient) });
    return result.current;
  }

  it('translates the Inbox found in the cached projects list, keeps a user project that is also called "Inbox"', async () => {
    const name = await label(true);
    expect(name('p-inbox', 'Inbox')).toBe('Hộp thư đến');
    expect(name('p-own', 'Inbox')).toBe('Inbox');
    expect(name('p1', 'Công ty')).toBe('Công ty');
  });

  it('without the projects list yet, the server Inbox name is translated', async () => {
    const name = await label(false);
    expect(name('p-x', 'Inbox')).toBe('Hộp thư đến');
    expect(name('p1', 'Công ty')).toBe('Công ty');
    expect(name('p1', null)).toBe('');
  });

  it('works outside a QueryClientProvider (a bare task row)', async () => {
    const { result } = await renderHook(() => useProjectNameLabel());
    expect(result.current('p-x', 'Inbox')).toBe('Hộp thư đến');
  });

  it('English shows "Inbox"', async () => {
    await act(async () => {
      await i18n.changeLanguage('en');
    });
    const name = await label(true);
    expect(name('p-inbox', 'Inbox')).toBe('Inbox');
  });
});
