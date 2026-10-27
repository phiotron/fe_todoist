import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { settingsApi } from '../../api/settings';
import i18n from '../../i18n';
import { useSession } from '../auth/session';
import { useSettingsContext, type SettingsContextValue } from './SettingsProvider';
import { defaultSettings, normalizeSettings, type SettingsPatch } from './settingsModel';

export type SettingsState = SettingsContextValue;

export const settingsQueryKey = ['settings'] as const;

/**
 * Account settings (spec 9.3). Inside <SettingsProvider> — the whole app — they are cached on the device, applied
 * at once and kept when a save fails. Without the provider (isolated component tests of later milestones) it falls
 * back to a plain query of GET me/settings and a PATCH of the changed fields.
 */
export function useSettings(): SettingsState {
  const context = useSettingsContext();
  const { status } = useSession();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: settingsQueryKey,
    queryFn: settingsApi.get,
    enabled: context === null && status === 'signedIn',
  });
  const update = useCallback(
    async (patch: SettingsPatch) => {
      queryClient.setQueryData(settingsQueryKey, await settingsApi.update(patch));
    },
    [queryClient],
  );
  const reset = useCallback(async () => {
    queryClient.setQueryData(settingsQueryKey, await settingsApi.reset());
  }, [queryClient]);

  if (context) return context;
  return {
    data: query.data,
    settings: normalizeSettings(query.data, defaultSettings(i18n.language, null)),
    hasPending: false,
    deviceTimeZone: null,
    timeZoneMismatch: false,
    syncTheme: true,
    update,
    reset,
    setSyncTheme: async () => undefined,
    dismissTimeZoneMismatch: () => undefined,
  };
}

export interface UpdateSettingsCallbacks {
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}

/** Mutation-style wrapper over useSettings().update (shape used by M4 / M5). */
export function useUpdateSettings() {
  const { update } = useSettings();
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const mutateAsync = useCallback(
    async (patch: SettingsPatch) => {
      setPending(true);
      setError(null);
      try {
        await update(patch);
      } catch (caught) {
        setError(caught);
        throw caught;
      } finally {
        setPending(false);
      }
    },
    [update],
  );

  const mutate = useCallback(
    (patch: SettingsPatch, callbacks: UpdateSettingsCallbacks = {}) => {
      mutateAsync(patch).then(
        () => callbacks.onSuccess?.(),
        (caught: unknown) => callbacks.onError?.(caught),
      );
    },
    [mutateAsync],
  );

  return { mutate, mutateAsync, isPending, error };
}
