import { useQuery } from '@tanstack/react-query';
import { productivityApi } from '../../api/productivity';
import { queryKeys } from '../../api/queryKeys';

/** GET productivity: every data write invalidates it (queryKeys DATA_ROOTS), so the open screen refetches. */
export function useProductivity(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.productivity.get(),
    queryFn: productivityApi.get,
    enabled: options.enabled ?? true,
  });
}
