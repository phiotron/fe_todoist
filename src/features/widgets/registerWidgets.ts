import { isAndroid } from '../../lib/native/platform';

/**
 * Registers the Android widget task handler (called from index.ts, the app entry). react-native-android-widget needs
 * its native module the moment it is imported (TurboModuleRegistry.getEnforcing), so on iOS it must not even be
 * required: it would crash the app at start. Never throws — a missing library only means no widgets.
 * Returns true when the handler was registered.
 */
export function registerWidgetsIfAndroid(os?: string): boolean {
  if (!isAndroid(os)) return false;
  try {
    const { registerWidgetTaskHandler } = require('react-native-android-widget') as typeof import('react-native-android-widget');
    const { widgetTaskHandler } = require('./widgetTaskHandler') as typeof import('./widgetTaskHandler');
    registerWidgetTaskHandler(widgetTaskHandler);
    return true;
  } catch {
    return false;
  }
}
