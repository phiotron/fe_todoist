import { useQuery } from '@tanstack/react-query';
import { isNotFound } from '../../api/describeError';
import { filtersApi, type CreateFilterRequest, type Filter, type UpdateFilterRequest } from '../../api/filters';
import { queryKeys } from '../../api/queryKeys';
import { useDataMutation } from '../../lib/useDataMutation';

const NO_FILTERS: Filter[] = [];

/** Every filter of the user in sort order (≤ 150, one request). */
export function useFilters(enabled = true) {
  const query = useQuery({ queryKey: queryKeys.filters.list(), queryFn: filtersApi.list, enabled });
  return { query, filters: query.data ?? NO_FILTERS };
}

/**
 * Splits a filter query into its lists (POST filters/validate). Disabled for a blank query. A 400 filter-syntax
 * stays in `error` (read the position with filterSyntaxPosition); the same text always parses the same way.
 */
export function useFilterValidation(query: string) {
  return useQuery({
    queryKey: queryKeys.filterValidation(query),
    queryFn: () => filtersApi.validate(query),
    enabled: query.trim().length > 0,
    retry: false,
    staleTime: Infinity,
  });
}

export const useCreateFilter = () =>
  useDataMutation(({ body, idempotencyKey }: { body: CreateFilterRequest; idempotencyKey: string }) =>
    filtersApi.create(body, idempotencyKey),
  );

export const useUpdateFilter = () =>
  useDataMutation(({ id, body }: { id: string; body: UpdateFilterRequest }) => filtersApi.update(id, body));

export const useDeleteFilter = () =>
  useDataMutation(async (id: string) => {
    try {
      await filtersApi.remove(id);
    } catch (error) {
      if (!isNotFound(error)) throw error;
    }
  });

export const useSetFilterFavorite = () =>
  useDataMutation(({ id, favorite }: { id: string; favorite: boolean }) => filtersApi.setFavorite(id, favorite));

export const useReorderFilter = () =>
  useDataMutation(({ id, afterId }: { id: string; afterId: string | null }) => filtersApi.reorder(id, afterId));
