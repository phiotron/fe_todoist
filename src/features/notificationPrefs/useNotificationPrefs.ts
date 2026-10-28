import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { describeError } from '../../api/describeError';
import {
  notificationPrefsApi,
  type NotificationPrefsResponse,
  type UpdateNotificationPrefsRequest,
} from '../../api/notificationPrefs';
import { queryKeys } from '../../api/queryKeys';
import { useSnackbar } from '../../components/Snackbar';

export type NotificationPrefKey = keyof NotificationPrefsResponse;

const MUTATION_KEY = ['notificationPrefs', 'update'] as const;

interface UpdateContext {
  /** Values of the changed fields before the optimistic write. */
  previous: UpdateNotificationPrefsRequest;
}

/**
 * GET me/notification-prefs plus an optimistic `toggle`: the switch flips at once; on failure only the fields of that
 * request go back (another switch saved meanwhile keeps its value) and an error toast says why.
 */
export function useNotificationPrefs() {
  const queryClient = useQueryClient();
  const snackbar = useSnackbar();
  const queryKey = queryKeys.notificationPrefs.all;
  const query = useQuery({ queryKey, queryFn: notificationPrefsApi.get });

  const mutation = useMutation<NotificationPrefsResponse, unknown, UpdateNotificationPrefsRequest, UpdateContext>({
    mutationKey: MUTATION_KEY,
    mutationFn: (patch) => notificationPrefsApi.update(patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey });
      const current = queryClient.getQueryData<NotificationPrefsResponse>(queryKey);
      const previous: UpdateNotificationPrefsRequest = {};
      if (current) {
        for (const key of Object.keys(patch) as NotificationPrefKey[]) previous[key] = current[key];
        queryClient.setQueryData<NotificationPrefsResponse>(queryKey, { ...current, ...patch });
      }
      return { previous };
    },
    onError: (error, _patch, context) => {
      if (context) {
        queryClient.setQueryData<NotificationPrefsResponse>(queryKey, (current) =>
          current ? { ...current, ...context.previous } : current,
        );
      }
      snackbar.show({ message: describeError(error).message, tone: 'error' });
    },
    onSuccess: (prefs) => {
      // The answer of the last save still running is the truth; an earlier one may predate a newer toggle.
      if (queryClient.isMutating({ mutationKey: MUTATION_KEY }) <= 1) queryClient.setQueryData(queryKey, prefs);
    },
  });

  const { mutate } = mutation;
  const toggle = useCallback((key: NotificationPrefKey, value: boolean) => mutate({ [key]: value }), [mutate]);

  return { query, prefs: query.data, toggle };
}
