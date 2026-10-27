import { Feather } from '@expo/vector-icons';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
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
}

interface SnackbarApi {
  show: (options: SnackbarOptions) => void;
  hide: () => void;
}

const NOOP: SnackbarApi = { show: () => undefined, hide: () => undefined };
const SnackbarContext = createContext<SnackbarApi>(NOOP);

/** One toast at a time (M-Empty): a new one replaces the current one and restarts the timer. */
export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<(SnackbarOptions & { id: number }) | null>(null);
  const online = useIsOnline();
  const hide = useCallback(() => setCurrent(null), []);
  const show = useCallback((options: SnackbarOptions) => setCurrent({ ...options, id: Date.now() + Math.random() }), []);
  const api = useMemo(() => ({ show, hide }), [show, hide]);

  useEffect(() => {
    if (!current) return undefined;
    const timer = setTimeout(hide, current.durationMs ?? SNACKBAR_DURATION_MS);
    return () => clearTimeout(timer);
  }, [current, hide]);

  return (
    <SnackbarContext.Provider value={api}>
      <View style={styles.fill}>
        {children}
        {current ? (
          <View testID="snackbar" accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.toast}>
            <Feather name="check" size={size.iconSmall} color={palette.toastAccent} />
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
