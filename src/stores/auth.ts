/**
 * Auth store (Zustand). Owns the single ApiStack (TokenStore + RefreshManager +
 * ApiClient) and the active session. Login persists tokens to the OS keyring;
 * logout revokes the device and clears local credentials. Multi-account is
 * supported via the keyring namespace (<=5 sessions).
 */

import { create } from "zustand";
import { createClient, type ApiStack } from "@/lib/api";
import { config } from "@/lib/config";
import {
  sessionFromAuth,
  redact,
  type Session,
  type SessionMeta,
} from "@/security/tokens";
import type { AuthResponse } from "@/lib/api/generated";

function deviceFingerprint(): string {
  const cached = localStorage.getItem("papex.fp");
  if (cached) return cached;
  const fp = `${navigator.userAgent}|${navigator.language}|${Math.random().toString(36).slice(2)}`;
  localStorage.setItem("papex.fp", fp);
  return fp;
}

function deviceName(): string {
  const p = navigator.platform || "Desktop";
  return `Papex Desktop (${p})`;
}

interface AuthState {
  api: ApiStack;
  session: Session | null;
  accounts: SessionMeta[];
  status: "idle" | "logging-in" | "ready" | "error";
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchAccount: (userId: string) => Promise<void>;
  init: () => Promise<void>;
  hydrate: (meta: SessionMeta, refreshToken: string) => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
  const api = createClient(config.apiBaseUrl, config.apiKey);

  return {
    api,
    session: null,
    accounts: [],
    status: "idle",
    error: null,

    async login(email, password) {
      set({ status: "logging-in", error: null });
      try {
        const res = await api.client.post<AuthResponse>("/api/auth/login", {
          email,
          password,
          device: {
            deviceName: deviceName(),
            platform: "desktop",
            fingerprint: deviceFingerprint(),
          },
        });
        const session = sessionFromAuth(res);
        api.tokenStore.setSession(session);
        await api.tokenStore.persist(session);
        const accounts = await api.tokenStore.listAccounts();
        set({ session, accounts, status: "ready" });
      } catch (e) {
        set({ status: "error", error: (e as Error).message });
        throw e;
      }
    },

    async logout() {
      const { session, api: a } = get();
      // Best-effort device revoke (backend endpoint, TODO(backend)).
      if (session) {
        try {
          await a.client.post("/api/auth/logout", { deviceId: session.deviceId });
        } catch {
          /* ignore network errors on logout */
        }
        await a.tokenStore.clear(session.userId);
      }
      set({ session: null, accounts: await a.tokenStore.listAccounts() });
    },

    async switchAccount(userId) {
      const { api: a } = get();
      const stored = await a.tokenStore.read(userId);
      if (!stored) return;
      get().hydrate(stored.meta, stored.refreshToken);
      set({ accounts: await a.tokenStore.listAccounts() });
    },

    hydrate(meta, refreshToken) {
      // Build a session with an expired access token so the client proactively
      // refreshes on first authenticated request. The refresh token is live.
      const session: Session = {
        userId: meta.userId,
        email: meta.email,
        name: meta.name,
        accessToken: "",
        refreshToken,
        accessExpiresAt: 0,
        refreshExpiresAt: meta.refreshExpiresAt,
        deviceId: meta.deviceId,
        role: meta.role,
        perms: [],
      };
      get().api.tokenStore.setSession(session);
      set({ session, status: "ready" });
    },

    async init() {
      const { api: a } = get();
      const accounts = await a.tokenStore.listAccounts();
      if (accounts.length === 0) {
        set({ accounts, status: "ready" });
        return;
      }
      // Hydrate the most recently refreshed account.
      const latest = [...accounts].sort((x, y) => y.refreshExpiresAt - x.refreshExpiresAt)[0]!;
      const stored = await a.tokenStore.read(latest.userId);
      if (stored) get().hydrate(latest, stored.refreshToken);
      set({ accounts, status: "ready" });
    },
  };
});

export { redact };
