import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addRecentSearch,
  parseRecentSearches,
  recentSearchesStorageKey,
  removeRecentSearch,
} from './recentSearches';

function store(userId: string | undefined, list: readonly string[]): void {
  if (!userId) return;
  // Losing the history is acceptable; a storage failure must never break searching.
  void AsyncStorage.setItem(recentSearchesStorageKey(userId), JSON.stringify(list)).catch(() => undefined);
}

/** The 5 latest searches of the signed-in user, persisted in AsyncStorage. */
export function useRecentSearches(userId: string | undefined) {
  const [items, setItems] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const itemsRef = useRef<string[]>([]);

  useEffect(() => {
    itemsRef.current = [];
    setItems([]);
    setLoaded(false);
    if (!userId) return undefined;
    let cancelled = false;
    AsyncStorage.getItem(recentSearchesStorageKey(userId))
      .then((raw) => {
        if (cancelled) return;
        // Terms remembered while the stored list was loading go on top of it.
        const pending = itemsRef.current;
        const merged = [...pending]
          .reverse()
          .reduce<string[]>((list, term) => addRecentSearch(list, term), parseRecentSearches(raw));
        itemsRef.current = merged;
        setItems(merged);
        if (pending.length > 0) store(userId, merged);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const update = useCallback(
    (next: string[]) => {
      itemsRef.current = next;
      setItems(next);
      store(userId, next);
    },
    [userId],
  );

  const remember = useCallback((term: string) => update(addRecentSearch(itemsRef.current, term)), [update]);
  const remove = useCallback((term: string) => update(removeRecentSearch(itemsRef.current, term)), [update]);
  const clear = useCallback(() => update([]), [update]);

  return { items, loaded, remember, remove, clear };
}
