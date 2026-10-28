import { apiFetch } from './client';

/** Hand-written from the M13c plan F6 (backend DTO RegisterPushTokenRequest). */
export interface RegisterPushTokenRequest {
  /** FCM registration token of this device (1–4096 characters). */
  token: string;
  platform: 'ANDROID';
}

export interface UnregisterPushTokenRequest {
  token: string;
}

/** 202 answer of the test push: how many devices of the user it was queued for. */
export interface PushTestResponse {
  devices: number;
}

export const PUSH_TOKENS_PATH = '/api/v1/me/push-tokens';

export const pushTokensApi = {
  /** 204; a token held by another user moves to this one. */
  register: (body: RegisterPushTokenRequest) => apiFetch<void>(PUSH_TOKENS_PATH, { method: 'POST', body }),
  unregister: (body: UnregisterPushTokenRequest) =>
    apiFetch<void>(`${PUSH_TOKENS_PATH}/unregister`, { method: 'POST', body }),
  test: () => apiFetch<PushTestResponse>(`${PUSH_TOKENS_PATH}/test`, { method: 'POST' }),
};
