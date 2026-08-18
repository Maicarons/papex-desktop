import { describe, it, expect } from "vitest";
import {
  decodeJwt,
  decodeExpiry,
  isExpired,
  needsRefresh,
  authHeader,
  sessionFromAuth,
  redact,
  refreshExpired,
  TokenStore,
  createMemoryStorage,
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_TTL_MS,
  type Session,
} from "./tokens";
import type { AuthResponse } from "@/lib/api/generated";

function b64url(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function makeJwt(expSeconds: number): string {
  return `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ sub: "u1", exp: expSeconds })}.sig`;
}

function makeAuth(accessExp: number, refreshToken = "rt", deviceId = "d1"): AuthResponse {
  return {
    accessToken: makeJwt(accessExp),
    refreshToken,
    deviceId,
    user: { id: "u1", email: "a@b.c", name: "A", role: "user", perms: ["read"] },
  };
}

describe("jwt decoding", () => {
  it("decodes a valid JWT payload", () => {
    const jwt = makeJwt(9999999999);
    expect(decodeJwt(jwt)).toMatchObject({ sub: "u1", exp: 9999999999 });
  });
  it("returns null for garbage", () => {
    expect(decodeJwt("not-a-jwt")).toBeNull();
  });
  it("extracts expiry in ms", () => {
    expect(decodeExpiry(makeJwt(1000))).toBe(1000 * 1000);
  });
});

describe("expiry helpers", () => {
  it("isExpired true when past exp", () => {
    const jwt = makeJwt(Math.floor(Date.now() / 1000) - 10);
    expect(isExpired(jwt)).toBe(true);
  });
  it("isExpired false within skew", () => {
    const jwt = makeJwt(Math.floor(Date.now() / 1000) + 100);
    expect(isExpired(jwt, 1000)).toBe(false);
  });
  it("needsRefresh true when less than skew remains", () => {
    const jwt = makeJwt(Math.floor(Date.now() / 1000) + 60); // 60s left < 300s skew
    expect(needsRefresh(jwt)).toBe(true);
  });
  it("needsRefresh false when plenty remains", () => {
    const jwt = makeJwt(Math.floor(Date.now() / 1000) + 3600);
    expect(needsRefresh(jwt)).toBe(false);
  });
  it("authHeader formats bearer", () => {
    expect(authHeader("xyz")).toBe("Bearer xyz");
  });
});

describe("session lifecycle", () => {
  it("builds a session from auth and computes expiry", () => {
    const future = Math.floor((Date.now() + ACCESS_TOKEN_TTL_MS) / 1000);
    const s = sessionFromAuth(makeAuth(future));
    expect(s.userId).toBe("u1");
    expect(s.accessExpiresAt).toBeGreaterThan(Date.now());
    expect(s.refreshExpiresAt).toBeGreaterThan(Date.now());
  });
  it("redacts tokens", () => {
    const s = sessionFromAuth(makeAuth(Math.floor(Date.now() / 1000) + 100));
    const r = redact(s);
    expect(r).not.toHaveProperty("accessToken");
    expect(r).not.toHaveProperty("refreshToken");
    expect(r.userId).toBe("u1");
  });
  it("detects refresh expiry", () => {
    const s: Session = { ...sessionFromAuth(makeAuth(Math.floor(Date.now() / 1000) + 100)), refreshExpiresAt: Date.now() - 1 };
    expect(refreshExpired(s)).toBe(true);
    expect(refreshExpired({ ...s, refreshExpiresAt: Date.now() + REFRESH_TOKEN_TTL_MS })).toBe(false);
  });
});

describe("TokenStore (memory adapter)", () => {
  it("persists and reads refresh + meta", async () => {
    const store = new TokenStore(createMemoryStorage());
    const s = sessionFromAuth(makeAuth(Math.floor(Date.now() / 1000) + 100));
    await store.persist(s);
    const read = await store.read("u1");
    expect(read?.refreshToken).toBe(s.refreshToken);
    expect(read?.meta.userId).toBe("u1");
    expect(store.getSession()).toBeNull();
    store.setSession(s);
    expect(store.hasValidSession()).toBe(true);
  });

  it("clears credentials and active session", async () => {
    const mem = createMemoryStorage();
    const store = new TokenStore(mem);
    const s = sessionFromAuth(makeAuth(Math.floor(Date.now() / 1000) + 100));
    await store.persist(s);
    store.setSession(s);
    await store.clear("u1");
    expect(await store.read("u1")).toBeNull();
    expect(store.getSession()).toBeNull();
  });

  it("lists accounts from meta", async () => {
    const store = new TokenStore(createMemoryStorage());
    const s1 = sessionFromAuth(makeAuth(Math.floor(Date.now() / 1000) + 100));
    const s2 = sessionFromAuth({ ...makeAuth(Math.floor(Date.now() / 1000) + 100), user: { ...makeAuth(Math.floor(Date.now() / 1000) + 100).user, id: "u2", email: "x@y.z" }, refreshToken: "rt2" });
    await store.persist(s1);
    await store.persist(s2);
    const accounts = await store.listAccounts();
    expect(accounts.map((a) => a.userId).sort()).toEqual(["u1", "u2"]);
  });

  it("shouldRefresh reflects active token", () => {
    const store = new TokenStore(createMemoryStorage());
    const good = sessionFromAuth(makeAuth(Math.floor(Date.now() / 1000) + 3600));
    store.setSession(good);
    expect(store.shouldRefresh()).toBe(false);
  });
});
