import { Feather } from '@expo/vector-icons';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useIsOnline } from '../lib/useIsOnline';
import { fonts, layout, palette, radius, shadow, size } from '../theme';

/** Spec 5.1: the Undo toast stays 5 seconds. */
export const SNACKBAR_DURATION_MS = 5000;

export interface SnackbarOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
  /** 'error' swaps the check icon for a warning one (a failed write reported outside its own screen). */
  tone?: 'error';
}

interface SnackbarApi {
  show: (options: SnackbarOptions) => void;
  hide: () => void;
}

const NOOP: SnackbarApi = { show: () => undefined, hide: () => undefined };
const SnackbarContext = createContext<SnackbarApi>(NOOP);

type Toast = SnackbarOptions & { id: number };

/** Toasts waiting behind the one on screen; more than this are dropped (a failing action spammed by taps). */
const MAX_QUEUED = 3;

const sameToast = (a: Toast, b: Toast) => a.message === b.message && a.tone === b.tone;

/**
 * One toast at a time (M-Empty). A toast WITH an Undo (`onAction`) REPLACES the one on screen, so its Undo is always the
 * newest action's. Anything that would wipe a toast carrying an Undo, or an error, WAITS in a queue instead: an error,
 * and a plain toast (no action) arriving over an Undo or an error. A plain toast over a plain toast replaces it. A toast
 * equal (message + tone) to the one on screen or already waiting is dropped; the queue is capped.
 */
export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Toast | null>(null);
  const currentRef = useRef<Toast | null>(null);
  const queue = useRef<Toast[]>([]);
  const online = useIsOnline();
  const present = useCallback((toast: Toast | null) => {
    currentRef.current = toast;
    setCurrent(toast);
  }, []);
  const hide = useCallback(() => present(queue.current.shift() ?? null), [present]);
  const show = useCallback(
    (options: SnackbarOptions) => {
      const toast = { ...options, id: Date.now() + Math.random() };
      const onScreen = currentRef.current;
      if (!onScreen) {
        present(toast);
        return;
      }
      const wipes = toast.onAction || (toast.tone !== 'error' && !onScreen.onAction && onScreen.tone !== 'error');
      if (wipes) {
        // An error on screen is not lost: it goes back to the front of the line (if there is room) behind the newer toast.
        if (onScreen.tone === 'error' && queue.current.length < MAX_QUEUED) queue.current.unshift(onScreen);
        present(toast);
        return;
      }
      const duplicate = sameToast(onScreen, toast) || queue.current.some((queued) => sameToast(queued, toast));
      if (!duplicate && queue.current.length < MAX_QUEUED) queue.current.push(toast);
    },
    [present],
  );
  const api = useMemo(() => ({ show, hide }), [show, hide]);

  useEffect(() => {
    if (!current) return undefined;
    const timer = setTimeout(() => {
      if (currentRef.current?.id === current.id) hide();
    }, current.durationMs ?? SNACKBAR_DURATION_MS);
    return () => clearTimeout(timer);
  }, [current, hide]);

  return (
    <SnackbarContext.Provider value={api}>
      <View style={styles.fill}>
        {children}
        {current ? (
          <View key={current.id} testID="snackbar" accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.toast}>
            <Feather
              name={current.tone === 'error' ? 'alert-circle' : 'check'}
              size={size.iconSmall}
              color={current.tone === 'error' ? palette.warn : palette.toastAccent}
            />
            <Text style={styles.message}>{current.message}</Text>
            {current.actionLabel && current.onAction ? (
              <Pressable
                testID="snackbar-action"
                accessibilityRole="button"
                accessibilityState={{ disabled: !online }}
                disabled={!online}
                onPress={() => {
                  const action = current.onAction;
                  hide();
                  action?.();
                }}
                style={[styles.action, !online && styles.inactive]}
              >
                <Text style={styles.actionText}>{current.actionLabel}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </SnackbarContext.Provider>
  );
}

/** show({ message, actionLabel, onAction }); a no-op outside SnackbarProvider. */
export function useSnackbar(): SnackbarApi {
  return useContext(SnackbarContext);
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: layout.toastBottom,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
    paddingLeft: 14,
    paddingRight: 6,
    borderRadius: radius.card,
    backgroundColor: palette.toastBg,
    ...shadow,
  },
  message: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: palette.toastText, paddingVertical: 8 },
  action: { minHeight: size.touch, justifyContent: 'center', paddingHorizontal: 8 },
  actionText: { fontFamily: fonts.bold, fontSize: 14, color: palette.toastAccent },
  inactive: { opacity: 0.4 },
});
