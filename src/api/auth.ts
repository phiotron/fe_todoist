import type { AuthResponse, LoginRequest, RegisterRequest, UserResponse } from './auth-types';
import { apiFetch } from './client';

export type { AuthResponse, LoginRequest, RegisterRequest, UserResponse } from './auth-types';

export const authApi = {
  login: (body: LoginRequest) =>
    apiFetch<AuthResponse>('/api/v1/auth/login', { method: 'POST', body, auth: false }),
  register: (body: RegisterRequest) =>
    apiFetch<AuthResponse>('/api/v1/auth/register', { method: 'POST', body, auth: false }),
  logout: (refreshToken: string) =>
    apiFetch<void>('/api/v1/auth/logout', { method: 'POST', body: { refreshToken } }),
  me: () => apiFetch<UserResponse>('/api/v1/me'),
};
