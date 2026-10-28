import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { tasksApi } from '../../api/tasks';
import { dateKeyInZone } from '../../lib/dates';
import { useSession } from '../auth/session';
import { useUserTimeZone } from '../auth/useUserTimeZone';
import { refreshWidgets } from './widgetBridge';
import { buildWidgetSnapshot, saveWidgetSnapshot } from './widgetSnapshot';

/**
 * Keeps what the home-screen widgets show in step with the Today list (M12). Under the "tasks" query root, so every
 * write refreshes it. Only the first page of Today is needed (the widget shows ≤ 10 rows). Renders nothing.
 * Productivity numbers come from M10; until then the snapshot carries none and that widget shows its empty state.
 */
export function WidgetSnapshotWriter({ now = Date.now }: { now?: () => number } = {}) {
  const { status } = useSession();
  const timeZone = useUserTimeZone();
  const today = dateKeyInZone(new Date(now()), timeZone);
  const query = useQuery({
    queryKey: ['tasks', 'widget-today', today],
    queryFn: () => tasksApi.list({ view: 'today', today }, null),
    enabled: status === 'signedIn',
  });
  const items = query.data?.items;

  useEffect(() => {
    if (!items) return;
    const snapshot = buildWidgetSnapshot(items, null, now());
    void saveWidgetSnapshot(snapshot).then(() => refreshWidgets(snapshot));
  }, [items, now]);

  return null;
}
