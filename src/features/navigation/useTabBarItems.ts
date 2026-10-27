import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePinTargets } from '../settings/usePinTargets';
import { TAB_DEFS, useNavTabs } from './navTabs';
import { buildTabItems, pinKinds, type TabItem } from './tabBarItems';

/** What AppTabBar draws: the tabs of useNavTabs(), the pinned one named after its target. */
export function useTabBarItems(): TabItem[] {
  const { t, i18n } = useTranslation();
  const navTabs = useNavTabs();
  const targets = usePinTargets(pinKinds(navTabs));
  // i18n.language is a dependency: titles come from i18n.t() inside TAB_DEFS and must follow a language switch.
  return useMemo(
    () => buildTabItems(navTabs, Object.values(TAB_DEFS), targets.nameOf, t('settings.startPage.unknown')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navTabs, targets.nameOf, t, i18n.language],
  );
}
