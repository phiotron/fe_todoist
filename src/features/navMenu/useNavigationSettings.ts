import { useMemo } from 'react';
import type { AddButtonPlacement, NavigationSettingsFields } from '../../api/navigationSettings';
import { useSettingsContext } from '../settings/SettingsProvider';
import { readNavigationSettings } from './navMenuModel';

/**
 * The M3x settings (+ placement, Navigation menu, Sync home view) as cached by <SettingsProvider> (the whole app),
 * defaults filled in. Like useNavTabs it never fetches: outside the provider (isolated screen tests) it gives the
 * defaults. Settings screens read and write through useSettings() instead.
 */
export function useNavigationSettings(): NavigationSettingsFields {
  const data = useSettingsContext()?.data;
  return useMemo(() => readNavigationSettings(data), [data]);
}

/** Where the floating + button goes (Settings › Navigation bar). */
export function useAddButtonPlacement(): AddButtonPlacement {
  return useNavigationSettings().addButtonPlacement;
}
