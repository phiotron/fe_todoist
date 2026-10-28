import AsyncStorage from '@react-native-async-storage/async-storage';
import { refreshWidgets } from './widgetBridge';

/**
 * M12 — what the home-screen widgets show. Widgets run outside the app UI and must not hold the sign-in token, so they
 * never call the API: the app writes this snapshot (from the Today list) whenever it changes, and the widget handler
 * only reads it. Signing out clears it.
 */
export const WIDGET_SNAPSHOT_KEY = 'taskly.widgetSnapshot';
export const WIDGET_TASK_LIMIT = 10;

export interface WidgetTask {
  id: string;
  content: string;
}

export interface WidgetProductivity {
  /** Tasks completed today. */
  done: number;
  /** Daily goal (M10). */
  goal: number;
}

export interface WidgetSnapshot {
  signedIn: boolean;
  /** Open tasks due today, at most WIDGET_TASK_LIMIT. */
  tasks: WidgetTask[];
  /** How many open tasks are due today (can exceed tasks.length). */
  taskCount: number;
  /** null until M10 provides the numbers. */
  productivity: WidgetProductivity | null;
  updatedAt: number;
}

export const SIGNED_OUT_SNAPSHOT: WidgetSnapshot = {
  signedIn: false,
  tasks: [],
  taskCount: 0,
  productivity: null,
  updatedAt: 0,
};

/** Open tasks of Today → snapshot: root and sub-tasks alike, in list order, names cut to one line's worth. */
export function buildWidgetSnapshot(
  todayTasks: readonly { id: string; content: string; completedAt?: string | null }[],
  productivity: WidgetProductivity | null,
  nowMs: number,
): WidgetSnapshot {
  const open = todayTasks.filter((task) => !task.completedAt);
  return {
    signedIn: true,
    tasks: open.slice(0, WIDGET_TASK_LIMIT).map((task) => ({ id: task.id, content: task.content })),
    taskCount: open.length,
    productivity,
    updatedAt: nowMs,
  };
}

export async function saveWidgetSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  try {
    await AsyncStorage.setItem(WIDGET_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // widgets keep the old picture
  }
}

/** Never throws; anything unreadable counts as signed out (the widget then asks to sign in). */
export async function loadWidgetSnapshot(): Promise<WidgetSnapshot> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_SNAPSHOT_KEY);
    if (!raw) return SIGNED_OUT_SNAPSHOT;
    const value = JSON.parse(raw) as Partial<WidgetSnapshot>;
    if (value.signedIn !== true || !Array.isArray(value.tasks)) return SIGNED_OUT_SNAPSHOT;
    return {
      signedIn: true,
      tasks: value.tasks.filter((task): task is WidgetTask => typeof task?.id === 'string' && typeof task.content === 'string'),
      taskCount: typeof value.taskCount === 'number' ? value.taskCount : value.tasks.length,
      productivity:
        value.productivity && typeof value.productivity.done === 'number' && typeof value.productivity.goal === 'number'
          ? value.productivity
          : null,
      updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : 0,
    };
  } catch {
    return SIGNED_OUT_SNAPSHOT;
  }
}

/** Sign-out: the widgets must not keep showing the previous user's tasks. Never throws. */
export async function clearWidgetSnapshot(): Promise<void> {
  try {
    await AsyncStorage.removeItem(WIDGET_SNAPSHOT_KEY);
    await refreshWidgets(SIGNED_OUT_SNAPSHOT);
  } catch {
    // nothing to refresh
  }
}
