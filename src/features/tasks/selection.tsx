import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export interface TaskSelection {
  active: boolean;
  ids: ReadonlySet<string>;
  /** Enter the selection mode, optionally with a first task (long press). */
  start: (taskId?: string) => void;
  toggle: (taskId: string) => void;
  clear: () => void;
}

const SelectionContext = createContext<TaskSelection | null>(null);

/** Selection state of one screen (spec 9.2 multi-select). SelectionScope (Task 19) adds the action bars. */
export function TaskSelectionProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set());
  const start = useCallback((taskId?: string) => {
    setActive(true);
    setIds(taskId ? new Set([taskId]) : new Set());
  }, []);
  const toggle = useCallback((taskId: string) => {
    setIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);
  const clear = useCallback(() => {
    setActive(false);
    setIds(new Set());
  }, []);
  const value = useMemo(() => ({ active, ids, start, toggle, clear }), [active, ids, start, toggle, clear]);
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

/** null outside a provider (lists that do not offer multi-select, e.g. the sub-tasks of the detail screen). */
export function useTaskSelection(): TaskSelection | null {
  return useContext(SelectionContext);
}
