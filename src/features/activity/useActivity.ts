import { activityApi, type ActivityItem, type ActivityParams } from '../../api/activity';
import { queryKeys } from '../../api/queryKeys';
import { usePagedList } from '../../lib/usePagedList';
import { activityItemId } from './activityModel';

/** One paged Activity log (newest first); `items` = all loaded pages, de-duplicated. */
export function useActivity(params: ActivityParams) {
  const { query, items } = usePagedList<ActivityItem>(
    queryKeys.activity.list(params),
    (cursor) => activityApi.list(params, cursor ?? undefined),
    activityItemId,
  );
  return { query, items };
}
