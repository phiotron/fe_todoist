import { QueryClientContext } from '@tanstack/react-query';
import { useCallback, useContext, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import type { Project } from '../../api/models';
import { queryKeys } from '../../api/queryKeys';

/** The fixed name the server gives every Inbox (spec 10.1). */
const SERVER_INBOX_NAME = 'Inbox';
const PROJECTS_KEY = queryKeys.projects.list(false);
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
    (onChange: () => void) => (client ? client.getQueryCache().subscribe(onChange) : noSubscription()),
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
