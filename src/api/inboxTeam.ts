import { apiFetch, buildQuery } from './client';
import type { Page, Task } from './models';

/**
 * GET tasks?view=inbox_team (backend TaskViewType.inbox_team): root tasks without a date, not completed, of the GROUP
 * projects the caller joined (team workspace projects + personal projects with collaborators), ordered team first →
 * workspace → project order → manual order. No Display parameters. Not a Todoist view: user request (Inbox shows the
 * team work below the personal Inbox). Hand-written until `npm run gen:api` adds the enum value.
 */
export const INBOX_TEAM_PAGE_SIZE = 100;

/** Under the 'tasks' root: every task write (invalidateData) and every sync refresh it like the other lists. */
export const inboxTeamQueryKey = ['tasks', 'inboxTeam'] as const;

export const inboxTeamApi = {
  list: (cursor: string | null) =>
    apiFetch<Page<Task>>(`/api/v1/tasks${buildQuery({ view: 'inbox_team', limit: INBOX_TEAM_PAGE_SIZE, cursor })}`),
};
