import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { UserResponse } from '../../api/auth';
import { settingsApi, type SettingsResponse } from '../../api/settings';
import i18n from '../../i18n';
import { getDeviceTimeZone } from '../../lib/deviceTimeZone';
import { meQueryKey, useSession } from '../auth/session';
import {
  accountSettings,
  applyLocally,
  defaultSettings,
  effectiveData,
  effectiveSettings,
  emptyStored,
  extraFields,
  hasTimeZoneMismatch,
  isRetryableSaveError,
  mergePending,
  normalizeSettings,
  settlePending,
  splitThemePatch,
  themeOf,
  timeZonePairKey,
  type AppSettings,
  type SettingsPatch,
  type StoredSettings,
} from './settingsModel';
import { settingsStore, type SettingsStorage } from './settingsStore';

export interface SettingsContextValue {
  /** Settings in the server shape (GET me/settings, later milestones' fields included), unsaved changes on top. */
  data: SettingsResponse | undefined;
  /** The M3 settings the app applies now (this device's theme while "Sync theme" is off). */
  settings: AppSettings;
  /** true while some change is kept only on this device (save failed; resent on the next open). */
  hasPending: boolean;
  deviceTimeZone: string | null;
  /** Signed in, the device zone differs from the account zone and the user has not dismissed this pair. */
  timeZoneMismatch: boolean;
  /** "Sync theme" (device setting): on → theme / appearance are account settings; off → this device only. */
  syncTheme: boolean;
  /** Applies at once, PATCHes only the changed fields; rejects when the server did not save them. */
  update(patch: SettingsPatch): Promise<void>;
  /** POST me/settings/reset; nothing changes on failure. */
  reset(): Promise<void>;
  setSyncTheme(on: boolean): Promise<void>;
  dismissTimeZoneMismatch(): void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

interface SettingsProviderProps {
  children: ReactNode;
  storage?: SettingsStorage;
  /** Injected by tests; the app reads the device zone once at start. */
  deviceTimeZone?: string | null;
}

type PendingRule = (pending: SettingsPatch | null) => SettingsPatch | null;

export function SettingsProvider({ children, storage = settingsStore, deviceTimeZone }: SettingsProviderProps) {
  const { status } = useSession();
  const queryClient = useQueryClient();
  const [deviceZone] = useState<string | null>(() =>
    deviceTimeZone === undefined ? getDeviceTimeZone() : deviceTimeZone,
  );
  const [stored, setStored] = useState<StoredSettings | null>(null);
  const storedRef = useRef<StoredSettings | null>(null);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  const commit = useCallback(
    (next: StoredSettings) => {
      storedRef.current = next;
      setStored(next);
      void storage.save(next);
    },
    [storage],
  );

  /** One write at a time, in call order, so a late answer never overwrites a newer choice. */
  const enqueue = useCallback(<T,>(job: () => Promise<T>): Promise<T> => {
    const run = queueRef.current.then(job, job);
    queueRef.current = run.catch(() => undefined);
    return run;
  }, []);

  const applyServer = useCallback(
    (response: SettingsResponse, nextPending: PendingRule) => {
      const latest = storedRef.current;
      if (!latest) return;
      const applied = normalizeSettings(response, latest.applied);
      commit({ ...latest, applied, extra: extraFields(response), pending: nextPending(latest.pending) });
      queryClient.setQueryData<UserResponse>(meQueryKey, (me) =>
        me ? { ...me, locale: applied.locale, timeZone: applied.timeZone } : me,
      );
      // "Today" / "Overdue" depend on the account time zone.
      if (applied.timeZone !== latest.applied.timeZone) void queryClient.invalidateQueries();
    },
    [commit, queryClient],
  );

  const sendPending = useCallback(
    () =>
      enqueue(async () => {
        const sent = storedRef.current?.pending;
        if (!sent) return;
        try {
          const response = await settingsApi.update(sent);
          applyServer(response, (pending) => settlePending(pending, sent));
        } catch (error) {
          if (!isRetryableSaveError(error)) {
            const latest = storedRef.current;
            if (latest) commit({ ...latest, pending: settlePending(latest.pending, sent) });
          }
          throw error;
        }
      }),
    [applyServer, commit, enqueue],
  );

  // 1. Read the device cache before anything is shown, and switch the language to it.
  useEffect(() => {
    let active = true;
    const fallback = defaultSettings(i18n.language, deviceZone);
    storage
      .load(fallback)
      .catch((): StoredSettings => emptyStored(fallback))
      .then(async (loaded) => {
        const locale = effectiveSettings(loaded).locale;
        if (active && i18n.language !== locale) await i18n.changeLanguage(locale);
        if (!active || storedRef.current) return;
        storedRef.current = loaded;
        setStored(loaded);
      });
    return () => {
      active = false;
    };
  }, [storage, deviceZone]);

  // 2. Keep i18next on the effective language.
  const locale = stored ? effectiveSettings(stored).locale : null;
  useEffect(() => {
    if (locale && i18n.language !== locale) void i18n.changeLanguage(locale);
  }, [locale]);

  // 3. Signed in: resend what failed last time, else load the account settings. Signed out: forget pending.
  const hydrated = stored !== null;
  useEffect(() => {
    if (!hydrated) return;
    if (status === 'signedOut') {
      const latest = storedRef.current;
      if (latest?.pending) commit({ ...latest, pending: null });
      return;
    }
    if (status !== 'signedIn') return;
    let active = true;
    const sync = async () => {
      if (storedRef.current?.pending) {
        await sendPending();
        return;
      }
      await enqueue(async () => {
        const response = await settingsApi.get();
        if (active) applyServer(response, (pending) => pending);
      });
    };
    sync().catch(() => {
      // Offline or server down: keep the cached settings; the next app start tries again.
    });
    return () => {
      active = false;
    };
  }, [hydrated, status, applyServer, commit, enqueue, sendPending]);

  const update = useCallback(
    async (patch: SettingsPatch) => {
      const current = storedRef.current;
      if (!current) return;
      let next = current;
      let toSave: SettingsPatch | null = patch;
      const split = splitThemePatch(patch);
      if (split.theme && !current.syncTheme) {
        // Spec 9.3 "Sync theme" off: the theme belongs to this device and is never sent.
        next = { ...next, localTheme: { ...themeOf(effectiveSettings(next)), ...split.theme } };
        toSave = split.rest;
      }
      if (!toSave) {
        commit(next);
        return;
      }
      if (status !== 'signedIn') {
        commit(applyLocally(next, toSave));
        return;
      }
      commit({ ...next, pending: mergePending(next.pending, toSave) });
      await sendPending();
    },
    [commit, sendPending, status],
  );

  const reset = useCallback(
    () =>
      enqueue(async () => {
        const response = await settingsApi.reset();
        applyServer(response, () => null);
        const latest = storedRef.current;
        if (latest && !latest.syncTheme) commit({ ...latest, localTheme: themeOf(latest.applied) });
      }),
    [applyServer, commit, enqueue],
  );

  const setSyncTheme = useCallback(
    async (on: boolean) => {
      const current = storedRef.current;
      if (!current || current.syncTheme === on) return;
      if (!on) {
        // Keep exactly the look the user sees now as this device's theme.
        commit({ ...current, syncTheme: false, localTheme: themeOf(effectiveSettings(current)) });
        return;
      }
      const local = current.localTheme;
      commit({ ...current, syncTheme: true, localTheme: null });
      const account = themeOf(accountSettings(current));
      if (local && (local.theme !== account.theme || local.appearance !== account.appearance)) {
        // The device theme becomes the account theme, so the look does not jump.
        await update(local);
      }
    },
    [commit, update],
  );

  const dismissTimeZoneMismatch = useCallback(() => {
    const current = storedRef.current;
    if (!current || !deviceZone) return;
    commit({ ...current, dismissedTimeZone: timeZonePairKey(deviceZone, effectiveSettings(current).timeZone) });
  }, [commit, deviceZone]);

  const value = useMemo<SettingsContextValue | null>(() => {
    if (!stored) return null;
    const settings = effectiveSettings(stored);
    return {
      data: effectiveData(stored) as unknown as SettingsResponse,
      settings,
      hasPending: stored.pending !== null,
      deviceTimeZone: deviceZone,
      timeZoneMismatch:
        status === 'signedIn' && hasTimeZoneMismatch(deviceZone, settings.timeZone, stored.dismissedTimeZone),
      syncTheme: stored.syncTheme,
      update,
      reset,
      setSyncTheme,
      dismissTimeZoneMismatch,
    };
  }, [stored, deviceZone, status, update, reset, setSyncTheme, dismissTimeZoneMismatch]);

  // Nothing is shown until the cached theme and language are known: no flash of the wrong look.
  if (!value) return null;
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

/** null outside <SettingsProvider>. Screens use useSettings() from ./useSettings instead. */
export function useSettingsContext(): SettingsContextValue | null {
  return useContext(SettingsContext);
}
