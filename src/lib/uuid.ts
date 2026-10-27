import * as Crypto from 'expo-crypto';

/**
 * RFC 4122 v4 UUID (Idempotency-Key, spec 12.11), from the native secure random generator of expo-crypto.
 */
export function newUuid(): string {
  return Crypto.randomUUID();
}
