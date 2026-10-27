/**
 * RFC 4122 v4 UUID (Idempotency-Key, spec 12.11).
 * DEVIATION from the plan (Task 11): expo-crypto is not installed yet (Task 1 is blocked), so this uses the platform
 * `crypto.randomUUID` when present and a Math.random v4 otherwise. An idempotency key only needs to be unique, not
 * unpredictable. Once Task 1 has installed expo-crypto, swap the body for `Crypto.randomUUID()`.
 */
export function newUuid(): string {
  const platform = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof platform?.randomUUID === 'function') return platform.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}
