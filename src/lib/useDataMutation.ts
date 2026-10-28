import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addWriteObserver } from '../api/client';
import { ApiError } from '../api/errors';
import type { InvalidateOptions } from '../api/queryKeys';
import { DATA_WRITE_META, requestReminderSyncAfterWrite } from '../features/reminders/syncSignal';
import { assertOnline } from './queryClient';
import { impactOfWrite, invalidateRoots, mergeImpacts, type WriteImpact } from './sync/invalidation';
import { isOfflineWritesEnabled } from './useIsOnline';

/** Statuses after which the cached lists are known to be wrong (item gone, changed, archived, limit). */
const REFRESH_ON_ERROR = new Set([404, 409, 422]);

/**
 * PERF: the write requests sent while a data mutation runs. Every running mutation collects every write request of its
 * window: two writes at once can only refresh MORE (the union), never less. A mutation that sent nothing through
 * apiFetch refreshes every data root, as before.
 */
const collecting = new Set<WriteImpact[]>();
addWriteObserver((method, path, body) => {
  if (collecting.size === 0) return;
  const impact = impactOfWrite(method, path, body);
  collecting.forEach((impacts) => impacts.push(impact));
});

/**
 * Standard write: refuses to run offline (never queued), refreshes data queries afterwards.
 * Screens keep their form state on error; describeError(mutation.error) gives the message.
 * `options.keepDetail` (reorder only): do not refresh `tasks.detail` — the version did not change (spec 3.1).
 * PERF: only the query roots the sent request(s) can change are refreshed (sync/invalidation.ts), and the device
 * reminders are re-planned only when the write can move one.
 */
export function useDataMutation<TVariables, TData = unknown>(
  write: (variables: TVariables) => Promise<TData>,
  options: InvalidateOptions = {},
) {
  const queryClient = useQueryClient();
  const { keepDetail } = options;
  return useMutation<TData, unknown, TVariables>({
    meta: DATA_WRITE_META,
    mutationFn: async (variables) => {
      // M9: with the offline queue on, the request layer decides (queue it or answer OfflineError).
      if (!isOfflineWritesEnabled()) assertOnline();
      const impacts: WriteImpact[] = [];
      collecting.add(impacts);
      try {
        const data = await write(variables);
        const impact = mergeImpacts(impacts);
        void invalidateRoots(queryClient, impact.roots, { keepDetail });
        if (impact.reminders) requestReminderSyncAfterWrite();
        return data;
      } catch (error) {
        // A failed write may still mean the lists are stale (404 / 409 / 422).
        if (error instanceof ApiError && REFRESH_ON_ERROR.has(error.status)) {
          void invalidateRoots(queryClient, mergeImpacts(impacts).roots, { keepDetail });
        }
        throw error;
      } finally {
        collecting.delete(impacts);
      }
    },
  });
}
