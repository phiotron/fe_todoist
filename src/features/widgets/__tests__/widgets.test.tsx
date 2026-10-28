import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReactElement } from 'react';
import appConfig from '../../../../app.json';
import en from '../../../i18n/locales/en/android.json';
import { widgetColors } from '../../../theme/widgetColors';
import { AddTaskWidget, ProductivityWidget, TaskListWidget, WIDGET_NAMES, renderWidgetByName, type WidgetText } from '../WidgetViews';
import {
  SIGNED_OUT_SNAPSHOT,
  WIDGET_SNAPSHOT_KEY,
  WIDGET_TASK_LIMIT,
  buildWidgetSnapshot,
  clearWidgetSnapshot,
  loadWidgetSnapshot,
  saveWidgetSnapshot,
  type WidgetSnapshot,
} from '../widgetSnapshot';
import { widgetTaskHandler } from '../widgetTaskHandler';

const t: WidgetText = (key, options) => (options ? `${key}${JSON.stringify(options)}` : key);
const colors = widgetColors.light;
const TASK_ID = '5b0d6c3e-9a4f-4f6e-8a51-2f2d7e4c1b90';

/** Flattens a widget element tree into [props of every element], without rendering anything. */
function collect(node: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(node)) {
    node.forEach((child) => collect(child, out));
  } else if (node && typeof node === 'object' && 'props' in node) {
    const props = (node as ReactElement<Record<string, unknown>>).props;
    out.push(props);
    collect(props.children, out);
  }
  return out;
}
const texts = (node: unknown) => collect(node).flatMap((props) => (typeof props.text === 'string' ? [props.text] : []));
const uris = (node: unknown) =>
  collect(node).flatMap((props) => {
    const data = props.clickActionData as { uri?: string } | undefined;
    return props.clickAction === 'OPEN_URI' && data?.uri ? [data.uri] : [];
  });

function snapshot(overrides: Partial<WidgetSnapshot> = {}): WidgetSnapshot {
  return { signedIn: true, tasks: [], taskCount: 0, productivity: null, updatedAt: 1, ...overrides };
}

describe('widget snapshot', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('keeps open tasks only, at most 10, and counts them all', () => {
    const tasks: { id: string; content: string; completedAt: string | null }[] = Array.from({ length: 14 }, (_, index) => ({
      id: `t-${index}`,
      content: `Việc ${index}`,
      completedAt: null,
    }));
    tasks.push({ id: 'done', content: 'Xong', completedAt: '2026-10-23T03:00:00Z' });

    const built = buildWidgetSnapshot(tasks, { done: 2, goal: 5 }, 99);

    expect(built.tasks).toHaveLength(WIDGET_TASK_LIMIT);
    expect(built.tasks[0]).toEqual({ id: 't-0', content: 'Việc 0' });
    expect(built.taskCount).toBe(14);
    expect(built).toMatchObject({ signedIn: true, productivity: { done: 2, goal: 5 }, updatedAt: 99 });
  });

  it('saves and loads it; unreadable or missing data counts as signed out', async () => {
    const saved = snapshot({ tasks: [{ id: 'a', content: 'A' }], taskCount: 1 });
    await saveWidgetSnapshot(saved);
    expect(await loadWidgetSnapshot()).toEqual(saved);

    await AsyncStorage.setItem(WIDGET_SNAPSHOT_KEY, '{not json');
    expect(await loadWidgetSnapshot()).toEqual(SIGNED_OUT_SNAPSHOT);
    await AsyncStorage.removeItem(WIDGET_SNAPSHOT_KEY);
    expect(await loadWidgetSnapshot()).toEqual(SIGNED_OUT_SNAPSHOT);
  });

  it('drops malformed rows when loading', async () => {
    await AsyncStorage.setItem(
      WIDGET_SNAPSHOT_KEY,
      JSON.stringify({ signedIn: true, tasks: [{ id: 'a', content: 'A' }, { id: 1 }, null], taskCount: 'x', productivity: { done: 'a' } }),
    );

    expect(await loadWidgetSnapshot()).toMatchObject({ tasks: [{ id: 'a', content: 'A' }], taskCount: 3, productivity: null });
  });

  it('signing out removes it', async () => {
    await saveWidgetSnapshot(snapshot({ tasks: [{ id: 'a', content: 'A' }], taskCount: 1 }));

    await clearWidgetSnapshot();

    expect(await AsyncStorage.getItem(WIDGET_SNAPSHOT_KEY)).toBeNull();
    expect(await loadWidgetSnapshot()).toEqual(SIGNED_OUT_SNAPSHOT);
  });
});

describe('widget views', () => {
  it('Add task: one tap opens Quick Add', () => {
    const tree = AddTaskWidget({ colors, t });

    expect(uris(tree)).toEqual(['taskly://quick-add']);
    expect(texts(tree)).toContain('android.widget.addTask');
  });

  it('Task list: each task opens its own screen, the title opens Today, extra tasks are counted', () => {
    const tree = TaskListWidget({
      colors,
      t,
      snapshot: snapshot({ tasks: [{ id: TASK_ID, content: 'Mua sữa' }], taskCount: 4 }),
    });

    expect(texts(tree)).toEqual(
      expect.arrayContaining(['android.widget.taskListTitle', 'Mua sữa', 'android.widget.taskListMore{"count":3}']),
    );
    expect(uris(tree)).toEqual(['taskly://today', `taskly://task/${TASK_ID}`]);
  });

  it('Task list: empty state, and a request to sign in when signed out', () => {
    expect(texts(TaskListWidget({ colors, t, snapshot: snapshot() }))).toContain('android.widget.taskListEmpty');
    expect(texts(TaskListWidget({ colors, t, snapshot: SIGNED_OUT_SNAPSHOT }))).toContain('android.widget.needsSignIn');
  });

  it('Productivity: progress from M10 data, an empty state until then, sign-in when signed out', () => {
    expect(texts(ProductivityWidget({ colors, t, snapshot: snapshot({ productivity: { done: 3, goal: 5 } }) }))).toContain(
      'android.widget.productivityProgress{"done":3,"goal":5}',
    );
    expect(texts(ProductivityWidget({ colors, t, snapshot: snapshot() }))).toContain('android.widget.productivityEmpty');
    expect(texts(ProductivityWidget({ colors, t, snapshot: SIGNED_OUT_SNAPSHOT }))).toContain('android.widget.needsSignIn');
  });

  it('renders light and dark variants of each known widget, nothing for an unknown one', () => {
    for (const name of WIDGET_NAMES) {
      const view = renderWidgetByName(name, snapshot(), t);
      expect(view?.light).toBeTruthy();
      expect(view?.dark).toBeTruthy();
    }
    expect(renderWidgetByName('Nope', snapshot(), t)).toBeNull();
  });
});

describe('widget task handler', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  const props = (widgetAction: string, widgetName = 'TaskList') =>
    ({ widgetAction, widgetInfo: { widgetName }, renderWidget: jest.fn() }) as never as Parameters<typeof widgetTaskHandler>[0] & {
      renderWidget: jest.Mock;
    };

  it('draws the saved snapshot when a widget is added or refreshed', async () => {
    await saveWidgetSnapshot(snapshot({ tasks: [{ id: 'a', content: 'A' }], taskCount: 1 }));

    for (const action of ['WIDGET_ADDED', 'WIDGET_UPDATE', 'WIDGET_RESIZED']) {
      const handlerProps = props(action);
      await widgetTaskHandler(handlerProps);
      expect(handlerProps.renderWidget).toHaveBeenCalledTimes(1);
    }
  });

  it('does nothing when deleted or clicked (Android opens the link itself)', async () => {
    for (const action of ['WIDGET_DELETED', 'WIDGET_CLICK']) {
      const handlerProps = props(action);
      await widgetTaskHandler(handlerProps);
      expect(handlerProps.renderWidget).not.toHaveBeenCalled();
    }
  });

  it('draws nothing for a widget it does not know', async () => {
    const handlerProps = props('WIDGET_UPDATE', 'Unknown');

    await widgetTaskHandler(handlerProps);

    expect(handlerProps.renderWidget).not.toHaveBeenCalled();
  });
});

describe('widget declaration (app.json)', () => {
  const plugin = appConfig.expo.plugins.find((entry) => Array.isArray(entry) && entry[0] === 'react-native-android-widget') as
    | [string, { widgets: { name: string; description: string }[] }]
    | undefined;

  it('declares the three widgets the views draw', () => {
    expect(plugin?.[1].widgets.map((widget) => widget.name)).toEqual([...WIDGET_NAMES]);
  });

  it('describes them with the same words as the English bundle', () => {
    const descriptions = plugin?.[1].widgets.map((widget) => widget.description);

    expect(descriptions).toEqual([
      en.android.widget.descriptionAddTask,
      en.android.widget.descriptionTaskList,
      en.android.widget.descriptionProductivity,
    ]);
  });

  it('turns on background location and the M12 config plugin', () => {
    expect(appConfig.expo.plugins).toContain('./plugins/withTasklyAndroid');
    expect(appConfig.expo.plugins).toContainEqual(['expo-location', expect.objectContaining({ isAndroidBackgroundLocationEnabled: true })]);
  });
});
