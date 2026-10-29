import { useQueryClient } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { queryKeys } from '../../../api/queryKeys';
import { inboxProject, makeProject } from '../../../test/m1Fixtures';
import { createTestQueryClient, createWrapper } from '../../../test/render';
import { useProjectNameLabel } from '../useProjectNameLabel';

/**
 * A render that touches the query cache (every useQuery does: `build` → "added", `getOptimisticResult` →
 * "observerResultsUpdated") must not make useProjectNameLabel setState: when the projects list changed since the
 * last commit, React compares the committed snapshot with the new one and reported "Cannot update a component
 * (`Probe`) while rendering a different component (`Probe`)" (the Today / Upcoming / Inbox console error).
 */
function Probe() {
  const label = useProjectNameLabel();
  const client = useQueryClient();
  const cache = client.getQueryCache();
  // what a useQuery in the same render does to the cache
  cache.notify({ type: 'observerResultsUpdated', query: cache.build(client, { queryKey: queryKeys.workspaces.list() }) });
  return <Text testID="label">{label('p-inbox', 'Inbox')}</Text>;
}

describe('useProjectNameLabel and the query cache events fired while rendering', () => {
  it('does not update a component while rendering', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const queryClient = createTestQueryClient();
    await render(<Probe />, { wrapper: createWrapper(queryClient) });
    await act(async () => {
      queryClient.setQueryData(queryKeys.projects.list(false), [inboxProject, makeProject({ id: 'p1', name: 'Công ty' })]);
    });
    const warned = spy.mock.calls.filter((call) => String(call[0]).includes('while rendering a different component'));
    spy.mockRestore();
    expect(warned).toEqual([]);
    expect(screen.getByTestId('label')).toBeOnTheScreen();
  });
});

/** A component that writes the projects list WHILE rendering (a screen that seeds the cache from props / a select). */
function RenderPhaseWriter() {
  const client = useQueryClient();
  client.setQueryData(queryKeys.projects.list(false), [inboxProject, makeProject({ id: 'p9', name: 'Ghi khi render' })]);
  return null;
}

describe('useProjectNameLabel when another component writes the projects list while rendering', () => {
  it('does not update the label user while rendering, and still shows the new list', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const queryClient = createTestQueryClient();
    function Both({ write }: { write: boolean }) {
      const label = useProjectNameLabel();
      return (
        <>
          <Text testID="named">{label('p9', 'Tên máy chủ')}</Text>
          {write ? <RenderPhaseWriter /> : null}
        </>
      );
    }
    const view = await render(<Both write={false} />, { wrapper: createWrapper(queryClient) });
    await view.rerender(<Both write />);
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    const warned = spy.mock.calls.filter((call) => String(call[0]).includes('while rendering a different component'));
    spy.mockRestore();
    expect(warned).toEqual([]);
    expect(screen.getByTestId('named')).toHaveTextContent('Tên máy chủ');
  });
});
