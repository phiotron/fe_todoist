import { useEffect, useState } from 'react';

/** The longest the background hosts wait for an idle moment of the JS thread (a long scroll / animation can hold it back). */
export const AFTER_INTERACTIONS_MAX_WAIT_MS = 1_500;

/** Once the app has been "settled" in this run, a host that mounts later (sign-out / sign-in) starts at once. */
let settled = false;

/** Test hook: back to the cold-start state. */
export function resetAfterInteractionsForTests(): void {
  settled = false;
}

/**
 * PERF3: false while the first screen is being drawn and animated, true afterwards (or after
 * AFTER_INTERACTIONS_MAX_WAIT_MS at the latest). The background hosts of the signed-in layout (push token, widgets, goal
 * toast, geofences, the first reminder re-plan) wait for it so their requests and native calls do not compete with the
 * first screen for the single JS thread and the radio on a weak phone.
 */
export function useAfterInteractions(): boolean {
  const [ready, setReady] = useState(settled);
  useEffect(() => {
    if (settled) {
      setReady(true);
      return undefined;
    }
    const open = () => {
      settled = true;
      setReady(true);
    };
    // RN 0.88 removed InteractionManager: requestIdleCallback (global in RN) runs when the JS thread has nothing to draw.
    const idle = globalThis.requestIdleCallback;
    if (typeof idle !== 'function') {
      const timer = setTimeout(open, 0);
      return () => clearTimeout(timer);
    }
    const handle = idle(open, { timeout: AFTER_INTERACTIONS_MAX_WAIT_MS });
    return () => globalThis.cancelIdleCallback?.(handle);
  }, []);
  return ready;
}
