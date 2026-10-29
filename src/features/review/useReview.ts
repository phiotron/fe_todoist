import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { describeError } from '../../api/describeError';
import type { Task } from '../../api/models';
import { projectsApi } from '../../api/projects';
import { queryKeys } from '../../api/queryKeys';
import { reviewApi } from '../../api/review';
import { applyTaskChange } from '../../api/taskCache';
import { tasksApi } from '../../api/tasks';
import { workspacesApi, type WorkspaceMemberResponse } from '../../api/workspaces';
import { useSnackbar } from '../../components/Snackbar';
import { useDataMutation } from '../../lib/useDataMutation';
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

interface BatchResult {
  done: Task[];
  failures: { task: Task; error: unknown }[];
}

/**
 * Runs `send` for each task ONE AFTER ANOTHER (never n requests at once). Offline each call is queued by the sync
 * interceptor in this very order (reject, then restore); online each one waits for the previous. One task failing does
 * not stop the others. Used inside ONE data mutation, so the lists are refreshed once for the whole batch.
 */
async function runEach(tasks: readonly Task[], send: (task: Task) => Promise<unknown>): Promise<BatchResult> {
  const result: BatchResult = { done: [], failures: [] };
  for (const task of tasks) {
    try {
      await send(task);
      result.done.push(task);
    } catch (error) {
      result.failures.push({ task, error });
    }
  }
  return result;
}

/** Undo of a return needs who asked and when (kept from the task BEFORE it was returned). */
function restorable(task: Task): task is Task & { reviewRequestedBy: string; reviewRequestedAt: string } {
  return !!task.reviewRequestedBy && !!task.reviewRequestedAt;
}

/**
 * Admin actions on one or many tasks (a single row is a batch of one). Both go at once, no deferral:
 *  - Approve: Undo = reopen the tasks just approved.
 *  - Return: Undo = `task_review_restore` (real undo, back to PENDING with the original requester / time).
 * Rows are hidden while the request runs; a failed one comes back and its message is shown.
 */
export function useReviewActions() {
  const { t } = useTranslation();
  const snackbar = useSnackbar();
  const queryClient = useQueryClient();
  const approve = useDataMutation((tasks: readonly Task[]) => runEach(tasks, (task) => reviewApi.approve(task.id))).mutateAsync;
  const reject = useDataMutation((tasks: readonly Task[]) => runEach(tasks, (task) => reviewApi.reject(task.id))).mutateAsync;
  const restore = useDataMutation((tasks: readonly Task[]) =>
    runEach(tasks.filter(restorable), (task) =>
      reviewApi.restore(task.id, { requestedBy: task.reviewRequestedBy as string, requestedAt: task.reviewRequestedAt as string }),
    ),
  ).mutateAsync;
  const reopen = useDataMutation((tasks: readonly Task[]) =>
    runEach(tasks, async (task) => applyTaskChange(queryClient, await tasksApi.reopen(task.id))),
  ).mutateAsync;
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());

  const setHiddenTasks = useCallback((tasks: readonly Task[], value: boolean) => {
    if (tasks.length === 0) return;
    setHidden((previous) => {
      const next = new Set(previous);
      for (const task of tasks) {
        if (value) next.add(task.id);
        else next.delete(task.id);
      }
      return next;
    });
  }, []);
  const showError = useCallback(
    (failure: unknown) => snackbar.show({ message: describeError(failure).message, tone: 'error' }),
    [snackbar],
  );

  /** Undo step shared by both: run `undo` on the tasks, show the first failure (409 `review-not-restorable` ...). */
  const undoWith = useCallback(
    (undo: (tasks: readonly Task[]) => Promise<BatchResult>, tasks: readonly Task[], showBack: boolean) => {
      undo(tasks).then(
        (result) => {
          if (showBack) setHiddenTasks(result.done, false);
          if (result.failures.length > 0) showError(result.failures[0].error);
        },
        showError,
      );
    },
    [setHiddenTasks, showError],
  );

  const run = useCallback(
    async (tasks: readonly Task[], kind: 'approve' | 'reject') => {
      if (tasks.length === 0) return;
      setHiddenTasks(tasks, true);
      let result: BatchResult;
      try {
        result = await (kind === 'approve' ? approve : reject)(tasks);
      } catch (failure) {
        setHiddenTasks(tasks, false);
        showError(failure);
        return;
      }
      setHiddenTasks(result.failures.map((failure) => failure.task), false);
      if (result.done.length === 0) {
        if (result.failures.length > 0) showError(result.failures[0].error);
        return;
      }
      const single = result.done.length === 1;
      const approving = kind === 'approve';
      const undoable = approving ? result.done : result.done.filter(restorable);
      const message = approving
        ? single ? t('review.approved') : t('review.approvedMany', { n: result.done.length })
        : single ? t('review.rejected') : t('review.rejectedMany', { n: result.done.length });
      snackbar.show({
        message,
        ...(undoable.length > 0
          ? { actionLabel: t('common.undo'), onAction: () => undoWith(approving ? reopen : restore, undoable, !approving) }
          : {}),
      });
      if (result.failures.length > 0) showError(result.failures[0].error);
    },
    [approve, reject, reopen, restore, setHiddenTasks, showError, snackbar, t, undoWith],
  );

  const approveTasks = useCallback((tasks: readonly Task[]) => void run(tasks, 'approve'), [run]);
  const rejectTasks = useCallback((tasks: readonly Task[]) => void run(tasks, 'reject'), [run]);
  const onApprove = useCallback((task: Task) => approveTasks([task]), [approveTasks]);
  const onReject = useCallback((task: Task) => rejectTasks([task]), [rejectTasks]);

  return { hidden, onApprove, onReject, approveTasks, rejectTasks };
}

/** Multi-select state of the review screen (long press / "Chọn"). Plain state, one per screen, nothing per row. */
export function useReviewSelection() {
  const [selecting, setSelecting] = useState(false);
  const [ids, setIds] = useState<ReadonlySet<string>>(() => new Set());
  const start = useCallback((taskId?: string) => {
    setSelecting(true);
    setIds(new Set(taskId ? [taskId] : []));
  }, []);
  const toggle = useCallback((taskId: string) => {
    setIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);
  const selectAll = useCallback((all: readonly string[]) => setIds(new Set(all)), []);
  const clear = useCallback(() => {
    setSelecting(false);
    setIds(new Set());
  }, []);
  return { selecting, ids, start, toggle, selectAll, clear };
}
