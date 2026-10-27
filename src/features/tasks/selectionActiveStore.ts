import { useSyncExternalStore } from 'react';

/**
 * True while any screen is in the multi-select mode. The + button lives in the tabs layout, outside every screen's
 * TaskSelectionProvider, so it learns about the mode through this flag (it hides: it would cover the action bar).
 */
let activeScreens = 0;
const listeners = new Set<() => void>();

export function setSelectionActive(active: boolean): () => void {
  if (!active) return () => undefined;
  activeScreens += 1;
  listeners.forEach((listener) => listener());
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeScreens -= 1;
    listeners.forEach((listener) => listener());
  };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const read = () => activeScreens > 0;

export function useAnySelectionActive(): boolean {
  return useSyncExternalStore(subscribe, read, read);
}
