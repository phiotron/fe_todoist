import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import i18n from '../../i18n';
import { renderWidgetByName } from './WidgetViews';
import { loadWidgetSnapshot } from './widgetSnapshot';

/**
 * Called by react-native-android-widget whenever the launcher adds, resizes or refreshes a widget (also while the app is
 * closed). It only reads the snapshot the app saved; taps are OPEN_URI / OPEN_APP, handled by Android itself.
 * Registered once in index.ts (the app entry), before expo-router starts.
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  if (props.widgetAction === 'WIDGET_DELETED' || props.widgetAction === 'WIDGET_CLICK') return;
  const snapshot = await loadWidgetSnapshot();
  const view = renderWidgetByName(props.widgetInfo.widgetName, snapshot, (key, options) => i18n.t(key, options) as string);
  if (view) props.renderWidget(view);
}
