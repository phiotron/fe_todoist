import { useQuery, useQueryClient } from '@tanstack/react-query';
import { describeError } from '../../api/describeError';
import { ApiError } from '../../api/errors';
import { locationsApi, type CreateLocationRequest, type LocationResponse } from '../../api/locations';
import { useDataMutation } from '../../lib/useDataMutation';

/** Not under a data root: saved places change only through the mutations below, which refresh this key themselves. */
export const locationsKey = ['locations', 'list'] as const;

/** `enabled = false` does not fetch (the reminder chips load places only once they are needed). */
export function useLocations(enabled = true) {
  return useQuery({ queryKey: locationsKey, queryFn: locationsApi.list, enabled });
}

/**
 * Create / remove a saved place (offline-blocked like every write). Removing one also removes its reminders on the
 * server, which useDataMutation's refresh of the "tasks" queries picks up (location reminders re-sync from there).
 */
export function useLocationMutations() {
  const queryClient = useQueryClient();
  const create = useDataMutation((body: CreateLocationRequest) => locationsApi.create(body));
  const remove = useDataMutation(async (locationId: string) => {
    try {
      await locationsApi.remove(locationId);
    } catch (error) {
      // Already gone elsewhere = removed.
      if (!(error instanceof ApiError && error.status === 404)) throw error;
    }
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: locationsKey });

  const createPlace = async (body: CreateLocationRequest): Promise<LocationResponse | null> => {
    create.reset();
    remove.reset();
    try {
      const created = await create.mutateAsync(body);
      await refresh();
      return created;
    } catch {
      return null; // shown through `error`
    }
  };
  const removePlace = async (locationId: string): Promise<boolean> => {
    create.reset();
    remove.reset();
    try {
      await remove.mutateAsync(locationId);
      await refresh();
      return true;
    } catch {
      return false;
    }
  };

  const failure = create.error ?? remove.error;
  return {
    createPlace,
    removePlace,
    busy: create.isPending || remove.isPending,
    error: failure ? describeError(failure).message : undefined,
  };
}
