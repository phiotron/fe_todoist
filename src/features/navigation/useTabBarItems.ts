import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePinTargets } from '../settings/usePinTargets';
import { useHasTeam } from '../team/useTeam';
import { TAB_DEFS, useNavTabs } from './navTabs';
import { buildTabItems, insertTeamTab, pinKinds, type TabItem } from './tabBarItems';

/**
 * What AppTabBar draws: the tabs of useNavTabs(), the pinned one named after its target. M8a: once the user belongs to
 * a team workspace the Team tab joins them just before Browse (it is not part of the stored navTabs).
 */
export function useTabBarItems(): TabItem[] {
  const { t, i18n } = useTranslation();
  const navTabs = useNavTabs();
  const targets = usePinTargets(pinKinds(navTabs));
  const hasTeam = useHasTeam();
  // i18n.language is a dependency: titles come from i18n.t() inside TAB_DEFS and must follow a language switch.
  return useMemo(
    () => {
      const items = buildTabItems(navTabs, Object.values(TAB_DEFS), targets.nameOf, t('settings.startPage.unknown'));
      return hasTeam ? insertTeamTab(items, TAB_DEFS.TEAM) : items;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navTabs, targets.nameOf, t, i18n.language, hasTeam],
  );
}