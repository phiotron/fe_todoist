import { problem, type FetchMock, type RecordedRequest } from './http';

export interface RoutedRequest extends RecordedRequest {
  /** URL path without the query string, e.g. /api/v1/tasks. */
  path: string;
  query: URLSearchParams;
}

export type RouteHandler = (request: RoutedRequest) => Response | Promise<Response>;

/** Keys are "METHOD /path" (query string ignored), e.g. "GET /api/v1/tasks". */
export type ApiRoutes = Record<string, RouteHandler>;

function toRouted(input: unknown, init: RequestInit | undefined): RoutedRequest {
  const url = new URL(String(input));
  return {
    url: url.toString(),
    method: init?.method ?? 'GET',
    headers: (init?.headers ?? {}) as Record<string, string>,
    body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    path: url.pathname,
    query: url.searchParams,
  };
}

/** Answers fetch by route; an unmocked route gets 501 so a missing mock fails loudly. */
export function routeApi(fetchMock: FetchMock, routes: ApiRoutes): void {
  fetchMock.mockImplementation(async (input, init) => {
    const request = toRouted(input, init);
    const handler = routes[`${request.method} ${request.path}`];
    return handler ? handler(request) : problem(501, `No mock for ${request.method} ${request.path}`);
  });
}

/** Every recorded call to one route, in order. */
export function requestsTo(fetchMock: FetchMock, method: string, path: string): RoutedRequest[] {
  return fetchMock.mock.calls
    .map(([input, init]) => toRouted(input, init))
    .filter((request) => request.method === method && request.path === path);
}
