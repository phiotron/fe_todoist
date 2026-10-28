import { tokenStore } from '../lib/tokenStore';
import { apiFetch } from './client';
import type { components } from './types.gen';

type Schemas = components['schemas'];

/** springdoc may mark response fields optional; the M0 contract guarantees they are always present. */
type Strict<T> = { [K in keyof T]-?: Exclude<T[K], undefined> };

export type UserResponse = Strict<Schemas['UserResponse']>;
export type AuthResponse = Strict<Omit<Schemas['AuthResponse'], 'user'>> & { user: UserResponse };
export type LoginRequest = Schemas['LoginRequest'];
export type RegisterRequest = Schemas['RegisterRequest'];

/** Hand-written (like the M5 backend contract, spec 12.1) until `npm run gen:api` runs against the merged backend. */
export interface GoogleAuthRequest {
  idToken: string;
}

/**
 * GET me fields added in M5. Optional on purpose: AuthResponse.user and older servers may omit them,
 * and the UI must not crash on a cached user from before M5.
 */
export interface IdentityFields {
  hasPassword?: boolean;
  /** Provider names, e.g. "GOOGLE". */
  linkedProviders?: string[];
}

export type MeResponse = UserResponse & IdentityFields;

export const authApi = {
  login: (body: LoginRequest) =>
    apiFetch<AuthResponse>('/api/v1/auth/login', { method: 'POST', body, auth: false }),
  register: (body: RegisterRequest) =>
    apiFetch<AuthResponse>('/api/v1/auth/register', { method: 'POST', body, auth: false }),
  logout: () =>
    apiFetch<void>('/api/v1/auth/logout', {
      method: 'POST',
      // Read at send time: a 401 -> refresh rotates the token, and the retry must revoke the NEW one.
      getBody: async () => ({ refreshToken: await tokenStore.getRefreshToken() }),
    }),
  /** 200 tokens | 409 link-required (+ linkToken) | 401 two-factor-required (+ twoFactorToken); public, never refreshes. */
  google: (body: GoogleAuthRequest) =>
    apiFetch<AuthResponse>('/api/v1/auth/google', { method: 'POST', body, auth: false }),
  me: () => apiFetch<MeResponse>('/api/v1/me'),
};
