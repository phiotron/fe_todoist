import { QueryClientContext, hashKey } from '@tanstack/react-query';
import { useCallback, useContext, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import type { Project } from '../../api/models';
import { queryKeys } from '../../api/queryKeys';

/** The fixed name the server gives every Inbox (spec 10.1). */
const SERVER_INBOX_NAME = 'Inbox';
const PROJECTS_KEY = queryKeys.projects.list(false);
const PROJECTS_HASH = hashKey(PROJECTS_KEY);
const noSubscription = () => () => undefined;

/**
 * Name to show for a project known only by id + server name (a task's, section's or comment's projectName): the Inbox
 * follows the app language like projectDisplayName. Reads the cached projects list without fetching it (and works
 * outside a QueryClientProvider); until that list is there, the server's fixed "Inbox" name is taken as the Inbox.
 */
export function useProjectNameLabel(): (projectId: string | null | undefined, projectName: string | null | undefined) => string {
  const { t } = useTranslation();
  const client = useContext(QueryClientContext);
  const subscribe = useCallback(
    (onChange: () => void) => (client
        ? // Only events that really change the cached list. Events a render fires itself (a useQuery's `added` /
          // `observerResultsUpdated`) must not reach React: with a committed snapshot that is already stale it
          // would setState while another component renders ("Cannot update a component … while rendering").
          client.getQueryCache().subscribe((event) => {
            if (event.query.queryHash !== PROJECTS_HASH) return;
            if (event.type === 'updated' || event.type === 'removed' || (event.type === 'added' && event.query.state.data !== undefined)) {
              // Deferred out of whatever is rendering right now: ANY component may write the projects list during its
              // render (setQueryData in a render, hydration, a select), and a synchronous setState here then reads
              // "Cannot update a component (TodayBody) while rendering …". useSyncExternalStore re-checks the snapshot at
              // commit, so a microtask later is still before the user sees a stale name.
              queueMicrotask(onChange);
            }
          })
        : noSubscription()),
    [client],
  );
  const read = () => client?.getQueryData<Project[]>(PROJECTS_KEY);
  const projects = useSyncExternalStore(subscribe, read, read);
  const inboxId = projects?.find((project) => project.isInbox)?.id;
  const loaded = projects !== undefined;
  return useCallback(
    (projectId, projectName) => {
      const isInbox = loaded ? projectId === inboxId : projectName === SERVER_INBOX_NAME;
      return isInbox ? t('views.inbox.title') : (projectName ?? '');
    },
    [inboxId, loaded, t],
  );
}
