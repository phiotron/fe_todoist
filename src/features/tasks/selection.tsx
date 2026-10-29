import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
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

/**
 * Perf: a row only needs to know whether the mode is on and whether ITS task is picked. Reading the whole TaskSelection
 * through context redrew every row (299 on a project) on each tap; this store tells a row only when its own answer
 * changes (useSyncExternalStore on a number: 2 = mode on, +1 = this task selected).
 */
interface RowSelectionStore {
  set: (active: boolean, ids: ReadonlySet<string>) => void;
  subscribe: (listener: () => void) => () => void;
  snapshot: (taskId: string) => number;
}
interface RowSelectionValue {
  store: RowSelectionStore;
  start: TaskSelection['start'];
  toggle: TaskSelection['toggle'];
}
const RowSelectionContext = createContext<RowSelectionValue | null>(null);

function createRowSelectionStore(): RowSelectionStore {
  let active = false;
  let ids: ReadonlySet<string> = new Set();
  const listeners = new Set<() => void>();
  return {
    set: (nextActive, nextIds) => {
      if (nextActive === active && nextIds === ids) return;
      active = nextActive;
      ids = nextIds;
      for (const listener of [...listeners]) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot: (taskId) => (active ? 2 : 0) + (ids.has(taskId) ? 1 : 0),
  };
}

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
  const store = useRef<RowSelectionStore | null>(null);
  if (!store.current) store.current = createRowSelectionStore();
  useLayoutEffect(() => store.current?.set(active, ids), [active, ids]);
  const rowValue = useMemo(() => ({ store: store.current as RowSelectionStore, start, toggle }), [start, toggle]);
  return (
    <SelectionContext.Provider value={value}>
      <RowSelectionContext.Provider value={rowValue}>{children}</RowSelectionContext.Provider>
    </SelectionContext.Provider>
  );
}

/** null outside a provider (lists that do not offer multi-select, e.g. the sub-tasks of the detail screen). */
export function useTaskSelection(): TaskSelection | null {
  return useContext(SelectionContext);
}

const NO_SUBSCRIBE = () => () => undefined;

/**
 * What a TaskRow needs from the selection: `api` (null outside a provider), `selecting` (mode on) and `selected` (this
 * task picked). Redraws the row only when `selecting` / `selected` change for it.
 */
export function useRowSelection(taskId: string): { api: Pick<TaskSelection, 'start' | 'toggle'> | null; selecting: boolean; selected: boolean } {
  const value = useContext(RowSelectionContext);
  const code = useSyncExternalStore(value ? value.store.subscribe : NO_SUBSCRIBE, () => (value ? value.store.snapshot(taskId) : 0));
  const api = useMemo(() => (value ? { start: value.start, toggle: value.toggle } : null), [value]);
  return { api, selecting: code >= 2, selected: code % 2 === 1 };
}
