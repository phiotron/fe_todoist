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
  me: () => apiFetch<UserResponse>('/api/v1/me'),
};
