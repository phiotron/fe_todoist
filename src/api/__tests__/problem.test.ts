import { ApiError, problemToApiError } from '../errors';
import { filterSyntaxPosition, hasProblemCode, problemProperty } from '../problem';

const body = (extra: Record<string, unknown>) =>
  JSON.stringify({ type: 'about:blank', title: 'Bad Request', status: 400, requestId: 'req-1', ...extra });

describe('ProblemDetail properties (spec 12.10)', () => {
  it('reads code and extension members kept by problemToApiError', () => {
    const error = problemToApiError(400, 'Bad Request', body({ code: 'filter-syntax', position: 7 }));
    expect(problemProperty(error, 'code')).toBe('filter-syntax');
    expect(problemProperty(error, 'position')).toBe(7);
    expect(hasProblemCode(error, 'filter-syntax')).toBe(true);
    expect(hasProblemCode(error, 'label-name-taken')).toBe(false);
  });

  it('gives the syntax position only for filter-syntax with a non-negative integer', () => {
    const at = (extra: Record<string, unknown>, status = 400) =>
      filterSyntaxPosition(problemToApiError(status, '', body(extra)));
    expect(at({ code: 'filter-syntax', position: 0 })).toBe(0);
    expect(at({ code: 'filter-syntax', position: 12 })).toBe(12);
    expect(at({ code: 'filter-syntax' })).toBeNull();
    expect(at({ code: 'filter-syntax', position: -1 })).toBeNull();
    expect(at({ code: 'filter-syntax', position: 2.5 })).toBeNull();
    expect(at({ code: 'filter-syntax', position: '3' })).toBeNull();
    expect(at({ code: 'label-name-taken', position: 3 }, 409)).toBeNull();
  });

  it('ignores anything that is not an ApiError', () => {
    expect(problemProperty(new Error('x'), 'code')).toBeUndefined();
    expect(problemProperty(undefined, 'code')).toBeUndefined();
    expect(hasProblemCode(null, 'filter-syntax')).toBe(false);
    expect(filterSyntaxPosition(new Error('x'))).toBeNull();
  });

  it('works with an ApiError built by hand (typed fields or properties)', () => {
    expect(problemProperty(new ApiError({ status: 404, title: 'Not Found' }), 'code')).toBeUndefined();
    expect(hasProblemCode(new ApiError({ status: 409, title: 'x', code: 'label-name-taken' }), 'label-name-taken')).toBe(true);
    expect(
      filterSyntaxPosition(
        new ApiError({ status: 400, title: 'x', code: 'filter-syntax', properties: { code: 'filter-syntax', position: 3 } }),
      ),
    ).toBe(3);
    expect(filterSyntaxPosition(new ApiError({ status: 400, title: 'x', code: 'filter-syntax' }))).toBeNull();
  });
});
