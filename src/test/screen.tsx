import type { QueryClient } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { SnackbarProvider } from '../components/Snackbar';
import { tokenStore } from '../lib/tokenStore';
import { routeApi, type ApiRoutes } from './apiRoutes';
import { testUser } from './fixtures';
import { jsonResponse, mockFetch } from './http';
import { createTestQueryClient, renderWithProviders } from './render';

/**
 * Renders a signed-in screen inside a SnackbarProvider (like the (app) layout): tokens stored, GET /me answered,
 * other routes from `routes`. Pass a pre-filled `queryClient` to simulate data already cached (offline with cache).
 */
export async function renderSignedIn(
  ui: ReactElement,
  routes: ApiRoutes = {},
  queryClient: QueryClient = createTestQueryClient(),
) {
  await tokenStore.setTokens({ accessToken: 'acc-1', refreshToken: 'ref-1' });
  const fetchMock = mockFetch();
  const allRoutes: ApiRoutes = { 'GET /api/v1/me': () => jsonResponse(200, testUser), ...routes };
  routeApi(fetchMock, allRoutes);
  const rendered = await renderWithProviders(<SnackbarProvider>{ui}</SnackbarProvider>, queryClient);
  /** Replace the routes mid-test (GET /me stays answered). */
  const setRoutes = (next: ApiRoutes) =>
    routeApi(fetchMock, { 'GET /api/v1/me': () => jsonResponse(200, testUser), ...next });
  return { fetchMock, setRoutes, ...rendered };
}
