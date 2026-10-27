import { useRef } from 'react';
import { newUuid } from './uuid';

export interface IdempotencyKeys {
  /** Same payload as last time → same key (a retry); different payload → new key (avoids 422). */
  keyFor(payload: unknown): string;
  /** Call after success so the next submit, even with identical content, is a new operation. */
  reset(): void;
}

export function createIdempotencyKeys(newKey: () => string = newUuid): IdempotencyKeys {
  let last: { signature: string; key: string } | null = null;
  return {
    keyFor(payload) {
      const signature = JSON.stringify(payload) ?? '';
      if (last?.signature !== signature) last = { signature, key: newKey() };
      return last.key;
    },
    reset() {
      last = null;
    },
  };
}

/** One key holder per form instance. */
export function useIdempotencyKeys(): IdempotencyKeys {
  const ref = useRef<IdempotencyKeys | null>(null);
  if (!ref.current) ref.current = createIdempotencyKeys();
  return ref.current;
}
