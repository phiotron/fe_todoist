import { apiFetch } from './client';

/** Hand-written from spec 12.1 (backend DTO names) until Task 36 switches to generated types. */
export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

/** Public endpoints: never send the stored session, never refresh on 401. */
export const passwordResetApi = {
  request: (body: ForgotPasswordRequest) =>
    apiFetch<void>('/api/v1/auth/password-reset/request', { method: 'POST', body, auth: false }),
  confirm: (body: ResetPasswordRequest) =>
    apiFetch<void>('/api/v1/auth/password-reset/confirm', { method: 'POST', body, auth: false }),
};
