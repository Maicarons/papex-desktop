/**
 * Single-flight refresh manager (dev plan §7.5).
 *
 * On a 401 the client queues concurrent requests behind ONE refresh call: the
 * first request performs the round-trip, the others await the shared promise,
 * then all are replayed with the new access token. A failed refresh clears the
 * session and triggers the `onFailure` callback (redirect to login). The
 * rotating refresh token is persisted via the `TokenStore`.
 */

import type { AuthResponse } from "./generated";
import { ApiError } from "./errors";
import {
  sessionFromAuth,
  type Session,
  type TokenStore,
} from "@/security/tokens";

export interface RefreshDeps {
  tokenStore: TokenStore;
  /** Calls `POST /api/auth/refresh` with the current refresh token + device id. */
  doRefresh: (input: {
    refreshToken: string;
    deviceId: string;
  }) => Promise<AuthResponse>;
  /** Called after a successful rotation (persist + set active). */
  onRefreshed?: (session: Session) => void | Promise<void>;
  /** Called when refresh fails (clear session, redirect to login). */
  onFailure?: () => void | Promise<void>;
}

export class RefreshManager {
  private inflight: Promise<Session> | null = null;

  constructor(private readonly deps: RefreshDeps) {}

  /** True while a refresh is in flight. */
  get isRefreshing(): boolean {
    return this.inflight !== null;
  }

  /**
   * Refresh the active session. Concurrent callers share the same in-flight
   * promise. Throws `ApiError` (auth_unauthorized) if there is no session or
   * the refresh is rejected (device revoked / refresh expired).
   */
  refresh(): Promise<Session> {
    if (this.inflight) return this.inflight;

    const session = this.deps.tokenStore.getSession();
    if (!session) {
      return Promise.reject(
        new ApiError({
          code: "AUTH_UNAUTHORIZED",
          message: "No active session to refresh",
          status: 401,
        }),
      );
    }

    this.inflight = this.deps
      .doRefresh({ refreshToken: session.refreshToken, deviceId: session.deviceId })
      .then(async (auth) => {
        const next = sessionFromAuth(auth);
        // Preserve device id from the existing session if the response omits it.
        if (!next.deviceId) next.deviceId = session.deviceId;
        this.deps.tokenStore.setSession(next);
        await this.deps.tokenStore.persist(next);
        await this.deps.onRefreshed?.(next);
        return next;
      })
      .catch(async (err) => {
        await this.deps.onFailure?.();
        throw err instanceof ApiError
          ? err
          : new ApiError({
              code: "AUTH_UNAUTHORIZED",
              message: String(err),
              status: 401,
            });
      })
      .finally(() => {
        this.inflight = null;
      });

    return this.inflight;
  }
}
