import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';
import { isValidStartPage } from '../settings/navTabsModel';

/**
 * This device's own start page, used while "Sync home view" (M3x, Todoist Settings › General) is off. Device only:
 * AsyncStorage, never sent to the server. Best effort — a broken disk reads as "no own start page".
 */
export const HOME_VIEW_STORAGE_KEY = 'taskly.homeView';

export interface LocalHomeView {
  /** false until the disk has been read once. */
  loaded: boolean;
  /** null = this device has no own start page yet (the account one is used). */
  startPage: string | null;
}

const INITIAL: LocalHomeView = { loaded: false, startPage: null };
let state: LocalHomeView = INITIAL;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(next: LocalHomeView) {
  state = next;
  listeners.forEach((listener) => listener());
}

function parse(text: string | null): string | null {
  if (!text) return null;
  try {
    const value = (JSON.parse(text) as { startPage?: unknown } | null)?.startPage;
    return isValidStartPage(value) ? value : null;
  } catch {
    return null;
  }
}

/** Reads the disk once per app run; later calls wait for the same read. */
export function loadLocalHomeView(): Promise<void> {
  loading ??= AsyncStorage.getItem(HOME_VIEW_STORAGE_KEY)
    .then(parse, () => null)
    .then((startPage) => {
      // A value set while the disk was being read wins.
      if (!state.loaded) emit({ loaded: true, startPage });
    });
  return loading;
}

export async function setLocalHomeView(startPage: string | null): Promise<void> {
  emit({ loaded: true, startPage });
  try {
    if (startPage === null) await AsyncStorage.removeItem(HOME_VIEW_STORAGE_KEY);
    else await AsyncStorage.setItem(HOME_VIEW_STORAGE_KEY, JSON.stringify({ startPage }));
  } catch {
    // Ignored: the in-memory value stays right for this run.
  }
}

export function getLocalHomeView(): LocalHomeView {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The device start page; starts reading the disk on first use. */
export function useLocalHomeView(): LocalHomeView {
  useEffect(() => {
    void loadLocalHomeView();
  }, []);
  return useSyncExternalStore(subscribe, getLocalHomeView, getLocalHomeView);
}

/** Tests only: forget the in-memory value so the next use reads the disk again. */
export function resetLocalHomeViewForTests(): void {
  loading = null;
  emit(INITIAL);
}
