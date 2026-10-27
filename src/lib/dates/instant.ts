/**
 * Parses a backend Instant ("2026-10-23T03:00:00.123456Z", 0–9 fraction digits). Hermes' `Date` can reject fractions
 * longer than 3 digits, so the fraction is normalised to exactly 3 digits (truncated, never rounded) before parsing.
 */
export function parseInstant(value: string): Date {
  return new Date(value.replace(/\.(\d+)/, (_match, digits: string) => `.${digits.slice(0, 3).padEnd(3, '0')}`));
}
