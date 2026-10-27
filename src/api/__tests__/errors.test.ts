import { ApiError, problemToApiError } from '../errors';

describe('problemToApiError', () => {
  it('keeps requestId, code and the latest version (current) from a 409 ProblemDetail', () => {
    const body = JSON.stringify({
      type: 'about:blank',
      title: 'Conflict',
      status: 409,
      detail: 'Đã có thay đổi ở nơi khác',
      requestId: '7f3c9a12-0000-4000-8000-000000000000',
      code: 'version-conflict',
      current: { id: 't1', version: 3 },
    });
    const error = problemToApiError(409, 'Conflict', body);
    expect(error.requestId).toBe('7f3c9a12-0000-4000-8000-000000000000');
    expect(error.code).toBe('version-conflict');
    expect(error.current).toEqual({ id: 't1', version: 3 });
  });

  it('keeps limit and max of a 422 limit-reached', () => {
    const body = JSON.stringify({ status: 422, code: 'limit-reached', limit: 'PROJECT_SECTIONS', max: 20 });
    const error = problemToApiError(422, 'Unprocessable', body);
    expect(error).toMatchObject({ code: 'limit-reached', limit: 'PROJECT_SECTIONS', max: 20 });
  });

  it('ignores values of the wrong type', () => {
    const error = problemToApiError(500, 'Error', JSON.stringify({ requestId: 42, current: 'x', code: 7, max: '20' }));
    expect(error.requestId).toBeUndefined();
    expect(error.current).toBeUndefined();
    expect(error.code).toBeUndefined();
    expect(error.max).toBeUndefined();
  });

  it('keeps every member of the body as properties (filter-syntax position, linkToken, twoFactorToken…)', () => {
    const body = { status: 400, code: 'filter-syntax', position: 7, linkToken: 'lt-1', requestId: 'r-1' };
    const error = problemToApiError(400, 'Bad Request', JSON.stringify(body));
    expect(error.properties).toMatchObject({ status: 400, code: 'filter-syntax', position: 7, linkToken: 'lt-1' });
    expect(error.code).toBe('filter-syntax');
    expect(error.requestId).toBe('r-1');
  });

  it('has empty properties when the body is empty or not JSON', () => {
    expect(problemToApiError(502, 'Bad Gateway', '<html>proxy</html>').properties).toEqual({});
    expect(problemToApiError(500, 'Error', '').properties).toEqual({});
    expect(new ApiError({ status: 404, title: 'Not Found' }).properties).toEqual({});
  });
});
