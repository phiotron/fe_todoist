import { useTranslation } from 'react-i18next';
import { describeError } from '../api/describeError';
import { TaskSkeletonList } from './Skeleton';
import { StateView } from './StateView';

export interface QueryStatusLike {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  fetchStatus: string;
  refetch: () => unknown;
}

/**
 * Placeholder while a query has no data: loading → skeleton (M-Loading); offline with nothing cached (paused) →
 * offline state instead of an endless spinner (M0 debt); error → M-Error state + "Thử lại". Nothing otherwise.
 */
export function QueryStateView({ query, testID = 'query-state' }: { query: QueryStatusLike; testID?: string }) {
  const { t } = useTranslation();
  if (query.isPending && query.fetchStatus === 'paused') {
    return <StateView tone="error" icon="wifi-off" title={t('errors.offline')} testID={`${testID}-offline`} />;
  }
  if (query.isPending) return <TaskSkeletonList testID={`${testID}-loading`} />;
  if (query.isError) {
    return (
      <StateView
        tone="error"
        icon="alert-circle"
        title={t('common.loadErrorTitle')}
        message={describeError(query.error).message}
        actionLabel={t('common.retry')}
        onAction={() => void query.refetch()}
        testID={testID}
      />
    );
  }
  return null;
}
