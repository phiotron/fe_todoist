import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from '../../components/Snackbar';
import { goalStateOf, newlyReached, type GoalState } from './celebration';
import { useProductivity } from './useProductivity';

/**
 * Goal celebrations (M10): mounted once in the signed-in layout, renders nothing. Every data write invalidates
 * GET productivity (DATA_ROOTS), so this observer sees the new numbers; when a goal flips to "reached" and the user keeps
 * "Goal celebrations" on, a toast congratulates them. A failed / offline request just means no toast.
 */
export function GoalCelebrationHost() {
  const { t } = useTranslation();
  const snackbar = useSnackbar();
  const { data } = useProductivity();
  const previous = useRef<GoalState | null>(null);

  useEffect(() => {
    if (!data) return;
    const next = goalStateOf(data);
    const reached = newlyReached(previous.current, next);
    previous.current = next;
    if (!data.goalCelebrations) return;
    // Both at once: the weekly message is the bigger news.
    if (reached.weekly) snackbar.show({ message: t('productivity.celebrate.weekly') });
    else if (reached.daily) snackbar.show({ message: t('productivity.celebrate.daily') });
  }, [data, snackbar, t]);

  return null;
}
