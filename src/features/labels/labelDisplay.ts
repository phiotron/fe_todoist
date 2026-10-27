import type { Label } from '../../api/labels';

/** A task's labels in label sort order; ids of labels not (or no longer) known are skipped. */
export function orderedLabels(ids: readonly string[] | undefined, labels: ReadonlyMap<string, Label>): Label[] {
  return (ids ?? [])
    .map((id) => labels.get(id))
    .filter((label): label is Label => label !== undefined)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Chip text: up to two names, then "+N". */
export function labelSummary(labels: readonly Label[]): string {
  if (labels.length <= 2) return labels.map((label) => label.name).join(', ');
  return `${labels[0].name}, ${labels[1].name} +${labels.length - 2}`;
}

export function sameLabelIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}
