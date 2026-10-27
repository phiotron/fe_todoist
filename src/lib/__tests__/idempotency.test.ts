import { createIdempotencyKeys } from '../idempotency';
import { newUuid } from '../uuid';

describe('createIdempotencyKeys', () => {
  it('reuses the key while the payload is unchanged (retry after an error)', () => {
    let n = 0;
    const keys = createIdempotencyKeys(() => `k${(n += 1)}`);
    expect(keys.keyFor({ content: 'A' })).toBe('k1');
    expect(keys.keyFor({ content: 'A' })).toBe('k1');
  });

  it('issues a new key when the payload changes or after reset (success)', () => {
    let n = 0;
    const keys = createIdempotencyKeys(() => `k${(n += 1)}`);
    expect(keys.keyFor({ content: 'A' })).toBe('k1');
    expect(keys.keyFor({ content: 'B' })).toBe('k2');
    keys.reset();
    expect(keys.keyFor({ content: 'B' })).toBe('k3');
  });

  it('uses UUID v4 by default', () => {
    expect(createIdempotencyKeys().keyFor('x')).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('newUuid', () => {
  it('is a RFC 4122 v4 UUID, different every time', () => {
    const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    const a = newUuid();
    expect(a).toMatch(pattern);
    expect(newUuid()).not.toBe(a);
  });

  it('falls back to a generated v4 when the platform has no crypto.randomUUID', () => {
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    try {
      expect(newUuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true });
    }
  });
});
