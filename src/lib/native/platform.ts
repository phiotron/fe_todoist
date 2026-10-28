import { Platform } from 'react-native';

/**
 * X5 — which features exist on which OS. Android-only features (native module TasklyAndroid, widgets, launcher icons,
 * urgent alarm, share intent, completion tone) are hidden elsewhere; read at call time so tests can switch Platform.OS.
 */
export function isAndroid(os: string = Platform.OS): boolean {
  return os === 'android';
}

export function isIos(os: string = Platform.OS): boolean {
  return os === 'ios';
}
