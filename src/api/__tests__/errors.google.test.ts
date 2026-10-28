import { ApiError, problemToApiError } from '../errors';

/** The ApiError the client builds for a ProblemDetail with this body (title / status are always present). */
function problemOf(status: number, body: Record<string, unknown>): ApiError {
  return problemToApiError(status, 'x', JSON.stringify({ title: 'x', status, ...body }));
}

describe('ApiError — what the Google sign-in reads from a ProblemDetail', () => {
  it('keeps the code and the linkToken extension of a 409 link-required answer', () => {
    const error = problemOf(409, { code: 'link-required', linkToken: 'lt-1' });

    expect(error.status).toBe(409);
    expect(error.code).toBe('link-required');
    expect(error.properties).toMatchObject({ status: 409, code: 'link-required', linkToken: 'lt-1' });
  });

  it('keeps the twoFactorToken of a 401 two-factor-required answer (auth/google, like auth/login)', () => {
    const error = problemOf(401, { code: 'two-factor-required', twoFactorToken: 'tf-1' });

    expect(error.status).toBe(401);
    expect(error.code).toBe('two-factor-required');
    expect(error.properties.twoFactorToken).toBe('tf-1');
  });

  it('adds properties without dropping the fields of M1 (limit, max, requestId, current)', () => {
    const error = problemOf(422, {
      code: 'limit-reached',
      limit: 'PROJECTS',
      max: 5,
      requestId: 'r-1',
      current: { id: 'p-1' },
      linkToken: 'lt-1',
    });

    expect(error).toMatchObject({ status: 422, code: 'limit-reached', limit: 'PROJECTS', max: 5, requestId: 'r-1' });
    expect(error.current).toEqual({ id: 'p-1' });
    expect(error.properties.linkToken).toBe('lt-1');
  });

  it('has no code and empty properties when the error body is not JSON', () => {
    const error = problemToApiError(502, 'Bad Gateway', '<html>Bad gateway</html>');

    expect(error.code).toBeUndefined();
    expect(error.properties).toEqual({});
  });
});
