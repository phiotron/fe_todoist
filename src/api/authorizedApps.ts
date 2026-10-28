import { apiFetch } from './client';

/** Hand-written from the M13c plan F4 (backend DTO AuthorizedAppResponse). One entry per third-party app. */
export interface AuthorizedAppResponse {
  clientId: string;
  name: string;
  /** Union of the scopes of the app's live tokens: task:add, data:read, data:read_write, data:delete, project:delete. */
  scopes: string[];
  /** ISO instant of the most recent consent. */
  authorizedAt: string;
  lastUsedAt: string | null;
}

export const AUTHORIZED_APPS_PATH = '/api/v1/me/authorized-apps';

export const authorizedAppsApi = {
  /** Newest consent first. */
  list: () => apiFetch<AuthorizedAppResponse[]>(AUTHORIZED_APPS_PATH),
  /** Revokes every token of the user for that app (204); 404 when there is none. */
  revoke: (clientId: string) =>
    apiFetch<void>(`${AUTHORIZED_APPS_PATH}/${encodeURIComponent(clientId)}`, { method: 'DELETE' }),
};
