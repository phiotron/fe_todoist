import type { MappedCommand } from './commandMap';
import type { QueuedCommand } from './types';

/** The subset of AsyncStorage the queue needs (tests pass an in-memory one). */
export interface QueueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const QUEUE_STORAGE_KEY = 'taskly.syncQueue';
export const SYNC_TOKEN_STORAGE_KEY = 'taskly.syncToken';

export interface CommandQueue {
  /** Read the disk once; commands enqueued before load() finishes are kept after the stored ones. */
  load(): Promise<void>;
  /** Appends one command (uuid + time stamped here) and persists. */
  enqueue(command: MappedCommand): QueuedCommand;
  /** The oldest `limit` commands, in order. */
  peek(limit: number): QueuedCommand[];
  /** Removes commands by uuid (accepted or refused for good). */
  remove(uuids: ReadonlySet<string>): void;
  /** Counts one more failed send for these commands; those past `maxAttempts` are dropped. Returns the dropped ones. */
  recordFailure(uuids: ReadonlySet<string>, maxAttempts: number): QueuedCommand[];
  /** Empties the queue and the disk (sign-out, session end). */
  clear(): Promise<void>;
  size(): number;
  all(): QueuedCommand[];
  subscribe(listener: () => void): () => void;
}

export function createCommandQueue(
  storage: QueueStorage,
  newUuid: () => string,
  now: () => number = Date.now,
  key: string = QUEUE_STORAGE_KEY,
): CommandQueue {
  let commands: QueuedCommand[] = [];
  const listeners = new Set<() => void>();
  // Writes are chained so an older (longer) snapshot never lands after a newer one.
  let writing: Promise<void> = Promise.resolve();
  let loaded = false;

  function notify() {
    [...listeners].forEach((listener) => {
      try {
        listener();
      } catch {
        // One bad subscriber must not stop the others.
      }
    });
  }

  function persist() {
    const snapshot = JSON.stringify(commands);
    writing = writing
      .then(() => (commands.length === 0 ? storage.removeItem(key) : storage.setItem(key, snapshot)))
      .catch(() => {
        // Disk failure: the commands stay in memory and the next change tries again.
      });
  }

  return {
    async load() {
      if (loaded) return;
      loaded = true;
      let stored: QueuedCommand[] = [];
      try {
        const raw = await storage.getItem(key);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) stored = parsed.filter(isQueuedCommand);
      } catch {
        // Unreadable file: start empty rather than block every write.
      }
      const known = new Set(stored.map((c) => c.uuid));
      commands = [...stored, ...commands.filter((c) => !known.has(c.uuid))];
      notify();
    },
    enqueue(mapped) {
      const command: QueuedCommand = {
        uuid: newUuid(),
        type: mapped.type,
        ...(mapped.tempId ? { tempId: mapped.tempId } : {}),
        args: mapped.args,
        enqueuedAt: now(),
        attempts: 0,
      };
      commands = [...commands, command];
      persist();
      notify();
      return command;
    },
    peek(limit) {
      return commands.slice(0, limit);
    },
    remove(uuids) {
      if (uuids.size === 0) return;
      commands = commands.filter((c) => !uuids.has(c.uuid));
      persist();
      notify();
    },
    recordFailure(uuids, maxAttempts) {
      if (uuids.size === 0) return [];
      const dropped: QueuedCommand[] = [];
      commands = commands.flatMap((c) => {
        if (!uuids.has(c.uuid)) return [c];
        const next = { ...c, attempts: c.attempts + 1 };
        if (next.attempts >= maxAttempts) {
          dropped.push(next);
          return [];
        }
        return [next];
      });
      persist();
      notify();
      return dropped;
    },
    async clear() {
      commands = [];
      loaded = true; // whatever is on disk is gone: never load it back
      persist();
      await writing;
      notify();
    },
    size: () => commands.length,
    all: () => commands,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function isQueuedCommand(value: unknown): value is QueuedCommand {
  if (value === null || typeof value !== 'object') return false;
  const c = value as Partial<QueuedCommand>;
  return (
    typeof c.uuid === 'string' &&
    typeof c.type === 'string' &&
    c.args !== null &&
    typeof c.args === 'object' &&
    typeof c.enqueuedAt === 'number'
  );
}
