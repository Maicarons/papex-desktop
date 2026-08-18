# Testing

Papex Desktop is tested at three layers, mirroring the development plan (§9).

## 1. Unit tests (Vitest, frontend)

Coverage gates: **frontend ≥80% statement** on core modules; Rust ≥85% on
`commands/*`, `db/*`, `indexer/*`.

```bash
pnpm install
pnpm test                 # run once
pnpm test:watch          # watch mode
pnpm test:coverage       # with coverage report (text + html)
```

Key suites:

- `src/security/tokens.test.ts` — JWT decode/expiry, session lifecycle,
  `TokenStore` (memory adapter: persist/read/clear/list).
- `src/lib/api/client.test.ts` — bearer injection, **401 → single-flight refresh
  → replay**, **429 backoff**, error normalization to i18n keys, multipart.
- `src/features/upload/upload.test.ts` — validation/进度/retry (planned; the
  module is covered structurally by the client + bridge tests).

Mock strategy: `fetch` and the keyring/bridge are injected (no Tauri runtime
required), so unit tests run in `jsdom` in CI without a backend.

## 2. Rust unit tests (cargo)

```bash
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
```

Covers PDF parsing, SQLite DAOs, keyring round-trip (file fallback), sync queue
exponential backoff, and upload validation.

## 3. E2E (Playwright)

Drives the Tauri WebView (or a plain Vite dev server) against a live Papex
backend. The smoke subset covers the P0 matrix: login → three-pane library →
read → annotate → offline → upload.

```bash
pnpm tauri dev          # start the app (WebView)
pnpm e2e                # run e2e/ specs (Playwright)
```

`playwright.config.ts` points at `http://localhost:1420`. Example specs:
`e2e/login.spec.ts`, `e2e/library.spec.ts`.

## 4. Cross-platform linkage tests (desktop ↔ mobile ↔ web)

These verify the shared backend contract (dev plan §9.3) and live in the
`papex` repo (`scripts/e2e-cross.sh`): desktop highlight visible on mobile,
reading-progress continuity, subscription sync, and device-revoke → 401 →
redirect to login. They require the shared test accounts
(`app-e2e` / `desktop-e2e` / `cross-e2e`, password `password123`) and a docker
DB + dev server.

## Notes

- Several backend endpoints (`/api/auth/refresh`, `/api/me/devices`,
  `/api/reading-progress`, `/api/notes`, `/api/me/avatar`,
  `/api/papers/[id]/cover`, `/api/papers/import`) are marked `TODO(backend)`.
  Where used, the client falls back to local SQLite (offline-first) and the sync
  queue marks items `pending` for later replay.
- API types in `src/lib/api/generated.ts` are generated from
  `papex openapi.json` via `pnpm gen:types` (see `scripts/gen-types.sh`). The
  committed baseline mirrors the documented contract so the app compiles before
  generation runs.
