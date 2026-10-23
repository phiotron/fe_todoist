import { memoryTokenStore } from '../../test/memoryTokenStore';
import { jsonResponse, mockFetch, problem, requestAt, textResponse } from '../../test/http';
import { createApiClient } from '../client';
import { ApiError, NetworkError } from '../errors';

const BASE_URL = 'http://api.test';

function setup(tokens = memoryTokenStore({ accessToken: 'acc-1', refreshToken: 'ref-1' })) {
  const fetchMock = mockFetch();
  const onSessionExpired = jest.fn();
  const api = createApiClient({ baseUrl: BASE_URL, tokens, onSessionExpired });
  return { api, fetchMock, tokens, onSessionExpired };
}

describe('apiFetch — request & response', () => {
  it('sends GET with the bearer token and parses JSON', async () => {
    const { api, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { hello: 'world' }));

    await expect(api<{ hello: string }>('/api/v1/me')).resolves.toEqual({ hello: 'world' });

    const request = requestAt(fetchMock, 0);
    expect(request.url).toBe('http://api.test/api/v1/me');
    expect(request.method).toBe('GET');
    expect(request.headers.Authorization).toBe('Bearer acc-1');
    expect(request.headers.Accept).toBe('application/json');
    expect(request.headers['Content-Type']).toBeUndefined();
  });

  it('sends a JSON body on POST', async () => {
    const { api, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { id: 'x' }));

    await api('/api/v1/things', { method: 'POST', body: { name: 'A' } });

    const request = requestAt(fetchMock, 0);
    expect(request.method).toBe('POST');
    expect(request.headers['Content-Type']).toBe('application/json');
    expect(request.body).toEqual({ name: 'A' });
  });

  it('does not attach a token when auth is false', async () => {
    const { api, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

    await api('/api/v1/auth/login', { method: 'POST', body: {}, auth: false });

    expect(requestAt(fetchMock, 0).headers.Authorization).toBeUndefined();
  });

  it('does not attach Authorization when no token is stored', async () => {
    const { api, fetchMock } = setup(memoryTokenStore());
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));

    await api('/api/v1/anything');

    expect(requestAt(fetchMock, 0).headers.Authorization).toBeUndefined();
  });

  it('resolves undefined for 204 No Content', async () => {
    const { api, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(jsonResponse(204));

    await expect(api<void>('/api/v1/auth/logout', { method: 'POST', body: {} })).resolves.toBeUndefined();
  });

  it('turns a ProblemDetail body into ApiError', async () => {
    const { api, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(
      problem(400, 'Bad Request', {
        detail: 'Validation failed',
        errors: [{ field: 'email', message: 'must be a well-formed email address' }],
      }),
    );

    const error = await api('/api/v1/auth/register', { method: 'POST', body: {} }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      title: 'Bad Request',
      detail: 'Validation failed',
      errors: [{ field: 'email', message: 'must be a well-formed email address' }],
    });
  });

  it('falls back to statusText when the error body is not JSON', async () => {
    const { api, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(textResponse(502, '<html>Bad gateway</html>', 'Bad Gateway'));

    await expect(api('/api/v1/me')).rejects.toMatchObject({ status: 502, title: 'Bad Gateway' });
  });

  it('wraps fetch failures in NetworkError', async () => {
    const { api, fetchMock } = setup();
    fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));

    await expect(api('/api/v1/me')).rejects.toBeInstanceOf(NetworkError);
  });
});

describe('apiFetch — body handling', () => {
  it('throws ApiError "Invalid response body" when a 2xx body is not JSON', async () => {
    const { api, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(textResponse(200, '<html>captive portal</html>'));

    const error = await api('/api/v1/me').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 200, title: 'Invalid response body' });
  });

  it('treats a whitespace-only 2xx body as empty', async () => {
    const { api, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(textResponse(200, '   '));

    await expect(api('/api/v1/me')).resolves.toBeUndefined();
  });

  it('throws NetworkError when reading the body fails', async () => {
    const { api, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: '',
      text: () => Promise.reject(new TypeError('Network request failed')),
    } as unknown as Response);

    await expect(api('/api/v1/me')).rejects.toBeInstanceOf(NetworkError);
  });
});
