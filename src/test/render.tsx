import '../i18n';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { SessionProvider } from '../features/auth/session';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

export function createWrapper(queryClient: QueryClient) {
  return function TestProviders({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <SessionProvider>{children}</SessionProvider>
      </QueryClientProvider>
    );
  };
}

export async function renderWithProviders(ui: ReactElement, queryClient: QueryClient = createTestQueryClient()) {
  return { queryClient, ...(await render(ui, { wrapper: createWrapper(queryClient) })) };
}
