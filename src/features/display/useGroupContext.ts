import { useMemo } from 'react';
import type { GroupBy } from '../../api/viewOptions';
import { dateKeyInZone } from '../../lib/dates';
import { useNow } from '../../lib/useNow';
import { useUserTimeZone } from '../auth/useUserTimeZone';
import { useLabelMap } from '../labels/useLabels';
import { useProjectNameLabel } from '../projects/useProjectNameLabel';
import type { GroupContext } from './groupTasks';

/** What groupTasks needs; labels are requested only when grouping by label. */
export function useGroupContext(groupBy: GroupBy): GroupContext {
  const timeZone = useUserTimeZone();
  const now = useNow();
  const labels = useLabelMap(groupBy === 'LABEL');
  const projectName = useProjectNameLabel();
  const todayKey = dateKeyInZone(now, timeZone);
  return useMemo(() => ({ todayKey, labels, timeZone, projectName }), [todayKey, labels, timeZone, projectName]);
}
