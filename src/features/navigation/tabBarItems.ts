import type { IconName } from '../../components/IconButton';
import { parsePin, type PinKind, type PinTarget } from '../settings/navTabsModel';

/** Shape of one entry of the TAB_DEFS registry. */
export interface TabDefLike {
  key: string;
  route: string;
  title: () => string;
  icon: IconName;
}

export interface TabItem {
  key: string;
  route: string;
  title: string;
  icon: IconName;
}

const PIN_ICONS: Record<PinKind, IconName> = { project: 'hash', label: 'tag', filter: 'filter' };

/** navTabs → what the tab bar draws. The pinned item is the `pinned` route, titled with its name. */
export function buildTabItems(
  navTabs: readonly string[],
  defs: readonly TabDefLike[],
  nameOf: (pin: PinTarget) => string | null,
  unknownTitle: string,
): TabItem[] {
  const items: TabItem[] = [];
  for (const key of navTabs) {
    const pin = parsePin(key);
    if (pin) {
      items.push({ key, route: 'pinned', title: nameOf(pin) ?? unknownTitle, icon: PIN_ICONS[pin.kind] });
      continue;
    }
    const def = defs.find((candidate) => candidate.key === key);
    if (def) items.push({ key, route: def.route, title: def.title(), icon: def.icon });
  }
  return items;
}

/** Kinds of list to fetch for the pinned item (none when nothing is pinned). */
export function pinKinds(navTabs: readonly string[] | undefined): PinKind[] {
  const kinds: PinKind[] = [];
  for (const key of navTabs ?? []) {
    const pin = parsePin(key);
    if (pin) kinds.push(pin.kind);
  }
  return kinds;
}
