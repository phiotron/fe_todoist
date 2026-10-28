import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/errors';
import { invalidateData, type InvalidateOptions } from '../api/queryKeys';
import { assertOnline } from './queryClient';
import { isOfflineWritesEnabled } from './useIsOnline';

/** Statuses after which the cached lists are known to be wrong (item gone, changed, archived, limit). */
const REFRESH_ON_ERROR = new Set([404, 409, 422]);

/**
 * Standard write: refuses to run offline (never queued), refreshes data queries afterwards.
 * Screens keep their form state on error; describeError(mutation.error) gives the message.
 * `options.keepDetail` (reorder only): do not refresh `tasks.detail` — the version did not change (spec 3.1).
 */
export function useDataMutation<TVariables, TData = unknown>(
  write: (variables: TVariables) => Promise<TData>,
  options: InvalidateOptions = {},
) {
  const queryClient = useQueryClient();
  const { keepDetail } = options;
  return useMutation<TData, unknown, TVariables>({
    mutationFn: async (variables) => {
      // M9: with the offline queue on, the request layer decides (queue it or answer OfflineError).
      if (!isOfflineWritesEnabled()) assertOnline();
      return write(variables);
    },
    onSuccess: () => {
      void invalidateData(queryClient, { keepDetail });
    },
    onError: (error) => {
      // A failed write may still mean the lists are stale (404 / 409 / 422).
      if (error instanceof ApiError && REFRESH_ON_ERROR.has(error.status)) void invalidateData(queryClient, { keepDetail });
    },
  });
}
