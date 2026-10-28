import { buildDenyUrl, parseAuthorizeParams, scopeLabelKey } from '../authorizeParams';

const VALID = {
  client_id: 'cli_123',
  redirect_uri: 'https://example.test/callback',
  scope: 'data:read,task:add',
  state: 'xyz',
  code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  code_challenge_method: 'S256',
};

describe('parseAuthorizeParams', () => {
  it('maps the snake_case deep link parameters to the authorize request', () => {
    expect(parseAuthorizeParams(VALID)).toEqual({
      ok: true,
      request: {
        clientId: 'cli_123',
        redirectUri: 'https://example.test/callback',
        scope: 'data:read,task:add',
        state: 'xyz',
        codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
        codeChallengeMethod: 'S256',
      },
    });
  });

  it('state is optional', () => {
    const { state: _state, ...rest } = VALID;
    const parsed = parseAuthorizeParams({ ...rest, state: '' });
    expect(parsed.ok && parsed.request.state).toBeUndefined();
  });

  it('takes the first value when a parameter is repeated', () => {
    const parsed = parseAuthorizeParams({ ...VALID, client_id: ['first', 'second'] });
    expect(parsed.ok && parsed.request.clientId).toBe('first');
  });

  it.each(['client_id', 'redirect_uri', 'scope', 'code_challenge', 'code_challenge_method'])(
    'refuses a link without %s',
    (name) => {
      const params: Record<string, string | undefined> = { ...VALID, [name]: undefined };
      expect(parseAuthorizeParams(params)).toEqual({ ok: false, missing: [name] });
    },
  );

  it('a blank value counts as missing, and every missing name is reported', () => {
    expect(parseAuthorizeParams({ redirect_uri: '  ', scope: 'data:read' })).toEqual({
      ok: false,
      missing: ['client_id', 'redirect_uri', 'code_challenge', 'code_challenge_method'],
    });
  });

  it('only S256 is accepted as the challenge method', () => {
    expect(parseAuthorizeParams({ ...VALID, code_challenge_method: 'plain' })).toEqual({
      ok: false,
      missing: ['code_challenge_method'],
    });
  });
});

describe('buildDenyUrl', () => {
  it('adds error=access_denied and the encoded state with "?" when the URI has no query', () => {
    expect(buildDenyUrl('https://example.test/cb', 'a b&c')).toBe(
      'https://example.test/cb?error=access_denied&state=a%20b%26c',
    );
  });

  it('uses "&" when the URI already has a query', () => {
    expect(buildDenyUrl('myapp://cb?x=1', 'st')).toBe('myapp://cb?x=1&error=access_denied&state=st');
  });

  it('adds no separator after a trailing "?" or "&"', () => {
    expect(buildDenyUrl('https://example.test/cb?', undefined)).toBe('https://example.test/cb?error=access_denied');
    expect(buildDenyUrl('https://example.test/cb?x=1&', undefined)).toBe('https://example.test/cb?x=1&error=access_denied');
  });

  it('leaves state out when there is none', () => {
    expect(buildDenyUrl('https://example.test/cb', '')).toBe('https://example.test/cb?error=access_denied');
  });
});

describe('scopeLabelKey', () => {
  it.each([
    ['task:add', 'oauth.scopes.taskAdd'],
    ['data:read', 'oauth.scopes.dataRead'],
    ['data:read_write', 'oauth.scopes.dataReadWrite'],
    ['data:delete', 'oauth.scopes.dataDelete'],
    ['project:delete', 'oauth.scopes.projectDelete'],
  ])('%s → %s', (scope, key) => {
    expect(scopeLabelKey(scope)).toBe(key);
  });

  it('null for a scope it does not know', () => {
    expect(scopeLabelKey('backups:read')).toBeNull();
  });
});
