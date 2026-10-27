import type { UserResponse } from './auth';
import { apiFetch } from './client';

/** Hand-written from spec 12.1 (backend DTO names) until Task 36 switches to generated types. */
export interface UpdateProfileRequest {
  displayName: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/** The server revokes every refresh token and answers with a new pair (spec 12.1). */
export interface TokenPairResponse {
  accessToken: string;
  refreshToken: string;
}

export interface DeleteAccountRequest {
  password: string;
  /** Required when two-factor authentication is on: a 6-digit code or a recovery code. */
  code?: string;
}

export const accountApi = {
  updateProfile: (body: UpdateProfileRequest) => apiFetch<UserResponse>('/api/v1/me', { method: 'PATCH', body }),
  changePassword: (body: ChangePasswordRequest) =>
    apiFetch<TokenPairResponse>('/api/v1/me/password', { method: 'POST', body }),
  /** Revokes every refresh token of the user, this device included (spec 12.1). */
  logoutAll: () => apiFetch<void>('/api/v1/me/logout-all', { method: 'POST' }),
  /** Permanently deletes the account and all its data (spec 5.9). */
  deleteAccount: (body: DeleteAccountRequest) => apiFetch<void>('/api/v1/me', { method: 'DELETE', body }),
};
