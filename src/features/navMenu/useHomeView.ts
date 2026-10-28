import { useCallback } from 'react';
import { useSettings } from '../settings/useSettings';
import { setLocalHomeView, useLocalHomeView } from './homeViewStore';
import { readNavigationSettings } from './navMenuModel';

export interface HomeView {
  /** The start page this device opens: the account one, or this device's own while "Sync home view" is off. */
  startPage: string;
  /** false while "Sync home view" is off and this device's value is still being read from disk. */
  ready: boolean;
  /** "Sync home view" (account setting, M3x). */
  sync: boolean;
  /** Saves a new start page: on the account (PATCH) when synced, on this device only otherwise. */
  setStartPage(startPage: string): Promise<void>;
  /** Off → keeps the current start page on this device; on → this device's start page becomes the account one. */
  setSync(on: boolean): Promise<void>;
}

export function useHomeView(): HomeView {
  const { data, settings, update } = useSettings();
  const local = useLocalHomeView();
  const sync = readNavigationSettings(data).syncHomeView;
  const startPage = !sync && local.startPage ? local.startPage : settings.startPage;

  const setStartPage = useCallback(
    async (next: string) => {
      if (sync) await update({ startPage: next });
      else await setLocalHomeView(next);
    },
    [sync, update],
  );

  const setSync = useCallback(
    async (on: boolean) => {
      if (on === sync) return;
      if (!on) {
        // Keep exactly the start page the user has now as this device's own, so nothing jumps.
        await setLocalHomeView(startPage);
        await update({ syncHomeView: false });
        return;
      }
      await update(startPage !== settings.startPage ? { syncHomeView: true, startPage } : { syncHomeView: true });
    },
    [settings.startPage, startPage, sync, update],
  );

  return { startPage, ready: sync || local.loaded, sync, setStartPage, setSync };
}
