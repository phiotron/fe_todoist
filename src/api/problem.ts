import { ApiError } from './errors';

/**
 * A ProblemDetail member beyond type / title / status / detail / instance (spec 12.10: code, position, limit…).
 * `ApiError.properties` keeps the whole body; an ApiError built by hand (tests) may carry only the typed fields
 * (`code`, `limit`…), so those are read second.
 */
export function problemProperty(error: unknown, name: string): unknown {
  if (!(error instanceof ApiError)) return undefined;
  const properties = error.properties as Readonly<Record<string, unknown>> | undefined;
  if (properties && Object.prototype.hasOwnProperty.call(properties, name)) return properties[name];
  return (error as unknown as Record<string, unknown>)[name];
}

export function hasProblemCode(error: unknown, code: string): boolean {
  return problemProperty(error, 'code') === code;
}

/** 400 filter-syntax: index (from 0, UTF-16) of the offending character in the whole query that was sent, or null. */
export function filterSyntaxPosition(error: unknown): number | null {
  if (!hasProblemCode(error, 'filter-syntax')) return null;
  const position = problemProperty(error, 'position');
  return typeof position === 'number' && Number.isInteger(position) && position >= 0 ? position : null;
}
