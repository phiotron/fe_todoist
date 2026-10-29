import { useQueries, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { describeError } from '../../api/describeError';
import { projectsApi } from '../../api/projects';
import { queryKeys } from '../../api/queryKeys';
import { reviewApi } from '../../api/review';
import { workspacesApi, type WorkspaceMemberResponse } from '../../api/workspaces';
import { SNACKBAR_DURATION_MS, useSnackbar } from '../../components/Snackbar';
import { useDataMutation } from '../../lib/useDataMutation';
import { useReopenTask } from '../tasks/useTaskActions';
import { useTaskList } from '../tasks/useTaskList';
import { useTeamProjects, useWorkspaces } from '../team/useTeam';

const REVIEW_LIST = { view: 'review' } as const;

/**
 * The Pending-review list (GET tasks?view=review): an Admin gets every pending task of the teams they administer, a
 * Member only their own requests. The same query feeds the screen and the count card of the Team tab.
 */
export function useReviewList() {
  return useTaskList(REVIEW_LIST);
}

/** Ids of the projects of one team, from queries the Team tab already runs (Discovery / the guest's project list). */
function useTeamProjectIds(workspaceId: string, isGuest: boolean): ReadonlySet<string> | undefined {
  const discovery = useTeamProjects(workspaceId, !isGuest);
  const mine = useQuery({ queryKey: queryKeys.projects.list(false), queryFn: () => projectsApi.list(false), enabled: isGuest });
  return useMemo(() => {
    if (isGuest) {
      if (!mine.data) return undefined;
      return new Set(mine.data.filter((project) => (project as { workspaceId?: string }).workspaceId === workspaceId).map((project) => project.id));
    }
    return discovery.data ? new Set(discovery.data.map((project) => project.id)) : undefined;
  }, [isGuest, workspaceId, mine.data, discovery.data]);
}

/**
 * Number for the Team tab card. ADAPTER (one place to change): derived from the first pages of the review list, so no
 * extra endpoint is needed; `more` = there are further pages (show "n+"). The list spans every team of the user, so it
 * is narrowed to the projects of the chosen team (unknown yet = still pending). Swap for the backend counts when it has one.
 */
export function useReviewCount(workspaceId: string, isGuest = false) {
  const { query, tasks } = useReviewList();
  const ids = useTeamProjectIds(workspaceId, isGuest);
  const count = useMemo(() => (ids ? tasks.filter((task) => ids.has(task.projectId)).length : 0), [ids, tasks]);
  return { count, more: query.hasNextPage === true, isPending: query.isPending || !ids, isError: query.isError };
}

/** user id to display name, for the teams I administer (one members query per team, for the whole screen). */
export function useRequesterNames(): ReadonlyMap<string, string> {
  const { teams } = useWorkspaces();
  const admin = useMemo(() => teams.filter((team) => team.role === 'ADMIN'), [teams]);
  return useQueries({
    queries: admin.map((team) => ({ queryKey: queryKeys.workspaces.members(team.id), queryFn: () => workspacesApi.members(team.id) })),
    combine: combineNames,
  });
}

function combineNames(results: readonly { data?: readonly WorkspaceMemberResponse[] }[]): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  for (const result of results) for (const member of result.data ?? []) names.set(member.userId, member.displayName);
  return names;
}

/**
 * Admin actions. Approve goes at once (Undo = reopen). Return has no undo endpoint (only the requester can ask again),
 * so it is DEFERRED for the Undo window: the row is hidden, the request is sent when the toast runs out, Undo cancels it.
 * Leaving the screen sends the waiting returns immediately. A failure brings the row back and shows the message.
 */
export function useReviewActions() {
  const { t } = useTranslation();
  const snackbar = useSnackbar();
  const approve = useDataMutation((taskId: string) => reviewApi.approve(taskId)).mutateAsync;
  const reject = useDataMutation((taskId: string) => reviewApi.reject(taskId)).mutateAsync;
  const reopen = useReopenTask().mutateAsync;
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const setHiddenId = useCallback((id: string, value: boolean) => {
    setHidden((previous) => {
      if (previous.has(id) === value) return previous;
      const next = new Set(previous);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const showError = useCallback(
    (failure: unknown) => snackbar.show({ message: describeError(failure).message, tone: 'error' }),
    [snackbar],
  );

  const onApprove = useCallback(
    (taskId: string) => {
      setHiddenId(taskId, true);
      approve(taskId).then(
        () =>
          snackbar.show({
            message: t('review.approved'),
            actionLabel: t('common.undo'),
            onAction: () => {
              reopen({ taskId }).catch(showError);
            },
          }),
        (failure: unknown) => {
          setHiddenId(taskId, false);
          showError(failure);
        },
      );
    },
    [approve, reopen, setHiddenId, showError, snackbar, t],
  );

  const send = useCallback(
    (taskId: string) => {
      timers.current.delete(taskId);
      reject(taskId).catch((failure: unknown) => {
        setHiddenId(taskId, false);
        showError(failure);
      });
    },
    [reject, setHiddenId, showError],
  );

  const onReject = useCallback(
    (taskId: string) => {
      setHiddenId(taskId, true);
      timers.current.set(taskId, setTimeout(() => send(taskId), SNACKBAR_DURATION_MS));
      snackbar.show({
        message: t('review.rejected'),
        actionLabel: t('common.undo'),
        onAction: () => {
          const timer = timers.current.get(taskId);
          if (timer === undefined) return; // already sent
          clearTimeout(timer);
          timers.current.delete(taskId);
          setHiddenId(taskId, false);
        },
      });
    },
    [send, setHiddenId, snackbar, t],
  );

  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(
    () => () => {
      for (const [taskId, timer] of timers.current) {
        clearTimeout(timer);
        sendRef.current(taskId);
      }
    },
    [],
  );

  return { hidden, onApprove, onReject };
}
