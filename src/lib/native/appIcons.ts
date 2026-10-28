/**
 * M12 — launcher icons the app can show. The first is the main launcher activity; each other one is an
 * `activity-alias` added by plugins/withTasklyAndroid.js (same names), switched on by the TasklyAndroid module.
 */
export const APP_ICON_NAMES = ['default', 'dark', 'light'] as const;
export type AppIconName = (typeof APP_ICON_NAMES)[number];

export function isAppIconName(value: string): value is AppIconName {
  return (APP_ICON_NAMES as readonly string[]).includes(value);
}
