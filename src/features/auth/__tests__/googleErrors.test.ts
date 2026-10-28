import { ApiError, NetworkError, OfflineError, TimeoutError } from '../../../api/errors';
import i18n, { viTranslation as vi } from '../../../i18n';
import {
  describeGoogleAuthError,
  describeGoogleLinkError,
  describeGoogleSignInFailure,
  describeGoogleUnlinkError,
  isPasswordRequired,
  linkTokenOf,
} from '../googleErrors';

/** Builds the ApiError that problemToApiError would build for this ProblemDetail body: `code` field + whole body as `properties`. */
const api = (status: number, properties: Record<string, unknown> = {}) =>
  new ApiError({
    status,
    title: 'x',
    code: typeof properties.code === 'string' ? properties.code : undefined,
    properties,
  });

describe('linkTokenOf', () => {
  it('returns the linkToken of a 409 link-required', () => {
    expect(linkTokenOf(api(409, { code: 'link-required', linkToken: 'lt-1' }))).toBe('lt-1');
  });

  it.each([
    ['a 409 carrying a linkToken but no code', api(409, { linkToken: 'lt-1' })],
    ['a 409 link-required without linkToken', api(409, { code: 'link-required' })],
    ['an empty linkToken', api(409, { code: 'link-required', linkToken: '' })],
    ['a non-string linkToken', api(409, { code: 'link-required', linkToken: 42 })],
    ['another status with the same code', api(400, { code: 'link-required', linkToken: 'lt-1' })],
    ['a network error', new NetworkError()],
    ['a plain Error', new Error('boom')],
  ])('returns null for %s', (_label, error) => {
    expect(linkTokenOf(error)).toBeNull();
  });
});

describe('isPasswordRequired', () => {
  it('is true for 409 password-required', () => {
    expect(isPasswordRequired(api(409, { code: 'password-required' }))).toBe(true);
  });

  it.each([
    ['a 409 without code', api(409)],
    ['a 400 with the same code', api(400, { code: 'password-required' })],
    ['a network error', new NetworkError()],
  ])('is false for %s', (_label, error) => {
    expect(isPasswordRequired(error)).toBe(false);
  });
});

describe('describeGoogleSignInFailure', () => {
  it.each([
    ['notConfigured', vi.google.errors.notConfigured],
    ['playServices', vi.google.errors.playServices],
    ['inProgress', vi.google.errors.inProgress],
    ['failed', vi.google.errors.failed],
  ] as const)('maps %s', (reason, message) => {
    expect(describeGoogleSignInFailure(reason)).toBe(message);
  });
});

describe('describeGoogleAuthError (POST auth/google)', () => {
  it('reports server unreachable / offline for a plain network error', () => {
    expect(describeGoogleAuthError(new NetworkError(), true)).toBe(vi.errors.network);
    expect(describeGoogleAuthError(new NetworkError(), false)).toBe(vi.errors.offline);
  });

  it('leaves timeouts and offline writes to the shared describeError, not the "server unreachable" pair', () => {
    expect(describeGoogleAuthError(new TimeoutError(), true)).toBe(vi.errors.timeout);
    expect(describeGoogleAuthError(new OfflineError(), true)).toBe(vi.errors.offline);
  });

  it('maps 401 (bad or expired ID token) to "Google sign-in failed"', () => {
    expect(describeGoogleAuthError(api(401), true)).toBe(vi.google.errors.failed);
  });

  it('maps 403 to "Google email not verified"', () => {
    expect(describeGoogleAuthError(api(403), true)).toBe(vi.google.errors.emailNotVerified);
  });

  it('maps 429 (10 per minute per IP) to the shared "too many requests" sentence', () => {
    expect(describeGoogleAuthError(api(429), true)).toBe(vi.errors.tooManyRequests);
  });

  it('falls back to the generic message for anything else', () => {
    expect(describeGoogleAuthError(api(500), true)).toBe(vi.errors.unknown);
    expect(describeGoogleAuthError(new Error('boom'), true)).toBe(vi.errors.unknown);
  });

  it('shows the short requestId of a 5xx through the shared describeError', () => {
    const error = new ApiError({ status: 503, title: 'x', requestId: '7f3c9a12-aaaa-4bbb-8ccc-dddddddddddd' });
    expect(describeGoogleAuthError(error, true)).toBe(i18n.t('errors.server', { code: '7f3c9a12' }));
  });
});

describe('describeGoogleLinkError (POST me/identities/google)', () => {
  it('reports network problems', () => {
    expect(describeGoogleLinkError(new NetworkError(), false)).toBe(vi.errors.offline);
  });

  it('leaves timeouts and offline writes to the shared describeError', () => {
    expect(describeGoogleLinkError(new TimeoutError(), true)).toBe(vi.errors.timeout);
    expect(describeGoogleLinkError(new OfflineError(), true)).toBe(vi.errors.offline);
  });

  it('maps 409 (Google linked to another Taskly account, or this account has another Google) to linkConflict', () => {
    expect(describeGoogleLinkError(api(409), true)).toBe(vi.google.errors.linkConflict);
  });

  it('maps 403 to "Google email not verified"', () => {
    expect(describeGoogleLinkError(api(403), true)).toBe(vi.google.errors.emailNotVerified);
  });

  it('maps 400 (bad or expired ID token / linkToken, or email mismatch) to linkRejected', () => {
    expect(describeGoogleLinkError(api(400), true)).toBe(vi.google.errors.linkRejected);
  });

  it('maps 401 to session expired', () => {
    expect(describeGoogleLinkError(api(401), true)).toBe(vi.auth.errors.sessionExpired);
  });

  it('falls back to the generic message', () => {
    expect(describeGoogleLinkError(api(500), true)).toBe(vi.errors.unknown);
  });
});

describe('describeGoogleUnlinkError (DELETE me/identities/google)', () => {
  it('maps 409 password-required to "set a password first"', () => {
    expect(describeGoogleUnlinkError(api(409, { code: 'password-required' }), true)).toBe(vi.google.settings.needPassword);
  });

  it('does not guess "set a password" for a 409 without that code (the shared 409 sentence of M1 instead)', () => {
    expect(describeGoogleUnlinkError(api(409), true)).toBe(vi.errors.conflict);
  });

  it('maps 401 to session expired and a plain network error to the network message', () => {
    expect(describeGoogleUnlinkError(api(401), true)).toBe(vi.auth.errors.sessionExpired);
    expect(describeGoogleUnlinkError(new NetworkError(), true)).toBe(vi.errors.network);
  });

  it('leaves timeouts and offline writes to the shared describeError', () => {
    expect(describeGoogleUnlinkError(new TimeoutError(), true)).toBe(vi.errors.timeout);
    expect(describeGoogleUnlinkError(new OfflineError(), true)).toBe(vi.errors.offline);
  });

  it('falls back to the generic message', () => {
    expect(describeGoogleUnlinkError(api(500), true)).toBe(vi.errors.unknown);
  });
});
