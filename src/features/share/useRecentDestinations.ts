import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addRecentDestination,
  parseRecentDestinations,
  recentDestinationsStorageKey,
  type NamedDestination,
} from '../../lib/share/shareDestination';

/** The 5 latest tasks / projects a share was added to (per account, AsyncStorage). A storage failure never blocks sharing. */
export function useRecentDestinations(userId: string | undefined) {
  const [items, setItems] = useState<NamedDestination[]>([]);
  const itemsRef = useRef<NamedDestination[]>([]);

  useEffect(() => {
    itemsRef.current = [];
    setItems([]);
    if (!userId) return undefined;
    let cancelled = false;
    AsyncStorage.getItem(recentDestinationsStorageKey(userId))
      .then((raw) => {
        if (cancelled) return;
        // Destinations remembered while the stored list was loading stay on top.
        const merged = [...itemsRef.current]
          .reverse()
          .reduce<NamedDestination[]>((list, entry) => addRecentDestination(list, entry), parseRecentDestinations(raw));
        itemsRef.current = merged;
        setItems(merged);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const remember = useCallback(
    (entry: NamedDestination) => {
      const next = addRecentDestination(itemsRef.current, entry);
      itemsRef.current = next;
      setItems(next);
      if (userId) void AsyncStorage.setItem(recentDestinationsStorageKey(userId), JSON.stringify(next)).catch(() => undefined);
    },
    [userId],
  );

  return { items, remember };
}
