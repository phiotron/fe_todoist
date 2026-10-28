import { useCallback, useEffect, useRef, type ComponentRef, type RefObject } from 'react';
import type { FlatList, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, View } from 'react-native';

export type ViewRef = ComponentRef<typeof View>;
import { autoScrollStep, useDragApi } from './dnd';

/** Interval of the auto-scroll ticks, and the gap between two re-measures of the drop zones while scrolling. */
const TICK_MS = 32;
const REMEASURE_MS = 150;

/**
 * DND in lists: while a drag is near the top / bottom edge of the list, scroll it (the user's own scrolling is off
 * during a drag) and re-measure the drop zones so the hit-test follows the rows that moved under the finger.
 * Returns the scroll / size handlers the FlatList must report to.
 */
export function useListAutoScroll<T>(listRef: RefObject<FlatList<T> | null>, wrapperRef: RefObject<ViewRef | null>, enabled: boolean) {
  const api = useDragApi();
  const offset = useRef(0);
  const contentHeight = useRef(0);
  const viewHeight = useRef(0);

  useEffect(() => {
    if (!api || !enabled) return undefined;
    let bounds: { top: number; bottom: number } | null = null;
    let measuring = false;
    let step = 0;
    let timer: ReturnType<typeof setInterval> | null = null;
    let lastRemeasure = 0;
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    const tick = () => {
      const max = Math.max(0, contentHeight.current - viewHeight.current);
      const next = Math.min(max, Math.max(0, offset.current + step));
      if (next === offset.current) return;
      offset.current = next;
      listRef.current?.scrollToOffset({ offset: next, animated: false });
      const now = Date.now();
      if (now - lastRemeasure >= REMEASURE_MS) {
        lastRemeasure = now;
        api.remeasure();
      }
    };
    const unsubscribe = api.monitor((event) => {
      if (event.type === 'end') {
        stop();
        bounds = null;
        return;
      }
      if (!bounds) {
        const node = wrapperRef.current;
        if (!measuring && node && typeof node.measureInWindow === 'function') {
          measuring = true;
          node.measureInWindow((_x, y, _width, height) => {
            measuring = false;
            bounds = { top: y, bottom: y + height };
          });
        }
        return;
      }
      step = autoScrollStep(event.y, bounds.top, bounds.bottom);
      if (step === 0) {
        if (timer) {
          stop();
          api.remeasure();
        }
      } else if (!timer) {
        timer = setInterval(tick, TICK_MS);
      }
    });
    return () => {
      unsubscribe();
      stop();
    };
  }, [api, enabled, listRef, wrapperRef]);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = event.nativeEvent.contentOffset.y;
  }, []);
  const onContentSizeChange = useCallback((_width: number, height: number) => {
    contentHeight.current = height;
  }, []);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    viewHeight.current = event.nativeEvent.layout.height;
  }, []);
  return { onScroll, onContentSizeChange, onLayout };
}
