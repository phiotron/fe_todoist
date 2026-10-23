export type FetchMock = jest.MockedFunction<typeof fetch>;

/** Minimal Response stand-in: the client only reads ok, status, statusText and text(). */
export function textResponse(status: number, text: string, statusText = ''): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    text: async () => text,
  } as unknown as Response;
}

export function jsonResponse(status: number, body?: unknown): Response {
  return textResponse(status, body === undefined ? '' : JSON.stringify(body));
}

export function problem(status: number, title: string, extra: Record<string, unknown> = {}): Response {
  return jsonResponse(status, { type: 'about:blank', title, status, instance: '/test', ...extra });
}

export function mockFetch(): FetchMock {
  const fn = jest.fn() as FetchMock;
  globalThis.fetch = fn;
  return fn;
}

export interface RecordedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

export function requestAt(fetchMock: FetchMock, index: number): RecordedRequest {
  const [input, init] = fetchMock.mock.calls[index] ?? [];
  return {
    url: String(input),
    method: init?.method ?? 'GET',
    headers: (init?.headers ?? {}) as Record<string, string>,
    body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
  };
}

export function countRequests(fetchMock: FetchMock, pathSuffix: string): number {
  return fetchMock.mock.calls.filter(([input]) => String(input).endsWith(pathSuffix)).length;
}
