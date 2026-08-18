/**
 * Fetch wrapper for the Papex API. Same contract as the mobile client:
 *  - injects `Authorization: Bearer <accessToken>` from the TokenStore;
 *  - on 401: single-flight refresh (see RefreshManager) then replay once;
 *  - on 429: exponential backoff + jitter, UI-notified;
 *  - normalises every error into `ApiError` with an i18n key.
 *
 * The class is transport-agnostic (`fetchImpl` is injectable) so unit tests can
 * drive it with a mocked fetch and a memory TokenStore.
 */

import { ApiError, fromPayload, fromRateLimit } from "./errors";
import { RefreshManager } from "./auth-refresh";
import { authHeader, type TokenStore } from "@/security/tokens";

export interface ClientConfig {
  baseUrl: string;
  tokenStore: TokenStore;
  refreshManager: RefreshManager;
  /** Optional API key used to bootstrap the demo before backend auth ships. */
  apiKey?: string;
  fetchImpl?: typeof fetch;
  /** Max automatic retries on 429 (default 4). */
  maxRetries?: number;
}

export interface RequestOptions {
  body?: unknown;
  /** Send body as FormData (multipart) instead of JSON. */
  isForm?: boolean;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Skip the Bearer injection (e.g. login itself). */
  anonymous?: boolean;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const jitter = (base: number) => base + Math.random() * base * 0.25;

export class ApiClient {
  private readonly baseUrl: string;
  /** Public base URL (used by the uploader to build XHR requests). */
  readonly apiBaseUrl: string;
  private readonly tokenStore: TokenStore;
  private readonly refresh: RefreshManager;
  private readonly apiKey?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;

  constructor(cfg: ClientConfig) {
    this.baseUrl = cfg.baseUrl.replace(/\/$/, "");
    this.apiBaseUrl = this.baseUrl;
    this.tokenStore = cfg.tokenStore;
    this.refresh = cfg.refreshManager;
    this.apiKey = cfg.apiKey;
    this.fetchImpl = cfg.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
    this.maxRetries = cfg.maxRetries ?? 4;
  }

  private buildHeaders(token: string | null, opts: RequestOptions): Headers {
    const h = new Headers(opts.headers);
    if (!opts.anonymous && token) h.set("Authorization", authHeader(token));
    if (this.apiKey) h.set("x-api-key", this.apiKey);
    if (opts.body !== undefined && !opts.isForm && !(opts.body instanceof FormData)) {
      h.set("Content-Type", "application/json");
    }
    return h;
  }

  private async send<T>(
    method: string,
    path: string,
    opts: RequestOptions,
    token: string | null,
  ): Promise<T> {
    const url = path.startsWith("http") ? path : `${this.baseUrl}${path}`;
    const headers = this.buildHeaders(token, opts);
    let body: BodyInit | undefined;
    if (opts.body !== undefined) {
      if (opts.isForm || opts.body instanceof FormData) body = opts.body as FormData;
      else body = JSON.stringify(opts.body);
    }

    let res = await this.fetchImpl(url, { method, headers, body, signal: opts.signal });

    // 401 -> single-flight refresh -> replay once.
    if (res.status === 401 && !opts.anonymous && this.tokenStore.hasValidSession()) {
      const session = await this.refresh.refresh();
      const h2 = this.buildHeaders(session.accessToken, opts);
      res = await this.fetchImpl(url, { method, headers: h2, body, signal: opts.signal });
      if (res.status === 401) {
        throw new ApiError({
          code: "AUTH_UNAUTHORIZED",
          message: "Session revoked",
          status: 401,
        });
      }
    }

    // 429 -> exponential backoff + jitter, then throw if exhausted.
    if (res.status === 429) {
      let attempt = 0;
      let last = res;
      while (attempt < this.maxRetries) {
        const retryAfterMs = this.parseRetryAfter(last) ?? jitter(1000 * 2 ** attempt);
        await sleep(retryAfterMs);
        last = await this.fetchImpl(url, { method, headers, body, signal: opts.signal });
        if (last.status !== 429) break;
        attempt += 1;
      }
      if (last.status === 429) {
        throw fromRateLimit(this.parseRetryAfter(last) ?? 0);
      }
      res = last;
    }

    if (!res.ok) {
      let payload: Parameters<typeof fromPayload>[0];
      const ct = res.headers.get("content-type") ?? "";
      try {
        payload = ct.includes("json") ? ((await res.json()) as typeof payload) : { message: await res.text() };
      } catch {
        payload = { message: res.statusText };
      }
      throw fromPayload(payload, res.status);
    }

    if (res.status === 204) return undefined as T;
    const outCt = res.headers.get("content-type") ?? "";
    return (outCt.includes("json") ? await res.json() : await res.text()) as T;
  }

  private parseRetryAfter(res: Response): number | null {
    const h = res.headers.get("retry-after");
    if (!h) return null;
    const n = Number(h);
    if (!Number.isNaN(n)) return n * 1000;
    const date = Date.parse(h);
    if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
    return null;
  }

  get<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    return this.send<T>("GET", path, opts, this.tokenStore.getSession()?.accessToken ?? null);
  }

  post<T>(path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
    return this.send<T>("POST", path, { ...opts, body }, this.tokenStore.getSession()?.accessToken ?? null);
  }

  put<T>(path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
    return this.send<T>("PUT", path, { ...opts, body }, this.tokenStore.getSession()?.accessToken ?? null);
  }

  delete<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    return this.send<T>("DELETE", path, opts, this.tokenStore.getSession()?.accessToken ?? null);
  }
}
