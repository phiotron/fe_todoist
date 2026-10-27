/** Pure rules of the customisable tab bar and of the start page (spec 9.2, 12.1.1). */
export type FixedTab = 'INBOX' | 'TODAY' | 'UPCOMING' | 'SEARCH' | 'FILTERS_LABELS' | 'TEAM' | 'BROWSE';
export type PinKind = 'project' | 'label' | 'filter';

export interface PinTarget {
  kind: PinKind;
  id: string;
}

/** Every fixed key spec 12.1.1 allows in navTabs. */
export const FIXED_TABS: readonly FixedTab[] = ['INBOX', 'TODAY', 'UPCOMING', 'SEARCH', 'FILTERS_LABELS', 'TEAM', 'BROWSE'];
/**
 * What Settings lets the user add. TEAM is valid only once M8 is merged (the server answers 400 before that), so it is
 * accepted when it comes from the server but not offered: M8 adds 'TEAM' here (and its route to TAB_DEFS).
 */
export const OFFERED_TABS: readonly FixedTab[] = ['INBOX', 'TODAY', 'UPCOMING', 'SEARCH', 'FILTERS_LABELS'];
export const DEFAULT_NAV_TABS: readonly string[] = ['INBOX', 'TODAY', 'UPCOMING', 'BROWSE'];
export const MIN_NAV_TABS = 3;
export const MAX_NAV_TABS = 5;
export const START_PAGE_FIXED: readonly string[] = ['INBOX', 'TODAY', 'UPCOMING'];
export const DEFAULT_START_PAGE = 'TODAY';

const PIN_PATTERN =
  /^(project|label|filter):([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;

const TAB_HREFS: Record<FixedTab, string> = {
  INBOX: '/inbox',
  TODAY: '/today',
  UPCOMING: '/upcoming',
  SEARCH: '/search',
  FILTERS_LABELS: '/filters-labels',
  TEAM: '/team',
  BROWSE: '/browse',
};

/** Which targets exist. A missing set means "not loaded yet": the stored value is trusted. */
export interface KnownTargets {
  project?: ReadonlySet<string>;
  label?: ReadonlySet<string>;
  filter?: ReadonlySet<string>;
}

export function isFixedTab(value: unknown): value is FixedTab {
  return typeof value === 'string' && (FIXED_TABS as readonly string[]).includes(value);
}

export function parsePin(value: string): PinTarget | null {
  const match = PIN_PATTERN.exec(value);
  return match ? { kind: match[1] as PinKind, id: match[2] } : null;
}

export function pinKey(target: PinTarget): string {
  return `${target.kind}:${target.id}`;
}

function isNavTab(value: unknown): value is string {
  return isFixedTab(value) || (typeof value === 'string' && parsePin(value) !== null);
}

/** 3–5 known keys, no duplicates, exactly one BROWSE and it is last, at most one pin. */
export function isValidNavTabs(value: unknown): value is string[] {
  if (!Array.isArray(value) || value.length < MIN_NAV_TABS || value.length > MAX_NAV_TABS) return false;
  if (!value.every(isNavTab)) return false;
  if (new Set(value).size !== value.length) return false;
  if (value[value.length - 1] !== 'BROWSE') return false;
  return value.filter((tab) => parsePin(tab) !== null).length <= 1;
}

export function isValidStartPage(value: unknown): value is string {
  return typeof value === 'string' && (START_PAGE_FIXED.includes(value) || parsePin(value) !== null);
}

/** true when the value pins a target that is known not to exist (deleted or archived). */
export function isStale(value: string, known: KnownTargets): boolean {
  const pin = parsePin(value);
  if (!pin) return false;
  const ids = known[pin.kind];
  return ids !== undefined && !ids.has(pin.id);
}

/** What the tab bar shows: invalid → default; a stale pin is dropped (default if fewer than 3 remain). */
export function effectiveNavTabs(tabs: unknown, known: KnownTargets = {}): string[] {
  if (!isValidNavTabs(tabs)) return [...DEFAULT_NAV_TABS];
  const kept = tabs.filter((tab) => !isStale(tab, known));
  return isValidNavTabs(kept) ? kept : [...DEFAULT_NAV_TABS];
}

export function pinnedOf(tabs: readonly string[]): PinTarget | null {
  for (const tab of tabs) {
    const pin = parsePin(tab);
    if (pin) return pin;
  }
  return null;
}

export function addableFixedTabs(tabs: readonly string[]): FixedTab[] {
  return OFFERED_TABS.filter((tab) => !tabs.includes(tab));
}

export function canAddTab(tabs: readonly string[]): boolean {
  return tabs.length < MAX_NAV_TABS;
}

export function canRemoveTab(tabs: readonly string[], value: string): boolean {
  return value !== 'BROWSE' && tabs.includes(value) && tabs.length > MIN_NAV_TABS;
}

/** Inserts an offered tab right before Browse; unchanged when full, already there, not offered (TEAM) or Browse. */
export function addTab(tabs: readonly string[], value: FixedTab): string[] {
  if (!OFFERED_TABS.includes(value) || tabs.includes(value) || !canAddTab(tabs)) return [...tabs];
  const withoutBrowse = tabs.filter((tab) => tab !== 'BROWSE');
  return [...withoutBrowse, value, 'BROWSE'];
}

export function removeTab(tabs: readonly string[], value: string): string[] {
  if (!canRemoveTab(tabs, value)) return [...tabs];
  return tabs.filter((tab) => tab !== value);
}

/** Moves one place up (-1) or down (+1); Browse never moves and nothing passes it. */
export function moveTab(tabs: readonly string[], value: string, delta: -1 | 1): string[] {
  const index = tabs.indexOf(value);
  const target = index + delta;
  if (value === 'BROWSE' || index < 0 || target < 0 || target >= tabs.length - 1) return [...tabs];
  const next = [...tabs];
  next[index] = tabs[target];
  next[target] = value;
  return next;
}

/** Order after a drag: whatever the user did, Browse goes back to the end. */
export function reorderTabs(order: readonly string[]): string[] {
  if (!order.includes('BROWSE')) return [...order];
  return [...order.filter((tab) => tab !== 'BROWSE'), 'BROWSE'];
}

/** Pins one target: replaces the current pin in place, else adds it before Browse; null when the bar is full. */
export function setPin(tabs: readonly string[], target: PinTarget): string[] | null {
  const key = pinKey(target);
  const current = tabs.findIndex((tab) => parsePin(tab) !== null);
  if (current >= 0) {
    const next = [...tabs];
    next[current] = key;
    return next;
  }
  if (!canAddTab(tabs)) return null;
  return [...tabs.filter((tab) => tab !== 'BROWSE'), key, 'BROWSE'];
}

/** Route of a tab: fixed tabs have their own screen, the pin shows in (tabs)/pinned. */
export function tabHref(value: string): string {
  return isFixedTab(value) ? TAB_HREFS[value] : '/pinned';
}

/**
 * Routes to open at app start: the first replaces "/", the next ones are pushed on top.
 * A project / label / filter that is not pinned opens over Browse (Back returns to Browse, as when opened from there).
 */
export function startPageRoutes(startPage: string, navTabs: readonly string[], known: KnownTargets = {}): string[] {
  if (START_PAGE_FIXED.includes(startPage)) return [tabHref(startPage)];
  const pin = parsePin(startPage);
  if (!pin || isStale(startPage, known)) return [tabHref(DEFAULT_START_PAGE)];
  if (navTabs.includes(startPage)) return ['/pinned'];
  return ['/browse', `/${pin.kind}/${pin.id}`];
}
