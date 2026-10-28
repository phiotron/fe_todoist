import { useEffect, useRef, useState } from 'react';
import type { SyncStatus } from '../../lib/sync/types';

export interface SyncPillView {
  syncing: boolean;
  pending: number;
}

export interface SyncPillTiming {
  /** The engine must be busy (sending, or changes waiting) this long before the pill shows. */
  showDelayMs?: number;
  /** Once shown, the pill stays at least this long (no flash when the run ends just after the delay). */
  minVisibleMs?: number;
}

export const PILL_SHOW_DELAY_MS = 1000;
export const PILL_MIN_VISIBLE_MS = 600;

/**
 * What the sync pill shows (PERF): null while hidden. A short background run (a pull on open, a write sent in a few
 * hundred ms) never shows the pill — it used to flash "Đang đồng bộ…" on every run. Offline it hides at once (the
 * offline banner carries the count).
 */
export function useSyncPill(status: SyncStatus, connected: boolean, timing: SyncPillTiming = {}): SyncPillView | null {
  const showDelayMs = timing.showDelayMs ?? PILL_SHOW_DELAY_MS;
  const minVisibleMs = timing.minVisibleMs ?? PILL_MIN_VISIBLE_MS;
  const busy = connected && (status.syncing || status.pending > 0);
  const [visible, setVisible] = useState(false);
  const shownAt = useRef(0);
  const lastBusy = useRef<SyncPillView>({ syncing: true, pending: 0 });

  useEffect(() => {
    if (busy && !visible) {
      const timer = setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
      }, showDelayMs);
      return () => clearTimeout(timer);
    }
    if (!busy && visible) {
      if (!connected) {
        setVisible(false);
        return undefined;
      }
      const timer = setTimeout(() => setVisible(false), Math.max(0, shownAt.current + minVisibleMs - Date.now()));
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [busy, visible, connected, showDelayMs, minVisibleMs]);

  if (!visible || !connected) return null;
  // Lingering after the run ended: keep the last busy label rather than "0 changes waiting".
  if (busy) lastBusy.current = { syncing: status.syncing, pending: status.pending };
  return lastBusy.current;
}
