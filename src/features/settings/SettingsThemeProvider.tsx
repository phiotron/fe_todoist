import type { ReactNode } from 'react';
import { ThemeProvider } from '../../theme';
import { useSettingsContext } from './SettingsProvider';

/** ThemeProvider driven by the theme / appearance settings (this device's theme while "Sync theme" is off). */
export function SettingsThemeProvider({ children }: { children: ReactNode }) {
  const context = useSettingsContext();
  return (
    <ThemeProvider theme={context?.settings.theme ?? 'TASKLY'} appearance={context?.settings.appearance ?? 'AUTO'}>
      {children}
    </ThemeProvider>
  );
}
