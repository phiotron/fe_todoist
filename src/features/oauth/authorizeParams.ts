import type { OAuthAuthorizeRequest } from '../../api/oauth';

/** Raw route params as expo-router gives them (a repeated query parameter becomes an array). */
export type RawParams = Record<string, string | string[] | undefined>;

export type ParsedAuthorize = { ok: true; request: OAuthAuthorizeRequest } | { ok: false; missing: string[] };

/** Deep link parameters (snake_case, as in the OAuth spec) that must be present and not blank. */
const REQUIRED = ['client_id', 'redirect_uri', 'scope', 'code_challenge', 'code_challenge_method'] as const;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Reads `taskly://oauth/authorize?client_id=…&redirect_uri=…&scope=…&state=…&code_challenge=…&code_challenge_method=S256`.
 * Values are kept as received (the server compares redirect_uri exactly). Only the S256 method exists (M13c plan F2):
 * any other method is reported like a missing one. The server checks everything else (client, redirect, scopes).
 */
export function parseAuthorizeParams(raw: RawParams): ParsedAuthorize {
  const value = (name: string) => first(raw[name]);
  const missing: string[] = REQUIRED.filter((name) => !value(name)?.trim());
  if (!missing.includes('code_challenge_method') && value('code_challenge_method') !== 'S256') {
    missing.push('code_challenge_method');
  }
  if (missing.length > 0) return { ok: false, missing };
  const state = value('state');
  return {
    ok: true,
    request: {
      clientId: value('client_id') as string,
      redirectUri: value('redirect_uri') as string,
      scope: value('scope') as string,
      state: state ? state : undefined,
      codeChallenge: value('code_challenge') as string,
      codeChallengeMethod: 'S256',
    },
  };
}

/** `redirectUri` + `error=access_denied` (+ `state`), RFC 6749 §4.1.2.1: what "Deny" opens. */
export function buildDenyUrl(redirectUri: string, state: string | undefined): string {
  const separator = redirectUri.endsWith('?') || redirectUri.endsWith('&') ? '' : redirectUri.includes('?') ? '&' : '?';
  const stateParam = state ? `&state=${encodeURIComponent(state)}` : '';
  return `${redirectUri}${separator}error=access_denied${stateParam}`;
}

const SCOPE_KEYS: Record<string, string> = {
  'task:add': 'oauth.scopes.taskAdd',
  'data:read': 'oauth.scopes.dataRead',
  'data:read_write': 'oauth.scopes.dataReadWrite',
  'data:delete': 'oauth.scopes.dataDelete',
  'project:delete': 'oauth.scopes.projectDelete',
};

/** i18n key of a human-readable scope label; null for a scope the app does not know (shown as is). */
export function scopeLabelKey(scope: string): string | null {
  return SCOPE_KEYS[scope] ?? null;
}
