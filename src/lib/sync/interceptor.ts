import type { QueryClient } from '@tanstack/react-query';
import type { ApiRequestOptions, HttpMethod } from '../../api/client';
import { OfflineError } from '../../api/errors';
import { mapRequest } from './commandMap';
import { applyOptimistic } from './optimistic';
import type { CommandQueue } from './queue';

/** POSTs that only READ (the form validates a filter query): never queued, never "offline-blocked" by us. */
const READ_ONLY_POSTS: ReadonlySet<string> = new Set(['/api/v1/filters/validate']);

export interface WriteInterceptorDeps {
  queue: CommandQueue;
  queryClient: QueryClient;
  /** The real network state (NetInfo), not `useIsOnline()`. */
  isConnected(): boolean;
  /** A fresh UUID (the `id` of a record created offline, spec 12.11). */
  newId(): string;
  now(): Date;
  /** Ask the engine to send. Called after a command was queued while connected. */
  trigger(): void;
}

/** Same shape as the interceptor hook of api/client.ts: a handled request answers with `value`, null = send it as usual. */
export type WriteInterceptor = (path: string, options: ApiRequestOptions) => { value: unknown } | null;

/**
 * THE single hook of M9 on the write path (plan F5), installed into api/client.ts so no screen / hook changes:
 *  - GET, public (login...) and `getBody` requests: untouched;
 *  - a write that maps to a sync command (commandMap.ts) while OFFLINE, or while earlier commands are still queued
 *    (never overtake them): queued + optimistic cache patch + a built answer, sent later by the engine;
 *  - connected with an empty queue: untouched (the plain REST call of M1–M5, same errors, same Idempotency-Key);
 *  - any other write while offline: OfflineError exactly like before.
 */
export function createWriteInterceptor(deps: WriteInterceptorDeps): WriteInterceptor {
  return (path, options) => {
    const method: HttpMethod = options.method ?? 'GET';
    if (method === 'GET' || options.auth === false || options.getBody) return null;
    const mapped = mapRequest(method, path, options.body, deps.newId);
    const connected = deps.isConnected();
    if (!mapped) {
      if (!connected && !READ_ONLY_POSTS.has(path.split('?')[0])) throw new OfflineError();
      return null;
    }
    if (connected && deps.queue.size() === 0) return null;
    deps.queue.enqueue(mapped);
    const value = applyOptimistic(deps.queryClient, mapped, deps.now().toISOString());
    if (connected) deps.trigger();
    return { value };
  };
}
