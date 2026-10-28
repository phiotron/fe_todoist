import type { IconName } from '../../components/IconButton';

/** Quick Add chips (contract 2): array order = display order, absent = hidden ("More"), PROJECT always there. */
export type QuickAddChip =
  | 'PROJECT'
  | 'DATE'
  | 'ASSIGNEE'
  | 'ATTACHMENT'
  | 'PRIORITY'
  | 'REMINDERS'
  | 'LABELS'
  | 'DEADLINE'
  | 'LOCATION';

export const ALL_CHIPS: readonly QuickAddChip[] = [
  'PROJECT',
  'DATE',
  'ASSIGNEE',
  'ATTACHMENT',
  'PRIORITY',
  'REMINDERS',
  'LABELS',
  'DEADLINE',
  'LOCATION',
];

export const DEFAULT_CHIPS: readonly QuickAddChip[] = ['PROJECT', 'DATE', 'ASSIGNEE'];

/**
 * Chips whose feature exists today. Assignee and Attachment come with M8b, Location with M12: they can be ordered
 * and shown in Settings (the choice is saved) but the sheet only draws them once the feature exists.
 */
export const AVAILABLE_CHIPS: ReadonlySet<QuickAddChip> = new Set<QuickAddChip>([
  'PROJECT',
  'DATE',
  'PRIORITY',
  'REMINDERS',
  'LABELS',
  'DEADLINE',
]);

/** i18n key suffix (quickAdd.chips.<key>) and icon of each chip. */
export const CHIP_META: Record<QuickAddChip, { key: string; icon: IconName }> = {
  PROJECT: { key: 'project', icon: 'inbox' },
  DATE: { key: 'date', icon: 'calendar' },
  ASSIGNEE: { key: 'assignee', icon: 'user' },
  ATTACHMENT: { key: 'attachment', icon: 'paperclip' },
  PRIORITY: { key: 'priority', icon: 'flag' },
  REMINDERS: { key: 'reminders', icon: 'bell' },
  LABELS: { key: 'labels', icon: 'tag' },
  DEADLINE: { key: 'deadline', icon: 'target' },
  LOCATION: { key: 'location', icon: 'map-pin' },
};

export interface QuickAddPrefs {
  chips: QuickAddChip[];
  showActionLabels: boolean;
  showDescription: boolean;
}

const isChip = (value: unknown): value is QuickAddChip => (ALL_CHIPS as readonly unknown[]).includes(value);

export function isValidChipList(value: unknown): value is QuickAddChip[] {
  return (
    Array.isArray(value) &&
    value.every(isChip) &&
    new Set(value).size === value.length &&
    value.includes('PROJECT')
  );
}

/** me/settings → Quick Add prefs; a field missing or invalid (cache from before M6b) falls back to its default. */
export function readQuickAddPrefs(data: Record<string, unknown> | undefined): QuickAddPrefs {
  const chips = data?.quickAddChips;
  return {
    chips: isValidChipList(chips) ? [...chips] : [...DEFAULT_CHIPS],
    showActionLabels: typeof data?.quickAddShowActionLabels === 'boolean' ? data.quickAddShowActionLabels : true,
    showDescription: typeof data?.quickAddShowDescription === 'boolean' ? data.quickAddShowDescription : true,
  };
}

/** Show a hidden chip (at the end) / hide a shown one. PROJECT cannot be hidden. */
export function toggleChip(chips: readonly QuickAddChip[], chip: QuickAddChip): QuickAddChip[] {
  if (chip === 'PROJECT') return [...chips];
  return chips.includes(chip) ? chips.filter((item) => item !== chip) : [...chips, chip];
}

/** Move a shown chip by `delta` (−1 up, +1 down); unchanged at the ends or when hidden. */
export function moveChip(chips: readonly QuickAddChip[], chip: QuickAddChip, delta: -1 | 1): QuickAddChip[] {
  const index = chips.indexOf(chip);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= chips.length) return [...chips];
  const next = [...chips];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function hiddenChips(chips: readonly QuickAddChip[]): QuickAddChip[] {
  return ALL_CHIPS.filter((chip) => !chips.includes(chip));
}
