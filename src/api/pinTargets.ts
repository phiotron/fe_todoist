import { apiFetch } from './client';

/** What the tab bar, the start page and the pickers need from a project / label / filter: its id and its name. */
export interface PinOption {
  id: string;
  name: string;
}

interface ProjectLike extends PinOption {
  isInbox?: boolean;
  archivedAt?: string | null;
}

function pick({ id, name }: PinOption): PinOption {
  return { id, name };
}

export const pinTargetsApi = {
  /** Active projects except Inbox (Inbox is a fixed tab of its own); archived ones are read-only and cannot be pinned. */
  projects: async (): Promise<PinOption[]> => {
    const list = await apiFetch<ProjectLike[]>('/api/v1/projects');
    return list.filter((project) => !project.isInbox && !project.archivedAt).map(pick);
  },
  labels: async (): Promise<PinOption[]> => (await apiFetch<PinOption[]>('/api/v1/labels')).map(pick),
  filters: async (): Promise<PinOption[]> => (await apiFetch<PinOption[]>('/api/v1/filters')).map(pick),
};
