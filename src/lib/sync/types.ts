/**
 * M9 offline queue + sync (plan docs/superpowers/plans/2026-10-27-m9-chuc-nang.md). The names mirror the backend DTOs of
 * POST /api/v1/sync (SyncRequest / SyncResponse / SyncCommandResult) — declared by hand, types.gen.ts is regenerated
 * by the integration step.
 */

/** Command type = snake_case name of a backend SyncCommandHandler (task_add, project_update, ...). */
export type SyncCommandType = string;

/** One command as the server receives it. */
export interface SyncCommand {
  /** Idempotency of the command: a command that already ran is never run twice. */
  uuid: string;
  type: SyncCommandType;
  /** Client-made id of the record a create command makes (the same value as args.id). */
  tempId?: string;
  args: Record<string, unknown>;
}

/** A command waiting on disk. */
export interface QueuedCommand extends SyncCommand {
  enqueuedAt: number;
  /** Failed sends that left the command in the queue (network / 5xx / lock contention). */
  attempts: number;
}

export interface SyncRequest {
  syncToken: string | null;
  commands: SyncCommand[];
  /** Absent = every type; [] = only a fresh token. */
  resourceTypes?: string[];
}

export interface SyncProblem {
  status: number;
  title?: string;
  detail?: string;
  code?: string;
  [member: string]: unknown;
}

export interface SyncCommandResult {
  uuid: string;
  status: 'ok' | 'error';
  error: SyncProblem | null;
}

export interface SyncDeletedItem {
  type: string;
  id: string;
}

export interface SyncResponse {
  syncToken: string;
  fullSync: boolean;
  changes: Record<string, unknown[]>;
  deleted: SyncDeletedItem[];
  results: SyncCommandResult[];
  tempIdMapping: Record<string, string>;
}

/** Most commands the server takes per request (error.sync-commands-size). */
export const MAX_COMMANDS_PER_REQUEST = 100;

/** A command that failed this many sends for a temporary reason is dropped (a poison command must not block the queue). */
export const MAX_ATTEMPTS = 5;

/** What the UI shows. */
export interface SyncStatus {
  /** Commands not yet accepted by the server. */
  pending: number;
  /** A request is on the wire. */
  syncing: boolean;
  /** Commands the server refused for good since the app started (they were dropped). */
  rejected: number;
}
