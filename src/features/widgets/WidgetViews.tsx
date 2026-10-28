import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { buildDeepLink } from '../../lib/links/deepLinks';
import { widgetColors, type WidgetColors } from '../../theme/widgetColors';
import type { WidgetSnapshot } from './widgetSnapshot';

/** Names of the three widgets: the config plugin (plugins/withTasklyAndroid.js) declares the same ones. */
export const WIDGET_NAMES = ['AddTask', 'TaskList', 'Productivity'] as const;
export type WidgetName = (typeof WIDGET_NAMES)[number];

/** Translator the widget views use (i18next's t, or a fake in tests). */
export type WidgetText = (key: string, options?: Record<string, unknown>) => string;

const open = (uri: string) => ({ clickAction: 'OPEN_URI' as const, clickActionData: { uri } });

function frame(colors: WidgetColors, children: unknown, uri?: string) {
  return (
    <FlexWidget
      style={{ flex: 1, flexDirection: 'column', padding: 12, backgroundColor: colors.bg as `#${string}`, borderRadius: 20 }}
      {...(uri ? open(uri) : { clickAction: 'OPEN_APP' })}
    >
      {children}
    </FlexWidget>
  );
}

/** "Add task": one big tap opens Quick Add. */
export function AddTaskWidget({ colors, t }: { colors: WidgetColors; t: WidgetText }) {
  return frame(
    colors,
    <FlexWidget style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexGap: 8 }}>
      <TextWidget text="+" style={{ fontSize: 28, fontWeight: '700', color: colors.acc as `#${string}` }} />
      <TextWidget text={t('android.widget.addTask')} style={{ fontSize: 16, fontWeight: '600', color: colors.ink as `#${string}` }} />
    </FlexWidget>,
    buildDeepLink({ kind: 'quickAdd' }),
  );
}

/** "Task list": today's open tasks (≤ 10 from the snapshot); each row opens its task, the title opens Today. */
export function TaskListWidget({ colors, t, snapshot }: { colors: WidgetColors; t: WidgetText; snapshot: WidgetSnapshot }) {
  const ink = colors.ink as `#${string}`;
  const mute = colors.mute as `#${string}`;
  const hidden = Math.max(0, snapshot.taskCount - snapshot.tasks.length);
  return frame(
    colors,
    <>
      <TextWidget
        text={t('android.widget.taskListTitle')}
        style={{ fontSize: 16, fontWeight: '700', color: ink }}
        {...open(buildDeepLink({ kind: 'today' }))}
      />
      {!snapshot.signedIn ? (
        <TextWidget text={t('android.widget.needsSignIn')} style={{ fontSize: 14, color: mute }} />
      ) : snapshot.tasks.length === 0 ? (
        <TextWidget text={t('android.widget.taskListEmpty')} style={{ fontSize: 14, color: mute }} />
      ) : (
        snapshot.tasks.map((task) => (
          <TextWidget
            key={task.id}
            text={task.content}
            maxLines={1}
            truncate="END"
            style={{ fontSize: 14, color: ink }}
            {...open(buildDeepLink({ kind: 'task', id: task.id }))}
          />
        ))
      )}
      {hidden > 0 ? <TextWidget text={t('android.widget.taskListMore', { count: hidden })} style={{ fontSize: 12, color: mute }} /> : null}
    </>,
  );
}

/** "Productivity": today's progress against the daily goal (M10 data; empty state until then). */
export function ProductivityWidget({ colors, t, snapshot }: { colors: WidgetColors; t: WidgetText; snapshot: WidgetSnapshot }) {
  const ink = colors.ink as `#${string}`;
  const mute = colors.mute as `#${string}`;
  const productivity = snapshot.signedIn ? snapshot.productivity : null;
  return frame(
    colors,
    <>
      <TextWidget text={t('android.widget.productivityTitle')} style={{ fontSize: 16, fontWeight: '700', color: ink }} />
      {!snapshot.signedIn ? (
        <TextWidget text={t('android.widget.needsSignIn')} style={{ fontSize: 14, color: mute }} />
      ) : productivity ? (
        <TextWidget
          text={t('android.widget.productivityProgress', { done: productivity.done, goal: productivity.goal })}
          style={{ fontSize: 20, fontWeight: '700', color: colors.acc as `#${string}` }}
        />
      ) : (
        <TextWidget text={t('android.widget.productivityEmpty')} style={{ fontSize: 14, color: mute }} />
      )}
    </>,
  );
}

/** Both colour schemes of a widget (the library picks by the launcher's theme). */
export function renderWidgetByName(name: string, snapshot: WidgetSnapshot, t: WidgetText) {
  const make = (colors: WidgetColors) => {
    switch (name) {
      case 'AddTask':
        return <AddTaskWidget colors={colors} t={t} />;
      case 'TaskList':
        return <TaskListWidget colors={colors} t={t} snapshot={snapshot} />;
      case 'Productivity':
        return <ProductivityWidget colors={colors} t={t} snapshot={snapshot} />;
      default:
        return null;
    }
  };
  const light = make(widgetColors.light);
  return light ? { light, dark: make(widgetColors.dark) } : null;
}
