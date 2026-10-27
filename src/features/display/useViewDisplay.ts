import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { queryKeys } from '../../api/queryKeys';
import { viewOptionsApi, type ViewKey, type ViewOptions } from '../../api/viewOptions';
import { useDataMutation } from '../../lib/useDataMutation';
import { isDefaultViewOptions, resolveViewOptions, toDisplayParams, toViewOptionsBody } from './displayRules';

export type DisplayPatch = Partial<Omit<ViewOptions, 'viewKey'>>;

/**
 * Display of one view (spec 12.7): read from GET view-options (one list for every view), applied at once by an
 * optimistic cache write, saved with PUT; reset = DELETE. `ready` = the saved list is known, failed, or cannot
 * load (offline without cache) — screens wait for it so each task list is fetched once with the right params.
 */
export function useViewDisplay(viewKey: ViewKey) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: queryKeys.viewOptions.list(), queryFn: viewOptionsApi.list });
  const options = useMemo(() => resolveViewOptions(viewKey, query.data), [viewKey, query.data]);
  const params = useMemo(() => toDisplayParams(options), [options]);
  const ready = query.isSuccess || query.isError || query.fetchStatus === 'paused';

  const saveMutation = useDataMutation((next: ViewOptions) => viewOptionsApi.save(viewKey, toViewOptionsBody(next)));
  const resetMutation = useDataMutation((_: void) => viewOptionsApi.reset(viewKey));
  const saveMutate = saveMutation.mutate;
  const resetMutate = resetMutation.mutate;

  const writeCache = useCallback(
    (next: ViewOptions | null) => {
      queryClient.setQueryData<ViewOptions[]>(queryKeys.viewOptions.list(), (old) => {
        const others = (old ?? []).filter((item) => item.viewKey !== viewKey);
        return next ? [...others, next] : others;
      });
    },
    [queryClient, viewKey],
  );

  const reloadOnError = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.viewOptions.all });
  }, [queryClient]);

  const save = useCallback(
    (patch: DisplayPatch) => {
      const next: ViewOptions = { ...options, ...patch, viewKey };
      writeCache(next);
      saveMutate(next, { onError: reloadOnError });
    },
    [options, viewKey, writeCache, saveMutate, reloadOnError],
  );

  const reset = useCallback(() => {
    writeCache(null);
    resetMutate(undefined, { onError: reloadOnError });
  }, [writeCache, resetMutate, reloadOnError]);

  return {
    options,
    params,
    ready,
    save,
    reset,
    isDefault: isDefaultViewOptions(viewKey, options),
    error: saveMutation.error ?? resetMutation.error ?? null,
  };
}

export type ViewDisplay = ReturnType<typeof useViewDisplay>;
