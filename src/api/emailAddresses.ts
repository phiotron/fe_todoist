import { apiFetch } from './client';

/**
 * Email → task (M13a). Types are declared by hand (types.gen.ts is regenerated when the branches are merged); names
 * match the backend DTO EmailAddressResponse.
 */
export type EmailTargetType = 'PROJECT' | 'TASK';

/** PUT / POST …/email-address(/regenerate): the user's own address for a project (Inbox included) or a task. */
export interface EmailAddressResponse {
  address: string;
  targetType: EmailTargetType;
  targetId: string;
}

/** What the address is for. The Inbox is a project. */
export interface EmailTarget {
  kind: 'project' | 'task';
  id: string;
}

function basePath(target: EmailTarget): string {
  const collection = target.kind === 'project' ? 'projects' : 'tasks';
  return `/api/v1/${collection}/${encodeURIComponent(target.id)}/email-address`;
}

export const emailAddressesApi = {
  /** Get or create: calling again returns the same address. */
  get: (target: EmailTarget) => apiFetch<EmailAddressResponse>(basePath(target), { method: 'PUT' }),
  /** A new address; the old one stops working. */
  regenerate: (target: EmailTarget) =>
    apiFetch<EmailAddressResponse>(`${basePath(target)}/regenerate`, { method: 'POST' }),
};

/** Query key of one address (kept here, not in queryKeys.ts: only the email dialog reads it). */
export const emailAddressKey = (target: EmailTarget) => ['email-address', target.kind, target.id] as const;
