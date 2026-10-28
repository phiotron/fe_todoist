import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { describeError } from '../../api/describeError';
import { queryKeys } from '../../api/queryKeys';
import { useSnackbar } from '../../components/Snackbar';
import type { SettingsPatch } from '../settings/settingsModel';
import { useSettings } from '../settings/useSettings';

/** Saves Productivity settings (goals, days off, vacation…) through me/settings, then refreshes Productivity; a failure goes to the snackbar. */
export function useGoalEditor() {
  const { update } = useSettings();
  const queryClient = useQueryClient();
  const snackbar = useSnackbar();
  return useCallback(
    (patch: SettingsPatch) => {
      update(patch).then(
        () => void queryClient.invalidateQueries({ queryKey: queryKeys.productivity.all }),
        (failure: unknown) => snackbar.show({ message: describeError(failure).message, tone: 'error' }),
      );
    },
    [update, queryClient, snackbar],
  );
}

