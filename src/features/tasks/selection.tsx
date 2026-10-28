import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { setSelectionActive } from './selectionActiveStore';

/** `tasks/batch` accepts 1–200 ids (spec 12.5); more → 400. */
export const MAX_BATCH_TASKS = 200;

/** PERM: the task belongs to a team project where I may only complete tasks (Member / Guest). */
export interface SelectOptions {
  completeOnly?: boolean;
}

export interface TaskSelection {
  active: boolean;
  ids: ReadonlySet<string>;
  /** PERM: selected ids (or the whole selection when started so) that only allow Complete — the bar hides the rest. */
  completeOnly: boolean;
  /** Enter the selection mode, optionally with a first task (long press). */
  start: (taskId?: string, options?: SelectOptions) => void;
  toggle: (taskId: string, options?: SelectOptions) => void;
  clear: () => void;
}

const SelectionContext = createContext<TaskSelection | null>(null);

/** Selection state of one screen (spec 9.2 multi-select). SelectionScope (Task 19) adds the action bars. */
export function TaskSelectionProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set());
  // PERM: ids picked from a team project where I only complete tasks; `scopeCompleteOnly` = started so (project screen)
  const [limitedIds, setLimitedIds] = useState<ReadonlySet<string>>(new Set());
  const [scopeCompleteOnly, setScopeCompleteOnly] = useState(false);
  useEffect(() => setSelectionActive(active), [active]);
  const start = useCallback((taskId?: string, options?: SelectOptions) => {
    setActive(true);
    setIds(taskId ? new Set([taskId]) : new Set());
    setLimitedIds(taskId && options?.completeOnly ? new Set([taskId]) : new Set());
    setScopeCompleteOnly(!taskId && options?.completeOnly === true);
  }, []);
  const toggle = useCallback((taskId: string, options?: SelectOptions) => {
    setIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
    if (options?.completeOnly) {
      setLimitedIds((current) => {
        const next = new Set(current);
        if (next.has(taskId)) next.delete(taskId);
        else next.add(taskId);
        return next;
      });
    }
  }, []);
  const clear = useCallback(() => {
    setActive(false);
    setIds(new Set());
    setLimitedIds(new Set());
    setScopeCompleteOnly(false);
  }, []);
  const completeOnly = scopeCompleteOnly || [...limitedIds].some((id) => ids.has(id));
  const value = useMemo(
    () => ({ active, ids, completeOnly, start, toggle, clear }),
    [active, ids, completeOnly, start, toggle, clear],
  );
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

/** null outside a provider (lists that do not offer multi-select, e.g. the sub-tasks of the detail screen). */
export function useTaskSelection(): TaskSelection | null {
  return useContext(SelectionContext);
}
