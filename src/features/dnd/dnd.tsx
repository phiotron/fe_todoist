import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentRef,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  Animated,
  StyleSheet,
  type AccessibilityState,
  Text,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { Task } from '../../api/models';
import { radius, shadow, type, useTheme } from '../../theme';

/**
 * M7 drag and drop (plan M7 F3 / F4), written with React Native's own responder system: no new library, and the
 * jest mock of react-native-gesture-handler (only GestureHandlerRootView) keeps working. A Draggable is picked up by a
 * long press (LONG_PRESS_MS without moving more than SLOP), follows the finger as a floating "ghost", and is dropped
 * on the DropZone under the finger (the smallest one containing the point). Zones are measured in window coordinates
 * when a drag starts; screens turn their scrolling off while `dragging` (useDragState) so the measures stay true.
 */

type ViewRef = ComponentRef<typeof View>;

export const LONG_PRESS_MS = 300;
export const SLOP = 8;

/** What is dragged: the tasks to change (several with multi-select) and the one under the finger. */
export interface DragPayload {
  taskIds: string[];
  task: Task;
}

/** A drop point relative to the zone's top-left corner. */
export interface DropPoint {
  x: number;
  y: number;
  /** Size of the zone (list rows: which half the finger is on). */
  width?: number;
  height?: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ZoneEntry {
  ref: RefObject<ViewRef | null>;
  onDrop: (payload: DragPayload, point: DropPoint) => void;
  accepts?: (payload: DragPayload) => boolean;
}

/** Height of the band at the top / bottom of a list where a drag scrolls it, and the fastest step (px per tick). */
export const AUTO_SCROLL_EDGE = 64;
export const AUTO_SCROLL_MAX = 24;

/**
 * DND in lists: pixels to scroll per tick while the finger is at `y` over a list spanning [top, bottom] (window
 * coordinates): negative = up, 0 = outside the edge bands; faster closer to (or past) the edge. Pure (unit-tested).
 */
export function autoScrollStep(y: number, top: number, bottom: number): number {
  const strength = (depth: number) => Math.round(AUTO_SCROLL_MAX * Math.min(1, depth / AUTO_SCROLL_EDGE));
  if (y < top + AUTO_SCROLL_EDGE) return -Math.max(1, strength(top + AUTO_SCROLL_EDGE - y));
  if (y > bottom - AUTO_SCROLL_EDGE) return Math.max(1, strength(y - (bottom - AUTO_SCROLL_EDGE)));
  return 0;
}

/** The id of the smallest rect containing (x, y), or null. Pure (unit-tested). */
export function hitTest(rects: ReadonlyMap<string, Rect>, x: number, y: number): string | null {
  let best: string | null = null;
  let bestArea = Number.POSITIVE_INFINITY;
  for (const [id, rect] of rects) {
    if (x < rect.x || y < rect.y || x > rect.x + rect.width || y > rect.y + rect.height) continue;
    const area = rect.width * rect.height;
    if (area < bestArea) {
      best = id;
      bestArea = area;
    }
  }
  return best;
}

interface DragState {
  payload: DragPayload | null;
  overId: string | null;
  /** The finger is on the lower half of the zone under it (list rows: drop after that row). */
  overAfter: boolean;
}

/** What a monitor hears: every finger move of a drag, then its end (dropped or cancelled). */
export type DragEvent = { type: 'move'; x: number; y: number } | { type: 'end' };

export interface DragApi {
  register: (id: string, entry: ZoneEntry) => () => void;
  start: (payload: DragPayload, pageX: number, pageY: number) => void;
  move: (pageX: number, pageY: number) => void;
  end: (pageX: number, pageY: number) => void;
  cancel: () => void;
  /** Measure every zone again (a list scrolled under the finger), then hit-test the finger again. */
  remeasure: () => void;
  /** Listen to the drag (auto-scroll of lists); returns the unsubscribe. */
  monitor: (listener: (event: DragEvent) => void) => () => void;
}

const IDLE: DragState = { payload: null, overId: null, overAfter: false };
const DragStateContext = createContext<DragState>(IDLE);
const DragApiContext = createContext<DragApi | null>(null);
interface DragStore {
  get: () => DragState;
  set: (state: DragState) => void;
  subscribe: (listener: () => void) => () => void;
}
const DragStoreContext = createContext<DragStore | null>(null);
const NO_SUBSCRIBE = () => () => undefined;

function createDragStore(): DragStore {
  let current = IDLE;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (next) => {
      if (next === current) return;
      current = next;
      for (const listener of [...listeners]) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function measure(ref: RefObject<ViewRef | null>): Promise<Rect | null> {
  return new Promise((resolve) => {
    const node = ref.current;
    if (!node || typeof node.measureInWindow !== 'function') {
      resolve(null);
      return;
    }
    node.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });
}

/** Holds the zones of one screen body and draws the ghost of the dragged task above them. */
export function DragProvider({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { palette } = useTheme();
  const zones = useRef(new Map<string, ZoneEntry>());
  const rects = useRef(new Map<string, Rect>());
  const rootRef = useRef<ViewRef>(null);
  const origin = useRef({ x: 0, y: 0 });
  const position = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [state, setState] = useState<DragState>(IDLE);
  const store = useRef<DragStore | null>(null);
  if (!store.current) store.current = createDragStore();
  useLayoutEffect(() => store.current?.set(state), [state]);
  const stateRef = useRef(state);
  stateRef.current = state;
  const lastPoint = useRef({ x: 0, y: 0 });
  const monitors = useRef(new Set<(event: DragEvent) => void>());

  const register = useCallback((id: string, entry: ZoneEntry) => {
    zones.current.set(id, entry);
    return () => {
      if (zones.current.get(id) === entry) zones.current.delete(id);
      rects.current.delete(id);
    };
  }, []);

  const monitor = useCallback((listener: (event: DragEvent) => void) => {
    monitors.current.add(listener);
    return () => {
      monitors.current.delete(listener);
    };
  }, []);
  const emit = useCallback((event: DragEvent) => {
    for (const listener of [...monitors.current]) listener(event);
  }, []);

  const place = useCallback(
    (pageX: number, pageY: number) => position.setValue({ x: pageX - origin.current.x, y: pageY - origin.current.y }),
    [position],
  );

  /** Zone under the point and which half of it; the state only changes when one of them does. */
  const hover = useCallback((pageX: number, pageY: number) => {
    const overId = hitTest(rects.current, pageX, pageY);
    const rect = overId ? rects.current.get(overId) : undefined;
    const overAfter = rect ? pageY - rect.y > rect.height / 2 : false;
    const current = stateRef.current;
    if (current.payload && (overId !== current.overId || overAfter !== current.overAfter)) {
      setState((previous) => ({ ...previous, overId, overAfter }));
    }
  }, []);

  const measureZones = useCallback(() => {
    const pending: Promise<void>[] = [];
    for (const [id, entry] of zones.current) {
      pending.push(
        measure(entry.ref).then((rect) => {
          if (rect) rects.current.set(id, rect);
        }),
      );
    }
    return Promise.all(pending);
  }, []);

  const start = useCallback(
    (payload: DragPayload, pageX: number, pageY: number) => {
      rects.current.clear();
      lastPoint.current = { x: pageX, y: pageY };
      void measure(rootRef).then((rect) => {
        if (rect) origin.current = { x: rect.x, y: rect.y };
        place(pageX, pageY);
      });
      void measureZones();
      place(pageX, pageY);
      setState({ payload, overId: null, overAfter: false });
    },
    [place, measureZones],
  );

  const move = useCallback(
    (pageX: number, pageY: number) => {
      if (!stateRef.current.payload) return;
      lastPoint.current = { x: pageX, y: pageY };
      place(pageX, pageY);
      hover(pageX, pageY);
      emit({ type: 'move', x: pageX, y: pageY });
    },
    [place, hover, emit],
  );

  const remeasure = useCallback(() => {
    if (!stateRef.current.payload) return;
    rects.current.clear();
    void measureZones().then(() => hover(lastPoint.current.x, lastPoint.current.y));
  }, [measureZones, hover]);

  const cancel = useCallback(() => {
    setState(IDLE);
    emit({ type: 'end' });
  }, [emit]);

  const end = useCallback(
    (pageX: number, pageY: number) => {
      const payload = stateRef.current.payload;
      setState(IDLE);
      emit({ type: 'end' });
      if (!payload) return;
      const id = hitTest(rects.current, pageX, pageY);
      const entry = id ? zones.current.get(id) : undefined;
      const rect = id ? rects.current.get(id) : undefined;
      if (!entry || !rect || (entry.accepts && !entry.accepts(payload))) return;
      entry.onDrop(payload, { x: pageX - rect.x, y: pageY - rect.y, width: rect.width, height: rect.height });
    },
    [emit],
  );

  const api = useMemo<DragApi>(
    () => ({ register, start, move, end, cancel, remeasure, monitor }),
    [register, start, move, end, cancel, remeasure, monitor],
  );
  const extra = state.payload ? state.payload.taskIds.length - 1 : 0;

  return (
    <DragApiContext.Provider value={api}>
      <DragStoreContext.Provider value={store.current}>
      <DragStateContext.Provider value={state}>
        <View ref={rootRef} style={[styles.fill, style]} collapsable={false}>
          {children}
          {state.payload ? (
            <Animated.View
              pointerEvents="none"
              testID="drag-ghost"
              style={[
                styles.ghost,
                { backgroundColor: palette.bg, borderColor: palette.acc, transform: position.getTranslateTransform() },
              ]}
            >
              <Text style={[type.bodyStrong, { color: palette.ink }]} numberOfLines={1}>
                {state.payload.task.content}
              </Text>
              {extra > 0 ? <Text style={[type.caption, { color: palette.acc }]}>{`+${extra}`}</Text> : null}
            </Animated.View>
          ) : null}
        </View>
      </DragStateContext.Provider>
      </DragStoreContext.Provider>
    </DragApiContext.Provider>
  );
}

/** `dragging` = a drag is in progress (turn scrolling off); `overId` = the zone under the finger. */
/**
 * Perf: rows ask a yes / no question of the drag state (is this the lifted row?) instead of reading all of it through
 * context, so a drag start / end / hover change redraws the rows whose answer changed, not every row of the list.
 */
export function useDragSelect<T extends boolean | number | string | null>(select: (state: DragState) => T): T {
  const store = useContext(DragStoreContext);
  return useSyncExternalStore(store ? store.subscribe : NO_SUBSCRIBE, () => select(store ? store.get() : IDLE));
}

export function useDragState(): { dragging: boolean; overId: string | null; overAfter: boolean; payload: DragPayload | null } {
  const state = useContext(DragStateContext);
  return { dragging: state.payload !== null, overId: state.overId, overAfter: state.overAfter, payload: state.payload };
}

/** The drag API of the enclosing DragProvider (null outside one): lists use it for auto-scroll. */
export function useDragApi(): DragApi | null {
  return useContext(DragApiContext);
}

interface DropZoneProps {
  id: string;
  onDrop: (payload: DragPayload, point: DropPoint) => void;
  /** false = the zone ignores this payload (no highlight, no drop). */
  accepts?: (payload: DragPayload) => boolean;
  style?: StyleProp<ViewStyle>;
  /** Style added while a draggable is over this zone; a function gets whether the finger is on the lower half. */
  overStyle?: StyleProp<ViewStyle> | ((after: boolean) => StyleProp<ViewStyle>);
  children?: ReactNode;
  testID?: string;
}

/**
 * A place tasks can be dropped on. Tests reach `onDrop` with fireEvent(zone, 'drop', payload, point): RNTL walks up to
 * this composite's prop.
 */
export function DropZone({ id, onDrop, accepts, style, overStyle, children, testID }: DropZoneProps) {
  const api = useContext(DragApiContext);
  const { overId, overAfter, payload } = useContext(DragStateContext);
  const ref = useRef<ViewRef>(null);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;
  const acceptsRef = useRef(accepts);
  acceptsRef.current = accepts;

  useEffect(() => {
    if (!api) return undefined;
    return api.register(id, {
      ref,
      onDrop: (dropped, point) => onDropRef.current(dropped, point),
      accepts: (dropped) => (acceptsRef.current ? acceptsRef.current(dropped) : true),
    });
  }, [api, id]);

  const over = overId === id && payload !== null && (!accepts || accepts(payload));
  return (
    <View
      ref={ref}
      collapsable={false}
      style={[style, over && (typeof overStyle === 'function' ? overStyle(overAfter) : overStyle)]}
      testID={testID}
    >
      {children}
    </View>
  );
}

interface DraggableProps {
  /** Built when the drag starts (the selection may have changed since the last render). */
  payload: () => DragPayload;
  /** false = a tap still works, a long press does nothing (sub-tasks, completed tasks, read-only). */
  enabled: boolean;
  onPress?: () => void;
  /**
   * Lists (Todoist): held then released WITHOUT moving = a long press (enter the multi-select), even though the task
   * was lifted for a drag; held then moved = a drag. Not draggable: a hold of LONG_PRESS_MS released in place.
   */
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
  children: ReactNode;
  testID?: string;
}

/** A long-press-to-drag wrapper (tap = onPress). Inner Pressables (the checkbox) keep their own touches. */
export function Draggable({
  payload,
  enabled,
  onPress,
  onLongPress,
  style,
  accessibilityLabel,
  accessibilityState,
  children,
  testID,
}: DraggableProps) {
  const api = useContext(DragApiContext);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPoint = useRef({ x: 0, y: 0 });
  const last = useRef({ x: 0, y: 0 });
  const active = useRef(false);
  const moved = useRef(false);
  /** The hold reached LONG_PRESS_MS (lifted, or a plain long press when not draggable). */
  const held = useRef(false);
  /** Where the task was lifted, and whether the finger left the slop since. */
  const liftPoint = useRef({ x: 0, y: 0 });
  const dragMoved = useRef(false);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clearTimer, []);

  const point = (event: GestureResponderEvent) => ({ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY });

  return (
    <View
      testID={testID}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => active.current}
      onResponderTerminationRequest={() => !active.current}
      onResponderGrant={(event) => {
        const start = point(event);
        startPoint.current = start;
        last.current = start;
        active.current = false;
        moved.current = false;
        held.current = false;
        dragMoved.current = false;
        clearTimer();
        const canDrag = enabled && api !== null;
        if (canDrag || onLongPress) {
          timer.current = setTimeout(() => {
            timer.current = null;
            held.current = true;
            if (canDrag) {
              active.current = true;
              liftPoint.current = last.current;
              api.start(payload(), last.current.x, last.current.y);
            }
          }, LONG_PRESS_MS);
        }
      }}
      onResponderMove={(event) => {
        const now = point(event);
        last.current = now;
        const beyond = (from: { x: number; y: number }) => Math.abs(now.x - from.x) > SLOP || Math.abs(now.y - from.y) > SLOP;
        if (active.current) {
          if (!dragMoved.current && beyond(liftPoint.current)) dragMoved.current = true;
          api?.move(now.x, now.y);
        } else if (beyond(startPoint.current)) {
          moved.current = true;
          clearTimer();
        }
      }}
      onResponderRelease={(event) => {
        const end = point(event);
        const wasActive = active.current;
        const wasHeld = held.current;
        clearTimer();
        active.current = false;
        held.current = false;
        if (wasActive && !dragMoved.current && onLongPress) {
          // lifted but never dragged: a long press (Todoist: hold = select)
          api?.cancel();
          onLongPress();
        } else if (wasActive) {
          api?.end(end.x, end.y);
        } else if (wasHeld) {
          if (!moved.current) onLongPress?.();
        } else if (!moved.current) {
          onPress?.();
        }
      }}
      onResponderTerminate={() => {
        clearTimer();
        if (active.current) api?.cancel();
        active.current = false;
        held.current = false;
      }}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  ghost: {
    position: 'absolute',
    left: 0,
    top: 0,
    maxWidth: 260,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: radius.control,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: -24,
    marginTop: -24,
    ...shadow,
  },
});
