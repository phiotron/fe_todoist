import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  Animated,
  StyleSheet,
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
}

interface DragApi {
  register: (id: string, entry: ZoneEntry) => () => void;
  start: (payload: DragPayload, pageX: number, pageY: number) => void;
  move: (pageX: number, pageY: number) => void;
  end: (pageX: number, pageY: number) => void;
  cancel: () => void;
}

const DragStateContext = createContext<DragState>({ payload: null, overId: null });
const DragApiContext = createContext<DragApi | null>(null);

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
  const [state, setState] = useState<DragState>({ payload: null, overId: null });
  const stateRef = useRef(state);
  stateRef.current = state;

  const register = useCallback((id: string, entry: ZoneEntry) => {
    zones.current.set(id, entry);
    return () => {
      if (zones.current.get(id) === entry) zones.current.delete(id);
      rects.current.delete(id);
    };
  }, []);

  const place = useCallback(
    (pageX: number, pageY: number) => position.setValue({ x: pageX - origin.current.x, y: pageY - origin.current.y }),
    [position],
  );

  const start = useCallback(
    (payload: DragPayload, pageX: number, pageY: number) => {
      rects.current.clear();
      void measure(rootRef).then((rect) => {
        if (rect) origin.current = { x: rect.x, y: rect.y };
        place(pageX, pageY);
      });
      for (const [id, entry] of zones.current) {
        void measure(entry.ref).then((rect) => {
          if (rect) rects.current.set(id, rect);
        });
      }
      place(pageX, pageY);
      setState({ payload, overId: null });
    },
    [place],
  );

  const move = useCallback(
    (pageX: number, pageY: number) => {
      if (!stateRef.current.payload) return;
      place(pageX, pageY);
      const overId = hitTest(rects.current, pageX, pageY);
      if (overId !== stateRef.current.overId) setState((current) => ({ ...current, overId }));
    },
    [place],
  );

  const cancel = useCallback(() => setState({ payload: null, overId: null }), []);

  const end = useCallback(
    (pageX: number, pageY: number) => {
      const payload = stateRef.current.payload;
      setState({ payload: null, overId: null });
      if (!payload) return;
      const id = hitTest(rects.current, pageX, pageY);
      const entry = id ? zones.current.get(id) : undefined;
      const rect = id ? rects.current.get(id) : undefined;
      if (!entry || !rect || (entry.accepts && !entry.accepts(payload))) return;
      entry.onDrop(payload, { x: pageX - rect.x, y: pageY - rect.y });
    },
    [],
  );

  const api = useMemo<DragApi>(() => ({ register, start, move, end, cancel }), [register, start, move, end, cancel]);
  const extra = state.payload ? state.payload.taskIds.length - 1 : 0;

  return (
    <DragApiContext.Provider value={api}>
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
    </DragApiContext.Provider>
  );
}

/** `dragging` = a drag is in progress (turn scrolling off); `overId` = the zone under the finger. */
export function useDragState(): { dragging: boolean; overId: string | null; payload: DragPayload | null } {
  const state = useContext(DragStateContext);
  return { dragging: state.payload !== null, overId: state.overId, payload: state.payload };
}

interface DropZoneProps {
  id: string;
  onDrop: (payload: DragPayload, point: DropPoint) => void;
  /** false = the zone ignores this payload (no highlight, no drop). */
  accepts?: (payload: DragPayload) => boolean;
  style?: StyleProp<ViewStyle>;
  /** Style added while a draggable is over this zone. */
  overStyle?: StyleProp<ViewStyle>;
  children?: ReactNode;
  testID?: string;
}

/**
 * A place tasks can be dropped on. Tests reach `onDrop` with fireEvent(zone, 'drop', payload, point): RNTL walks up to
 * this composite's prop.
 */
export function DropZone({ id, onDrop, accepts, style, overStyle, children, testID }: DropZoneProps) {
  const api = useContext(DragApiContext);
  const { overId, payload } = useContext(DragStateContext);
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
    <View ref={ref} collapsable={false} style={[style, over && overStyle]} testID={testID}>
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
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  children: ReactNode;
  testID?: string;
}

/** A long-press-to-drag wrapper (tap = onPress). Inner Pressables (the checkbox) keep their own touches. */
export function Draggable({ payload, enabled, onPress, style, accessibilityLabel, children, testID }: DraggableProps) {
  const api = useContext(DragApiContext);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPoint = useRef({ x: 0, y: 0 });
  const last = useRef({ x: 0, y: 0 });
  const active = useRef(false);
  const moved = useRef(false);

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
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => active.current}
      onResponderTerminationRequest={() => !active.current}
      onResponderGrant={(event) => {
        const start = point(event);
        startPoint.current = start;
        last.current = start;
        active.current = false;
        moved.current = false;
        clearTimer();
        if (enabled && api) {
          timer.current = setTimeout(() => {
            timer.current = null;
            active.current = true;
            api.start(payload(), last.current.x, last.current.y);
          }, LONG_PRESS_MS);
        }
      }}
      onResponderMove={(event) => {
        const now = point(event);
        last.current = now;
        if (active.current) {
          api?.move(now.x, now.y);
        } else if (Math.abs(now.x - startPoint.current.x) > SLOP || Math.abs(now.y - startPoint.current.y) > SLOP) {
          moved.current = true;
          clearTimer();
        }
      }}
      onResponderRelease={(event) => {
        const end = point(event);
        const wasActive = active.current;
        const pending = timer.current !== null || !enabled;
        clearTimer();
        active.current = false;
        if (wasActive) api?.end(end.x, end.y);
        else if (pending && !moved.current) onPress?.();
      }}
      onResponderTerminate={() => {
        clearTimer();
        if (active.current) api?.cancel();
        active.current = false;
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
