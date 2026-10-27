import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { describeError, isNotFound, isVersionConflict } from '../../../api/describeError';
import type { Task } from '../../../api/models';
import { queryKeys } from '../../../api/queryKeys';
import { tasksApi } from '../../../api/tasks';
import { useUpdateTask } from '../useTaskActions';
import { descriptionError, taskContentError } from '../validation';
import { draftChanges, draftFromTask, sameEditableFields, type TaskDraft } from './draft';
import { useTask } from './useTask';

function isTask(value: unknown): value is Task {
  return typeof value === 'object' && value !== null && typeof (value as Task).id === 'string' && typeof (value as Task).version === 'number';
}

export interface EditorErrors {
  content?: string;
  description?: string;
  form?: string;
}

/**
 * Editing logic of the detail screen (spec 5.6, Quyết định #13): a local draft, saved by `commit()` — chips pass their
 * change (`commit({ priority: 1 })`), text fields call `commit()` on blur and the hook saves once more when the screen
 * closes. Saves run one after the other, each against the newest server copy, so quick changes never overwrite each
 * other; a 409 keeps the draft and waits for `keepMine()` / `acceptLatest()`.
 */
export function useTaskEditor(taskId: string) {
  const queryClient = useQueryClient();
  const taskQuery = useTask(taskId);
  const task = taskQuery.data;
  const update = useUpdateTask();
  const [base, setBaseState] = useState<Task | null>(null);
  const [draft, setDraftState] = useState<TaskDraft | null>(null);
  const [conflict, setConflictState] = useState(false);
  const [gone, setGone] = useState(false);
  const [errors, setErrors] = useState<EditorErrors>({});
  // The refs are the source of truth inside async code (a save may finish after the screen re-rendered).
  const store = useRef<{ base: Task | null; draft: TaskDraft | null; conflict: boolean }>({ base: null, draft: null, conflict: false });
  const chain = useRef<Promise<void>>(Promise.resolve());

  const setBase = (value: Task | null) => {
    store.current.base = value;
    setBaseState(value);
  };
  const setDraft = (value: TaskDraft | null) => {
    store.current.draft = value;
    setDraftState(value);
  };
  const setConflict = (value: boolean) => {
    store.current.conflict = value;
    setConflictState(value);
  };

  // Follow the server copy while nothing is unsaved, or when only non-editable fields moved (completion, counts).
  useEffect(() => {
    if (!task) return;
    const { base: current, draft: typing, conflict: open } = store.current;
    if (!current || !typing) {
      setBase(task);
      setDraft(draftFromTask(task));
      return;
    }
    if (open || task.version === current.version) return;
    if (Object.keys(draftChanges(current, typing)).length === 0) {
      setBase(task);
      setDraft(draftFromTask(task));
    } else if (sameEditableFields(task, current)) {
      setBase(task);
    }
  }, [task]); // eslint-disable-line react-hooks/exhaustive-deps

  const { mutateAsync } = update;
  const persist = useCallback(async () => {
    const { base: current, draft: typing, conflict: open } = store.current;
    if (!current || !typing || open) return;
    const contentProblem = taskContentError(typing.content);
    const descriptionProblem = descriptionError(typing.description);
    if (contentProblem || descriptionProblem) {
      setErrors({ content: contentProblem, description: descriptionProblem });
      return;
    }
    const changes = draftChanges(current, typing);
    if (Object.keys(changes).length === 0) return;
    try {
      const saved = await mutateAsync({ taskId, body: { version: current.version, ...changes } });
      queryClient.setQueryData(queryKeys.tasks.detail(taskId), saved);
      setBase(saved);
      setErrors({});
    } catch (failure) {
      if (isVersionConflict(failure)) {
        // Spec 5.6: keep what the user typed, load the latest copy, let them choose. The backend's 409 for a stale
        // `version` carries `current` (contract, Task 30); only a 409 from a DB race has none, so without a usable one
        // the latest copy is fetched before the banner opens.
        let latest = isTask(failure.current) ? failure.current : undefined;
        let refetchFailure: unknown;
        if (!latest) {
          try {
            latest = await queryClient.fetchQuery({ queryKey: queryKeys.tasks.detail(taskId), queryFn: () => tasksApi.get(taskId), staleTime: 0 });
          } catch (error) {
            refetchFailure = error;
          }
        } else {
          queryClient.setQueryData(queryKeys.tasks.detail(taskId), latest);
        }
        if (refetchFailure && isNotFound(refetchFailure)) {
          setGone(true);
          return;
        }
        if (latest) setBase(latest);
        setConflict(true);
        setErrors(refetchFailure ? { form: describeError(refetchFailure).message } : {});
      } else if (isNotFound(failure)) {
        setGone(true);
      } else {
        const view = describeError(failure);
        setErrors({ content: view.fields.content, description: view.fields.description, form: view.message });
      }
    }
  }, [taskId, mutateAsync, queryClient]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Typing: only the draft changes (nothing is sent until blur / commit). */
  const edit = useCallback((patch: Partial<TaskDraft>) => {
    const current = store.current.draft;
    if (current) setDraft({ ...current, ...patch });
    setErrors({});
  }, []);

  /** Apply `patch` to the draft (if given) and save the difference; resolves when this save is finished. */
  const commit = useCallback(
    (patch?: Partial<TaskDraft>) => {
      const current = store.current.draft;
      if (patch && current) setDraft({ ...current, ...patch });
      chain.current = chain.current.then(persist);
      return chain.current;
    },
    [persist],
  );

  const keepMine = useCallback(() => {
    setConflict(false);
    return commit();
  }, [commit]);

  const acceptLatest = useCallback(() => {
    const latest = store.current.base;
    if (latest) setDraft(draftFromTask(latest));
    setConflict(false);
    setErrors({});
  }, []);

  // Leaving the screen saves what was typed but not blurred yet (a 409 then is dropped: the screen is gone).
  useEffect(
    () => () => {
      void persist();
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return {
    taskQuery,
    task,
    base,
    draft,
    conflict,
    gone: gone || (taskQuery.error !== null && isNotFound(taskQuery.error)),
    errors,
    edit,
    commit,
    keepMine,
    acceptLatest,
  };
}
