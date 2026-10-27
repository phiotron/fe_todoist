import { ApiError, NetworkError } from '../../../api/errors';
import {
  CHALLENGE_TTL_MS,
  TWO_FACTOR_CODE_INVALID,
  TWO_FACTOR_TOKEN_INVALID,
  isChallengeExpired,
  isChallengeSpent,
  isCodeRejected,
  twoFactorTokenOf,
} from '../twoFactorToken';

function required(token: unknown): ApiError {
  return new ApiError({
    status: 401,
    title: 'Unauthorized',
    code: 'two-factor-required',
    properties: { code: 'two-factor-required', twoFactorToken: token },
  });
}

describe('twoFactorTokenOf', () => {
  it('reads the token of a 401 two-factor-required answer only (status AND code)', () => {
    expect(twoFactorTokenOf(required('challenge-1'))).toBe('challenge-1');
    expect(twoFactorTokenOf(required(''))).toBeNull();
    expect(twoFactorTokenOf(required(5))).toBeNull();
    expect(twoFactorTokenOf(new ApiError({ status: 401, title: 'Unauthorized' }))).toBeNull();
    // a 401 that carries a token member but no code is a plain failure, not the two-factor challenge
    expect(twoFactorTokenOf(new ApiError({ status: 401, title: 'x', properties: { twoFactorToken: 'challenge-1' } }))).toBeNull();
    expect(twoFactorTokenOf(new ApiError({ status: 409, title: 'x', code: 'two-factor-required' }))).toBeNull();
    expect(twoFactorTokenOf(new Error('x'))).toBeNull();
  });
});

describe('isChallengeSpent / isCodeRejected', () => {
  const verifyError = (status: number, code?: string) => new ApiError({ status, title: 'x', ...(code ? { code } : {}) });

  it('only 401 two-factor-token-invalid settles the token; a wrong code, 400, 429, 5xx, a plain 401 and a lost connection do not', () => {
    expect(TWO_FACTOR_TOKEN_INVALID).toBe('two-factor-token-invalid');
    expect(isChallengeSpent(verifyError(401, TWO_FACTOR_TOKEN_INVALID))).toBe(true);
    expect(isChallengeSpent(verifyError(401, TWO_FACTOR_CODE_INVALID))).toBe(false);
    expect(isChallengeSpent(verifyError(401))).toBe(false);
    expect(isChallengeSpent(verifyError(400))).toBe(false);
    expect(isChallengeSpent(verifyError(429))).toBe(false);
    expect(isChallengeSpent(verifyError(503))).toBe(false);
    expect(isChallengeSpent(new NetworkError())).toBe(false);
    expect(isChallengeSpent(new Error('x'))).toBe(false);
  });

  it('a wrong code is 401 two-factor-code-invalid and nothing else', () => {
    expect(TWO_FACTOR_CODE_INVALID).toBe('two-factor-code-invalid');
    expect(isCodeRejected(verifyError(401, TWO_FACTOR_CODE_INVALID))).toBe(true);
    expect(isCodeRejected(verifyError(401, TWO_FACTOR_TOKEN_INVALID))).toBe(false);
    expect(isCodeRejected(verifyError(401))).toBe(false);
    expect(isCodeRejected(verifyError(400, TWO_FACTOR_CODE_INVALID))).toBe(false);
    expect(isCodeRejected(new Error('x'))).toBe(false);
  });
});

describe('isChallengeExpired', () => {
  it('the server token lives 5 minutes', () => {
    expect(CHALLENGE_TTL_MS).toBe(5 * 60 * 1000);
    expect(isChallengeExpired(1_000, 1_000 + CHALLENGE_TTL_MS - 1)).toBe(false);
    expect(isChallengeExpired(1_000, 1_000 + CHALLENGE_TTL_MS)).toBe(true);
  });
});
