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
  /** Correlation id of the request (spec 5.9); shown shortened on 5xx. */
  requestId?: string;
  /** Machine-readable case of spec 12.10 (version-conflict, project-archived, limit-reached…). */
  code?: string;
  /** Latest version of the resource, sent with 409 version-conflict (spec 5.6). */
  current?: unknown;
  /** limit-reached: which LimitKind and its maximum (spec 2.1). */
  limit?: string;
  max?: number;
}

export interface ApiErrorInit {
  status: number;
  title: string;
  detail?: string;
  errors?: FieldError[];
  requestId?: string;
  code?: string;
  current?: unknown;
  limit?: string;
  max?: number;
  /** Every member of the ProblemDetail body (extension members such as `position`, `linkToken`). */
  properties?: Record<string, unknown>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly title: string;
  readonly detail?: string;
  readonly errors?: FieldError[];
  readonly requestId?: string;
  readonly code?: string;
  readonly current?: unknown;
  readonly limit?: string;
  readonly max?: number;
  /** Whole ProblemDetail body, {} when there was none (M2 `position`, M3 `twoFactorToken`, M5 `linkToken`). */
  readonly properties: Readonly<Record<string, unknown>>;

  constructor(init: ApiErrorInit) {
    super(init.detail ?? init.title);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = 'ApiError';
    this.status = init.status;
    this.title = init.title;
    this.detail = init.detail;
    this.errors = init.errors;
    this.requestId = init.requestId;
    this.code = init.code;
    this.current = init.current;
    this.limit = init.limit;
    this.max = init.max;
    this.properties = init.properties ?? {};
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
  let body: ProblemDetail & Record<string, unknown> = {};
  if (bodyText) {
    try {
      const parsed: unknown = JSON.parse(bodyText);
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        body = parsed as ProblemDetail & Record<string, unknown>;
      }
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
    requestId: typeof body.requestId === 'string' ? body.requestId : undefined,
    code: typeof body.code === 'string' ? body.code : undefined,
    current: body.current !== null && typeof body.current === 'object' ? body.current : undefined,
    limit: typeof body.limit === 'string' ? body.limit : undefined,
    max: typeof body.max === 'number' ? body.max : undefined,
    properties: body,
  });
}
