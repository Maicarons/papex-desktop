/**
 * API error model. Normalises both HTTP failures and Papex server error codes
 * into a single `ApiError` that maps to an i18n key (see `src/lib/i18n`).
 *
 * Server errors arrive as `{ code, message, fields? }`; we keep `code` so the
 * UI can show a translated message instead of a raw Chinese/English JSON blob.
 */

import type { ApiError as ApiErrorPayload } from "./generated";

export class ApiError extends Error {
  /** Server error code (e.g. "AUTH_INVALID_CREDENTIALS") or an HTTP status. */
  readonly code: string;
  /** HTTP status when transport-level (0 for network/abort). */
  readonly status: number;
  /** Field-level validation messages, if any. */
  readonly fields?: Record<string, string[]>;
  readonly requestId?: string;
  /** Whether this is a retriable transient error (429/5xx/network). */
  readonly retriable: boolean;

  constructor(opts: {
    code: string;
    message: string;
    status: number;
    fields?: Record<string, string[]>;
    requestId?: string;
  }) {
    super(opts.message);
    this.name = "ApiError";
    this.code = opts.code;
    this.status = opts.status;
    this.fields = opts.fields;
    this.requestId = opts.requestId;
    this.retriable = opts.status === 0 || opts.status === 429 || opts.status >= 500;
  }

  /** i18n key used by the UI to render a translated message. */
  i18nKey(): string {
    // Known server codes map directly to translation keys under "error.*".
    const known = new Set([
      "AUTH_INVALID_CREDENTIALS",
      "AUTH_TOKEN_EXPIRED",
      "AUTH_UNAUTHORIZED",
      "AUTH_DEVICE_REVOKED",
      "RATE_LIMITED",
      "VALIDATION_FAILED",
      "NOT_FOUND",
      "UPLOAD_TOO_LARGE",
      "UPLOAD_BAD_TYPE",
      "SERVER_ERROR",
      "NETWORK_ERROR",
    ]);
    if (known.has(this.code)) return `error.${this.code.toLowerCase()}`;
    if (this.status === 401) return "error.auth_unauthorized";
    if (this.status === 403) return "error.forbidden";
    if (this.status === 404) return "error.not_found";
    if (this.status === 429) return "error.rate_limited";
    if (this.status >= 500) return "error.server_error";
    if (this.status === 0) return "error.network_error";
    return "error.unknown";
  }
}

/** Parse a server error payload into an `ApiError`. */
export function fromPayload(p: ApiErrorPayload, status: number): ApiError {
  return new ApiError({
    code: p.code || `HTTP_${status}`,
    message: p.message || "Unknown error",
    status,
    fields: p.fields,
    requestId: p.requestId,
  });
}

/** Build an `ApiError` for a transport-level failure. */
export function fromNetwork(message: string): ApiError {
  return new ApiError({
    code: "NETWORK_ERROR",
    message,
    status: 0,
  });
}

/** Build an `ApiError` for a rate-limited response. */
export function fromRateLimit(retryAfterMs: number): ApiError {
  return new ApiError({
    code: "RATE_LIMITED",
    message: `Rate limited, retry after ${retryAfterMs}ms`,
    status: 429,
  });
}
