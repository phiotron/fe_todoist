import { apiFetch, buildQuery } from './client';
import type { CommentSearchItem } from './comments';
import type { Filter } from './filters';
import type { Label } from './labels';
import type { Page, Project, Task } from './models';

/** A section hit carries its project's name (spec 12.6). */
export interface SectionSearchItem {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
}

/** GET search/objects: at most 20 of each kind, not paged. */
export interface SearchObjects {
  projects: Project[];
  sections: SectionSearchItem[];
  labels: Label[];
  filters: Filter[];
  /** M8b: matching comments, newest first (absent from servers older than M8b). */
  comments?: CommentSearchItem[];
}

/** Open tasks by default; completed=true only for "search completed tasks". */
export function searchTasksPath(q: string, completed: boolean, cursor: string | null): string {
  return `/api/v1/search${buildQuery({ q, completed: completed ? true : undefined, cursor })}`;
}

export function searchObjectsPath(q: string): string {
  return `/api/v1/search/objects${buildQuery({ q })}`;
}

export const searchApi = {
  tasks: (q: string, completed: boolean, cursor: string | null) =>
    apiFetch<Page<Task>>(searchTasksPath(q, completed, cursor)),
  objects: (q: string) => apiFetch<SearchObjects>(searchObjectsPath(q)),
};
