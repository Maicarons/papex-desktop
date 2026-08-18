import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiClient } from "./client";
import { RefreshManager } from "./auth-refresh";
import { TokenStore, sessionFromAuth, createMemoryStorage } from "@/security/tokens";
import { ApiError } from "./errors";
import type { AuthResponse } from "@/lib/api/generated";

function b64url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function jwt(exp: number): string {
  return `${b64url({ alg: "HS256" })}.${b64url({ sub: "u1", exp })}.sig`;
}
function auth(accessExp: number, refresh = "rt", device = "d1"): AuthResponse {
  return {
    accessToken: jwt(accessExp),
    refreshToken: refresh,
    deviceId: device,
    user: { id: "u1", email: "a@b.c", name: "A", role: "user", perms: [] },
  };
}

interface Ctx {
  client: ApiClient;
  store: TokenStore;
  refresh: RefreshManager;
  fetchMock: ReturnType<typeof vi.fn>;
}

function setup(): Ctx {
  const store = new TokenStore(createMemoryStorage());
  const session = sessionFromAuth(auth(Math.floor(Date.now() / 1000) + 3600));
  store.setSession(session);
  let calls = 0;
  const refresh = new RefreshManager({
    tokenStore: store,
    doRefresh: async () => {
      calls += 1;
      const next = auth(Math.floor(Date.now() / 1000) + 3600, "rt2", "d1");
      return next;
    },
  });
  const fetchMock = vi.fn();
  const client = new ApiClient({
    baseUrl: "https://api.test",
    tokenStore: store,
    refreshManager: refresh,
    fetchImpl: fetchMock as unknown as typeof fetch,
  });
  return { client, store, refresh, fetchMock };
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("ApiClient", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("injects the bearer token", async () => {
    const { client, fetchMock } = setup();
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await client.get("/x");
    const req = fetchMock.mock.calls[0]![1] as RequestInit;
    const headers = req.headers as Headers;
    expect(headers.get("Authorization")).toMatch(/^Bearer /);
  });

  it("refreshes once on 401 and replays", async () => {
    const { client, fetchMock, store } = setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: "unauth" }, 401))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const res = await client.get("/x");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // New access token came from the refresh response.
    expect(store.getSession()?.refreshToken).toBe("rt2");
    expect(res).toEqual({ ok: true });
  });

  it("throws when refresh fails", async () => {
    const { client, fetchMock, refresh } = setup();
    fetchMock.mockResolvedValue(jsonResponse({}, 401));
    refresh.constructor; // ensure instance
    // Force refresh to reject:
    (refresh as unknown as { deps: { doRefresh: () => Promise<AuthResponse> } }).deps.doRefresh = async () => {
      throw new ApiError({ code: "AUTH_UNAUTHORIZED", message: "revoked", status: 401 });
    };
    await expect(client.get("/x")).rejects.toBeInstanceOf(ApiError);
  });

  it("retries on 429 with backoff then succeeds", async () => {
    const { client, fetchMock } = setup();
    fetchMock
      .mockResolvedValueOnce(
        new Response("rate", { status: 429, headers: { "retry-after": "0" } }),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const res = await client.get("/x");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res).toEqual({ ok: true });
  });

  it("normalises server errors to ApiError with i18n key", async () => {
    const { client, fetchMock } = setup();
    fetchMock.mockResolvedValue(jsonResponse({ code: "NOT_FOUND", message: "nope" }, 404));
    try {
      await client.get("/x");
      throw new Error("should not reach");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(404);
      expect((e as ApiError).i18nKey()).toBe("error.not_found");
    }
  });

  it("skips bearer when anonymous", async () => {
    const { client, fetchMock } = setup();
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await client.post("/api/auth/login", { a: 1 }, { anonymous: true });
    const headers = fetchMock.mock.calls[0]![1]!.headers as Headers;
    expect(headers.get("Authorization")).toBeNull();
  });

  it("sends JSON body for objects", async () => {
    const { client, fetchMock } = setup();
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await client.post("/x", { a: 1 });
    const init = fetchMock.mock.calls[0]![1]!;
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
    expect((init.headers as Headers).get("Content-Type")).toBe("application/json");
  });

  it("sends FormData as-is for multipart", async () => {
    const { client, fetchMock } = setup();
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    const fd = new FormData();
    fd.append("f", "v");
    await client.post("/x", fd, { isForm: true });
    expect(fetchMock.mock.calls[0]![1]!.body).toBe(fd);
  });
});
