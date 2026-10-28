import { apiFetch } from './client';

/** M11 daily server backup (view only — no restore / download on mobile, ADR 0006). Same names as the backend DTO. */
export interface BackupResponse {
  id: string;
  createdAt: string;
  projectCount: number;
  taskCount: number;
  sizeBytes: number;
}

export const backupsApi = {
  /** Newest first, at most 21. */
  list: () => apiFetch<BackupResponse[]>('/api/v1/backups'),
};

export const backupKeys = {
  list: () => ['backups', 'list'] as const,
};
