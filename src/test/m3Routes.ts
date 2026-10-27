import type { FetchMock, RecordedRequest } from './http';

export type RouteHandler = (request: RecordedRequest) => Response | Promise<Response>;

/**
 * Answers fetch by "METHOD /path" (query string ignored). A missing route rejects (the client reports a
 * NetworkError); the message names the route so a forgotten mock is easy to spot.
 */
export function routeFetch(fetchMock: FetchMock, routes: Record<string, RouteHandler>): void {
  fetchMock.mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const path = url.replace(/^[a-z]+:\/\/[^/]+/i, '').split('?')[0];
    const handler = routes[`${method} ${path}`];
    if (!handler) throw new Error(`routeFetch: no route for ${method} ${path}`);
    return handler({
      url,
      method,
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    });
  });
}

export interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
}

/** A promise the test resolves by hand, to hold a request "in flight". */
export function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
