import { useMemo, type ReactNode } from 'react';
import { useDeviceSettings } from '../../lib/device/deviceSettings';
import { getTasklyAndroid, supportsDynamicColor } from '../../lib/native/tasklyAndroid';
import { ThemeProvider } from '../../theme';
import { useSettingsContext } from './SettingsProvider';

/**
 * ThemeProvider driven by the theme / appearance settings (this device's theme while "Sync theme" is off).
 * M12: with Dynamic Color on (this device, Android 12+) the accent colours come from the system.
 */
export function SettingsThemeProvider({ children }: { children: ReactNode }) {
  const context = useSettingsContext();
  const { dynamicColor } = useDeviceSettings();
  const dynamicColors = useMemo(
    () => (dynamicColor && supportsDynamicColor() ? (getTasklyAndroid()?.getDynamicColors() ?? null) : null),
    [dynamicColor],
  );
  return (
    <ThemeProvider
      theme={context?.settings.theme ?? 'TASKLY'}
      appearance={context?.settings.appearance ?? 'AUTO'}
      dynamicColors={dynamicColors}
    >
      {children}
    </ThemeProvider>
  );
}
