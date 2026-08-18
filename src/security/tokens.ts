/**
 * Papex tokens system (six elements: auth · authz · quota · refresh · verify · persistence).
 *
 * Contract (shared with papex-app, dev plan §7):
 *  - accessToken: JWT HS256, exp 15min. We decode `exp` locally to know when to
 *    refresh without a server round-trip.
 *  - refreshToken: 256-bit opaque, 30d, rotating + device-bound (platform=desktop).
 *  - Persistence: refresh token goes to the OS keyring (Windows Credential
 *    Manager / macOS Keychain / Linux SecretService, file fallback). It MUST
 *    NEVER be written to SQLite or logs. A redacted session descriptor (no
 *    refresh token) lives in local settings.
 *  - Multi-account: keyring is namespaced by `user:"{userId}"`; up to 5 sessions.
 *
 * The module is storage-agnostic: a `TokenStorageAdapter` is injected so unit
 * tests can use an in-memory backend while production uses the Tauri keyring.
 */

import type { AuthResponse, DeviceInfo, User } from "@/lib/api/generated";
import { keyring, db } from "@/lib/tauri/bridge";

export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Refresh proactively when the access token has less than this remaining. */
export const REFRESH_SKEW_MS = 5 * 60 * 1000;

export interface Session {
  userId: string;
  email: string;
  name: string;
  accessToken: string;
  /** Sensitive — persisted only in the OS keyring, never in SQLite/logs. */
  refreshToken: string;
  accessExpiresAt: number; // ms epoch
  refreshExpiresAt: number; // ms epoch
  deviceId: string;
  role: string;
  perms: string[];
}

/** Redacted session suitable for local settings (NO tokens). */
export interface SessionMeta {
  userId: string;
  email: string;
  name: string;
  accessExpiresAt: number;
  refreshExpiresAt: number;
  deviceId: string;
  role: string;
}

// ---- Pure helpers ----

function base64UrlDecode(input: string): string {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  // `atob` is available in browsers and Node 16+. Decode as UTF-8.
  const bin = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
  return decodeURIComponent(
    bin
      .split("")
      .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join(""),
  );
}

/** Decode a JWT's payload (header/payload only; signature is NOT verified here). */
export function decodeJwt(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(base64UrlDecode(parts[1]!)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Return the access token expiry as ms epoch, or null if undecodable. */
export function decodeExpiry(accessToken: string): number | null {
  const payload = decodeJwt(accessToken);
  const exp = payload?.["exp"];
  if (typeof exp === "number") return exp * 1000;
  return null;
}

/** True when the access token is expired (or undecodable) within `skew` ms. */
export function isExpired(accessToken: string, skewMs = 0): boolean {
  const exp = decodeExpiry(accessToken);
  if (exp === null) return true;
  return Date.now() >= exp - skewMs;
}

/** True when the access token should be refreshed proactively (<= skew left). */
export function needsRefresh(accessToken: string, skewMs = REFRESH_SKEW_MS): boolean {
  const exp = decodeExpiry(accessToken);
  if (exp === null) return true;
  return Date.now() >= exp - skewMs;
}

export function authHeader(accessToken: string): string {
  return `Bearer ${accessToken}`;
}

/** Build a full Session from a login/refresh response. */
export function sessionFromAuth(auth: AuthResponse, now = Date.now()): Session {
  const accessExpiresAt = decodeExpiry(auth.accessToken) ?? now + ACCESS_TOKEN_TTL_MS;
  return {
    userId: auth.user.id,
    email: auth.user.email,
    name: auth.user.name,
    accessToken: auth.accessToken,
    refreshToken: auth.refreshToken,
    accessExpiresAt,
    refreshExpiresAt: now + REFRESH_TOKEN_TTL_MS,
    deviceId: auth.deviceId,
    role: auth.user.role,
    perms: auth.user.perms,
  };
}

/** Produce a redacted descriptor (drops tokens). */
export function redact(session: Session): SessionMeta {
  return {
    userId: session.userId,
    email: session.email,
    name: session.name,
    accessExpiresAt: session.accessExpiresAt,
    refreshExpiresAt: session.refreshExpiresAt,
    deviceId: session.deviceId,
    role: session.role,
  };
}

/** True when the refresh token itself has expired. */
export function refreshExpired(session: Session, now = Date.now()): boolean {
  return now >= session.refreshExpiresAt;
}

// ---- Storage adapter ----

export interface TokenStorageAdapter {
  getRefresh(userId: string): Promise<string | null>;
  setRefresh(userId: string, refresh: string): Promise<void>;
  deleteRefresh(userId: string): Promise<void>;
  getMeta(userId: string): Promise<SessionMeta | null>;
  setMeta(userId: string, meta: SessionMeta): Promise<void>;
  listMetas(): Promise<SessionMeta[]>;
}

/**
 * Default adapter backed by the Tauri bridge:
 *  - refresh token -> OS keyring (`keyring:set/get/delete`, service "papex-desktop")
 *  - redacted meta -> local SQLite settings (`db:settings_*`, scoped key)
 */
export function createBridgeStorage(): TokenStorageAdapter {
  // `@tauri-apps/api/core` (via bridge) is safe to load in any context.
  const META_PREFIX = "session:";
  return {
    async getRefresh(userId) {
      return keyring.get(userId);
    },
    async setRefresh(userId, refresh) {
      await keyring.set(userId, refresh);
    },
    async deleteRefresh(userId) {
      await keyring.delete(userId);
    },
    async getMeta(userId) {
      const raw = await db.settingsGet(META_PREFIX + userId);
      return raw ? (JSON.parse(raw) as SessionMeta) : null;
    },
    async setMeta(userId, meta) {
      await db.settingsSet(META_PREFIX + userId, JSON.stringify(meta));
    },
    async listMetas() {
      const all = await db.settingsAll();
      return all
        .filter((r) => r.key.startsWith(META_PREFIX))
        .map((r) => JSON.parse(r.value) as SessionMeta);
    },
  };
}

/** In-memory adapter for tests / pre-Tauri web fallback. */
export function createMemoryStorage(): TokenStorageAdapter & {
  snapshot(): Record<string, string>;
} {
  const refresh = new Map<string, string>();
  const meta = new Map<string, SessionMeta>();
  return {
    async getRefresh(u) {
      return refresh.get(u) ?? null;
    },
    async setRefresh(u, r) {
      refresh.set(u, r);
    },
    async deleteRefresh(u) {
      refresh.delete(u);
    },
    async getMeta(u) {
      return meta.get(u) ?? null;
    },
    async setMeta(u, m) {
      meta.set(u, m);
    },
    async listMetas() {
      return [...meta.values()];
    },
    snapshot: () => Object.fromEntries(refresh),
  };
}

// ---- Token store ----

export class TokenStore {
  private active: Session | null = null;

  constructor(
    private readonly storage: TokenStorageAdapter,
    private readonly now: () => number = Date.now,
  ) {}

  /** Active in-memory session (holds the live access token). */
  getSession(): Session | null {
    return this.active;
  }

  /** Set the active session (e.g. after login / refresh). */
  setSession(session: Session): void {
    this.active = session;
  }

  /** Persist refresh token (keyring) + redacted meta (settings). */
  async persist(session: Session): Promise<void> {
    await this.storage.setRefresh(session.userId, session.refreshToken);
    await this.storage.setMeta(session.userId, redact(session));
  }

  /** Read persisted credentials for a user (refresh token + meta). */
  async read(userId: string): Promise<{ refreshToken: string; meta: SessionMeta } | null> {
    const [refreshToken, meta] = await Promise.all([
      this.storage.getRefresh(userId),
      this.storage.getMeta(userId),
    ]);
    if (!refreshToken || !meta) return null;
    return { refreshToken, meta };
  }

  /** Remove persisted credentials for a user (logout / device revoke). */
  async clear(userId: string): Promise<void> {
    await this.storage.deleteRefresh(userId);
    // Meta is cleared opportunistically; best-effort.
    try {
      await this.storage.setMeta(userId, undefined as unknown as SessionMeta);
    } catch {
      /* ignore */
    }
    if (this.active?.userId === userId) this.active = null;
  }

  /** List redacted session descriptors for the account switcher (<=5). */
  listAccounts(): Promise<SessionMeta[]> {
    return this.storage.listMetas();
  }

  /** Has a usable (non-expired refresh) session in memory? */
  hasValidSession(): boolean {
    return this.active !== null && !refreshExpired(this.active, this.now());
  }

  /** Whether the active access token should be proactively refreshed. */
  shouldRefresh(): boolean {
    return this.active !== null && needsRefresh(this.active.accessToken);
  }
}

// ---- Device identity (login request payload) ----

export function buildDeviceInfo(fingerprint: string, deviceName: string): DeviceInfo {
  return { deviceId: "", deviceName, platform: "desktop", fingerprint };
}

export type { User };
