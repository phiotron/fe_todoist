import { apiFetch, buildQuery } from './client';
import type { Page } from './models';

/** M10 (hand-written; backend DTO ActivityResponse). Enums are upper-case in JSON, lower-case in the query string. */
export type ActivityObjectType = 'TASK' | 'PROJECT' | 'SECTION';
export type ActivityEventType = 'ADDED' | 'UPDATED' | 'COMPLETED' | 'UNCOMPLETED' | 'DELETED' | 'ARCHIVED' | 'UNARCHIVED';

export const ACTIVITY_EVENT_TYPES: readonly ActivityEventType[] = [
  'ADDED',
  'UPDATED',
  'COMPLETED',
  'UNCOMPLETED',
  'DELETED',
  'ARCHIVED',
  'UNARCHIVED',
];

export interface ActivityItem {
  id: string;
  objectType: ActivityObjectType;
  objectId: string;
  eventType: ActivityEventType;
  projectId: string | null;
  /** Name of the object when the event was recorded (kept after it is deleted). */
  objectName: string;
  projectName: string | null;
  /** null = the person deleted their account. */
  initiatorId: string | null;
  createdAt: string;
}

export interface ActivityParams {
  projectId?: string;
  taskId?: string;
  objectType?: ActivityObjectType;
  eventType?: ActivityEventType;
  initiatorId?: string;
}

export const ACTIVITY_PAGE_SIZE = 50;

export const activityApi = {
  list: (params: ActivityParams, cursor?: string) =>
    apiFetch<Page<ActivityItem>>(
      `/api/v1/activity${buildQuery({
        projectId: params.projectId,
        taskId: params.taskId,
        objectType: params.objectType?.toLowerCase(),
        eventType: params.eventType?.toLowerCase(),
        initiatorId: params.initiatorId,
        cursor,
        limit: ACTIVITY_PAGE_SIZE,
      })}`,
    ),
};
