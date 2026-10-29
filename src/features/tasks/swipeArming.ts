import { useEffect, useState } from 'react';

type Setter = (armed: boolean) => void;

/**
 * Perf: a task row's swipe (ReanimatedSwipeable) costs 8 shared values, 3 animated styles, 2 native gesture handlers and
 * ~9 views per row. Mounting that for every row a fast scroll brings into the FlatList window is what makes the UI
 * thread miss frames, so a list hands out the gesture only to rows that have SETTLED in view (FlatList
 * onViewableItemsChanged with minimumViewTime): rows drawn while scrolling are plain pressable rows.
 * Before the list reports a layout (first draw, tests) every row is armed at once, exactly as before.
 */
export interface SwipeArming {
  setLayoutKnown: () => void;
  /** Arm the rows with these keys (the whole currently-settled set); rows drawn later while settled arm themselves. */
  setViewable: (keys: readonly string[]) => void;
  /** A finger is down on the list: a row is never swapped under it, arming waits for the touch to end. */
  setTouching: (touching: boolean) => void;
  initiallyArmed: () => boolean;
  register: (id: string, setter: Setter) => () => void;
}

export function createSwipeArming(): SwipeArming {
  let layoutKnown = false;
  let touching = false;
  let viewable = new Set<string>();
  const setters = new Map<string, Setter>();
  let pending = false;
  const flush = () => {
    pending = false;
    for (const id of viewable) setters.get(id)?.(true);
  };
  return {
    setLayoutKnown: () => {
      layoutKnown = true;
    },
    setViewable: (keys) => {
      viewable = new Set(keys);
      if (touching) pending = true;
      else flush();
    },
    setTouching: (next) => {
      touching = next;
      if (!next && pending) flush();
    },
    initiallyArmed: () => !layoutKnown,
    register: (id, setter) => {
      setters.set(id, setter);
      if (!touching && viewable.has(id)) setter(true);
      return () => {
        if (setters.get(id) === setter) setters.delete(id);
      };
    },
  };
}

/** Whether this row mounts its swipe gesture. Without a list's arming (a row on its own) always true. */
export function useSwipeArmed(arming: SwipeArming | null | undefined, id: string): boolean {
  const [armed, setArmed] = useState(() => (arming ? arming.initiallyArmed() : true));
  useEffect(() => (arming && !armed ? arming.register(id, setArmed) : undefined), [arming, id, armed]);
  return armed;
}
