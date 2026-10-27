export interface FieldError {
  field: string;
  message: string;
}

/** RFC 9457 ProblemDetail as returned by the backend (application/problem+json). */
export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  errors?: FieldError[];
}

export class ApiError extends Error {
  readonly status: number;
  readonly title: string;
  readonly detail?: string;
  readonly errors?: FieldError[];

  constructor(init: { status: number; title: string; detail?: string; errors?: FieldError[] }) {
    super(init.detail ?? init.title);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = 'ApiError';
    this.status = init.status;
    this.title = init.title;
    this.detail = init.detail;
    this.errors = init.errors;
  }
}

export class NetworkError extends Error {
  constructor() {
    super('Network request failed');
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = 'NetworkError';
  }
}

/** Thrown before sending a write while the device is offline: writes are never queued (spec 5.6). */
export class OfflineError extends NetworkError {
  constructor() {
    super();
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = 'OfflineError';
  }
}

/** The server did not answer within the client timeout (DEFAULT_TIMEOUT_MS in client.ts). */
export class TimeoutError extends NetworkError {
  constructor() {
    super();
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = 'TimeoutError';
  }
}

function isFieldError(value: unknown): value is FieldError {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as FieldError).field === 'string' &&
    typeof (value as FieldError).message === 'string'
  );
}

export function problemToApiError(status: number, statusText: string, bodyText: string): ApiError {
  let body: ProblemDetail = {};
  if (bodyText) {
    try {
      const parsed: unknown = JSON.parse(bodyText);
      if (parsed !== null && typeof parsed === 'object') body = parsed as ProblemDetail;
    } catch {
      // Not JSON (e.g. a proxy HTML page): keep the empty body.
    }
  }
  const errors = Array.isArray(body.errors) ? body.errors.filter(isFieldError) : [];
  return new ApiError({
    status,
    title: typeof body.title === 'string' ? body.title : statusText || `HTTP ${status}`,
    detail: typeof body.detail === 'string' ? body.detail : undefined,
    errors: errors.length > 0 ? errors : undefined,
  });
}
