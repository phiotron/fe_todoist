import { apiFetch, buildQuery } from './client';

/** Hand-written from the M13c plan F2 (backend DTO OAuthAuthorizePreviewResponse). */
export interface OAuthAuthorizePreviewResponse {
  clientId: string;
  appName: string;
  redirectUri: string;
  scopes: string[];
}

export interface OAuthAuthorizePreviewParams {
  clientId: string;
  redirectUri: string;
  /** Scopes as received, separated by commas or spaces. */
  scope: string;
}

/** Backend DTO OAuthAuthorizeRequest (the user pressed "Allow"). */
export interface OAuthAuthorizeRequest {
  clientId: string;
  redirectUri: string;
  scope: string;
  state?: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
}

/** Backend DTO OAuthAuthorizeResponse: `redirectUri?code=…&state=…`, to open on the device. */
export interface OAuthAuthorizeResponse {
  redirectUrl: string;
}

export const oauthApi = {
  /** Name of the app and the scopes it asks for; 400 when the client / redirect URI / scope is not valid. */
  preview: ({ clientId, redirectUri, scope }: OAuthAuthorizePreviewParams) =>
    apiFetch<OAuthAuthorizePreviewResponse>(`/api/v1/oauth/authorize/preview${buildQuery({ clientId, redirectUri, scope })}`),
  authorize: (body: OAuthAuthorizeRequest) =>
    apiFetch<OAuthAuthorizeResponse>('/api/v1/oauth/authorize', { method: 'POST', body }),
};
