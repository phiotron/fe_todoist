import { Platform } from 'react-native';
import i18n from '../../i18n';
import type { WidgetSnapshot } from './widgetSnapshot';

/**
 * Asks the launcher to redraw the widgets with a new snapshot (M12). The widget library is native and exists only in a
 * development build made after M12, so it is loaded on demand and every failure is swallowed: the widgets then catch
 * up at their next update.
 */
export async function refreshWidgets(snapshot: WidgetSnapshot): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const { requestWidgetUpdate } = await import('react-native-android-widget');
    const { WIDGET_NAMES, renderWidgetByName } = await import('./WidgetViews');
    const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options) as string;
    for (const widgetName of WIDGET_NAMES) {
      await requestWidgetUpdate({
        widgetName,
        renderWidget: () => renderWidgetByName(widgetName, snapshot, t) ?? renderWidgetByName('AddTask', snapshot, t)!,
      });
    }
  } catch {
    // library missing or the launcher refused: nothing to do
  }
}
