import type { AuthResponse } from './auth';
import { apiFetch } from './client';

/** Hand-written from spec 12.1 (backend DTO names assumed) until Task 36 switches to generated types. */
export interface TwoFactorStatusResponse {
  enabled: boolean;
  recoveryCodesLeft: number;
}

export interface TwoFactorSetupResponse {
  /** Base32 secret: secret material, never logged or shown outside the setup screen. */
  secret: string;
  otpauthUri: string;
}

export interface TwoFactorCodeRequest {
  /** 6-digit TOTP code (recovery codes are accepted where the spec says so). */
  code: string;
}

export interface TwoFactorDisableRequest {
  /** Required when the account has a password (always in M3; M5 adds Google-only accounts). */
  password?: string;
  code: string;
}

export interface RecoveryCodesResponse {
  /** Shown once; the server keeps only hashes. */
  recoveryCodes: string[];
}

export interface TwoFactorVerifyRequest {
  twoFactorToken: string;
  code: string;
}

export const twoFactorApi = {
  status: () => apiFetch<TwoFactorStatusResponse>('/api/v1/me/2fa'),
  setup: () => apiFetch<TwoFactorSetupResponse>('/api/v1/me/2fa/setup', { method: 'POST' }),
  enable: (body: TwoFactorCodeRequest) =>
    apiFetch<RecoveryCodesResponse>('/api/v1/me/2fa/enable', { method: 'POST', body }),
  disable: (body: TwoFactorDisableRequest) => apiFetch<void>('/api/v1/me/2fa/disable', { method: 'POST', body }),
  regenerateRecoveryCodes: (body: TwoFactorCodeRequest) =>
    apiFetch<RecoveryCodesResponse>('/api/v1/me/2fa/recovery-codes', { method: 'POST', body }),
  /** Public: completes a sign-in that answered 401 two-factor-required (spec 12.1). */
  verify: (body: TwoFactorVerifyRequest) =>
    apiFetch<AuthResponse>('/api/v1/auth/2fa/verify', { method: 'POST', body, auth: false }),
};
