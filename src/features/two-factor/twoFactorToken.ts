import { ApiError } from '../../api/errors';

export const TWO_FACTOR_REQUIRED = 'two-factor-required';
/** auth/2fa/verify 401: the code is wrong, the token is still alive (backend M3 Task 12j `ProblemCodes`). */
export const TWO_FACTOR_CODE_INVALID = 'two-factor-code-invalid';
/** auth/2fa/verify 401: the token is expired, not valid, already used or has the wrong typ / aud. */
export const TWO_FACTOR_TOKEN_INVALID = 'two-factor-token-invalid';
/** The server's twoFactorToken lives 5 minutes (spec 12.1). */
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/**
 * The twoFactorToken of a 401 two-factor-required answer (password or Google sign-in), or null for any other error.
 * Needs the `code` as well as the status: a plain 401 is a wrong password, not a challenge.
 */
export function twoFactorTokenOf(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.status !== 401 || error.code !== TWO_FACTOR_REQUIRED) return null;
  const token = error.properties.twoFactorToken;
  return typeof token === 'string' && token.length > 0 ? token : null;
}

/**
 * An answer from auth/2fa/verify that settles the token: 401 two-factor-token-invalid (expired, not valid, already used,
 * wrong typ / aud). Nothing else does — a wrong code (401 two-factor-code-invalid), a 400 validation error, 429, 5xx, a
 * lost connection and even a 401 without a code leave the token alive, so the challenge stays for another send.
 */
export function isChallengeSpent(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401 && error.code === TWO_FACTOR_TOKEN_INVALID;
}

/** 401 two-factor-code-invalid: the code was wrong, the token is still alive — the user can type the code again. */
export function isCodeRejected(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401 && error.code === TWO_FACTOR_CODE_INVALID;
}

export function isChallengeExpired(startedAt: number, now: number): boolean {
  return now - startedAt >= CHALLENGE_TTL_MS;
}

/** verifyTwoFactor was called with no sign-in waiting for a code. */
export class TwoFactorMissingError extends Error {
  constructor() {
    super('No two-factor challenge pending');
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = 'TwoFactorMissingError';
  }
}

/** The 5-minute challenge ran out: the user has to sign in again. */
export class TwoFactorExpiredError extends Error {
  constructor() {
    super('Two-factor challenge expired');
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = 'TwoFactorExpiredError';
  }
}
