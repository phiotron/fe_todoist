import { createContext, createElement, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsConnected } from '../lib/useIsOnline';

interface TopBannerState {
  /** true while an online banner (the time zone one) already pads itself for the status bar. */
  covered: boolean;
  setCovered: (covered: boolean) => void;
}

const TopBannerContext = createContext<TopBannerState | null>(null);

/**
 * Wraps the signed-in layout: lets a banner that sits above every screen tell the screens below it that it already
 * clears the status bar. Outside the provider (isolated component tests) nothing is covered.
 */
export function TopBannerProvider({ children }: { children: ReactNode }) {
  const [covered, setCovered] = useState(false);
  const value = useMemo(() => ({ covered, setCovered }), [covered]);
  return createElement(TopBannerContext.Provider, { value }, children);
}

/** A banner calls this with "I am showing and I pad for the status bar"; before paint, released on hide/unmount. */
export function useCoverStatusBar(active: boolean): void {
  const setCovered = useContext(TopBannerContext)?.setCovered;
  useLayoutEffect(() => {
    if (!setCovered || !active) return;
    setCovered(true);
    return () => setCovered(false);
  }, [setCovered, active]);
}

/**
 * Status-bar space for the topmost banner itself. While offline the offline banner at the very top already takes it
 * (OfflineBanner pads itself), so the banner under it starts right below.
 */
export function useBannerTopInset(): number {
  const insets = useSafeAreaInsets();
  return useIsConnected() ? insets.top : 0;
}

/**
 * Status-bar space a screen header must leave. While offline, or while the time zone banner shows, a banner at the
 * very top already takes it, so headers start right under the banner.
 */
export function useTopInset(): number {
  const inset = useBannerTopInset();
  return useContext(TopBannerContext)?.covered ? 0 : inset;
}
