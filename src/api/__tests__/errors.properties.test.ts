import { problemToApiError } from '../errors';

describe('ApiError.properties', () => {
  it('keeps every member of the ProblemDetail: the code and the two-factor challenge', () => {
    const body = {
      type: 'about:blank',
      title: 'Unauthorized',
      status: 401,
      detail: 'Two-factor code required',
      code: 'two-factor-required',
      twoFactorToken: 'challenge-1',
    };
    const error = problemToApiError(401, 'Unauthorized', JSON.stringify(body));
    expect(error.code).toBe('two-factor-required');
    expect(error.properties).toEqual(body);
    expect(error.properties.twoFactorToken).toBe('challenge-1');
  });

  it('is empty for a non-JSON body or a JSON value that is not an object', () => {
    expect(problemToApiError(502, 'Bad Gateway', '<html>').properties).toEqual({});
    expect(problemToApiError(502, 'Bad Gateway', '[1, 2]').properties).toEqual({});
    expect(problemToApiError(502, 'Bad Gateway', '"text"').properties).toEqual({});
  });
});
