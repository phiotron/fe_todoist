/** Copy of `items` with the element at `from` moved to `to`. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Spec 12.4 / 3.1: "put X right after Y" — Y is the item now before `index`, null = first in the container.
 * The result is ALWAYS sent as `afterId` (never left out): for `reorder` an absent `afterId` is a 400, and for
 * `move` / create an absent `afterId` means "last", not "first".
 */
export function afterIdAt<T extends { id: string }>(items: readonly T[], index: number): string | null {
  return index > 0 ? items[index - 1].id : null;
}
