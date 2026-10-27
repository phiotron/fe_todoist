import '../i18n';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { SessionProvider } from '../features/auth/session';
import { SettingsProvider } from '../features/settings/SettingsProvider';
import { SettingsThemeProvider } from '../features/settings/SettingsThemeProvider';
import type { SettingsStorage } from '../features/settings/settingsStore';
import { memorySettingsStorage } from './memorySettingsStorage';
import { createTestQueryClient } from './render';

export const TEST_DEVICE_TIME_ZONE = 'Asia/Ho_Chi_Minh';

export interface SettingsWrapperOptions {
  queryClient: QueryClient;
  storage: SettingsStorage;
  deviceTimeZone: string | null;
}

export function createSettingsWrapper({ queryClient, storage, deviceTimeZone }: SettingsWrapperOptions) {
  return function SettingsTestProviders({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <SettingsProvider storage={storage} deviceTimeZone={deviceTimeZone}>
            <SettingsThemeProvider>{children}</SettingsThemeProvider>
          </SettingsProvider>
        </SessionProvider>
      </QueryClientProvider>
    );
  };
}

export interface RenderWithSettingsOptions {
  queryClient?: QueryClient;
  storage?: SettingsStorage;
  /** undefined → TEST_DEVICE_TIME_ZONE; null → the device does not report a zone. */
  deviceTimeZone?: string | null;
}

export async function renderWithSettings(ui: ReactElement, options: RenderWithSettingsOptions = {}) {
  const queryClient = options.queryClient ?? createTestQueryClient();
  const storage = options.storage ?? memorySettingsStorage();
  const deviceTimeZone = options.deviceTimeZone === undefined ? TEST_DEVICE_TIME_ZONE : options.deviceTimeZone;
  const result = await render(ui, { wrapper: createSettingsWrapper({ queryClient, storage, deviceTimeZone }) });
  return { queryClient, storage, ...result };
}
