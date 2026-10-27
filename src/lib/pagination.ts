import type { Page } from '../api/models';

/** All loaded items in page order; an item repeated on a later page (data changed meanwhile) is kept once. */
export function flattenPages<T>(pages: readonly Page<T>[] | undefined, idOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  const items: T[] = [];
  for (const page of pages ?? []) {
    for (const item of page.items) {
      const id = idOf(item);
      if (seen.has(id)) continue;
      seen.add(id);
      items.push(item);
    }
  }
  return items;
}

/** TanStack getNextPageParam: undefined = no more pages. */
export function nextPageParam<T>(page: Page<T>): string | undefined {
  return page.nextCursor ?? undefined;
}
