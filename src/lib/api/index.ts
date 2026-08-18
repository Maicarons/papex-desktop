/**
 * Build the production API client stack: TokenStore (keyring-backed) +
 * RefreshManager (single-flight) + ApiClient. Kept separate from the stores so
 * the auth store can own a single instance.
 */

import { ApiClient } from "./client";
import { RefreshManager } from "./auth-refresh";
import { TokenStore, createBridgeStorage } from "@/security/tokens";

export interface ApiStack {
  client: ApiClient;
  tokenStore: TokenStore;
  refreshManager: RefreshManager;
}

export function createClient(baseUrl: string, apiKey?: string): ApiStack {
  const tokenStore = new TokenStore(createBridgeStorage());
  const refreshManager = new RefreshManager({
    tokenStore,
    doRefresh: async ({ refreshToken, deviceId }) => {
      // Direct fetch (not via ApiClient) to avoid recursion during refresh.
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken, deviceId }),
      });
      if (!res.ok) {
        throw new Error(`refresh failed: ${res.status}`);
      }
      return (await res.json()) as Awaited<ReturnType<typeof res.json>>;
    },
  });
  const client = new ApiClient({ baseUrl, tokenStore, refreshManager, apiKey });
  return { client, tokenStore, refreshManager };
}
