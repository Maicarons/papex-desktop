/**
 * Typed bridge between the React frontend and the Rust core.
 *
 * The frontend NEVER touches the filesystem directly. Every native capability
 * (PDF parse, SQLite, keyring, upload validation, system paths, sync) is
 * reached through a typed `invoke` wrapper declared here. Inputs are validated
 * by Rust (serde) and paths are always rooted at `app_cache_dir()` to prevent
 * traversal. Keep command names in sync with `src-tauri/src/commands/*`.
 */

import { invoke } from "@tauri-apps/api/core";

// ---- Shared DTOs (mirror Rusqlite row structs in src-tauri/src/db/schema.rs) ----

export interface PaperRow {
  id: string;
  title: string;
  abstract?: string | null;
  category?: string | null;
  status?: string | null;
  latestVersion?: number | null;
  authors?: string | null;
  fetchedAt?: number | null;
}

export type SyncState = "local" | "pending" | "synced" | "conflict";

export interface AnnotationRow {
  id: string;
  paperId: string;
  version: number;
  kind: "highlight" | "note";
  page: number;
  rectJson: string;
  color?: string | null;
  content?: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
  syncState: SyncState;
}

export interface ReadingProgressRow {
  paperId: string;
  version: number;
  page: number;
  percent: number;
  updatedAt: number;
  syncState: SyncState;
}

export interface SettingRow {
  key: string;
  value: string;
}

export interface ParseResult {
  title?: string | null;
  authors?: string | null;
  pages: number;
  textPreview?: string | null;
  size: number;
}

export type UploadKind =
  | "paper_pdf"
  | "import_pdf"
  | "avatar"
  | "cover"
  | "note_attachment";

export interface ValidateResult {
  ok: boolean;
  size: number;
  mime: string;
  error?: string | null;
}

export interface AppPaths {
  cacheDir: string;
  configDir: string;
  dataDir: string;
}

export interface IndexHit {
  paperId: string;
  title: string;
  score: number;
}

export interface SyncStatus {
  pending: number;
  lastError?: string | null;
}

export interface SyncResult {
  processed: number;
  failed: number;
}

export interface UpdateInfo {
  version: string;
  currentVersion: string;
  date?: string | null;
}

// ---- Command wrappers ----

export const pdf = {
  parse: (path: string) => invoke<ParseResult>("pdf:parse", { path }),
};

export const db = {
  queryLibrary: (args: {
    category?: string;
    query?: string;
    sort?: string;
    limit?: number;
    offset?: number;
  }) => invoke<PaperRow[]>("db:query_library", { args }),
  annotationsGet: (paperId: string, version: number) =>
    invoke<AnnotationRow[]>("db:annotations_get", { paperId, version }),
  annotationsUpsert: (ann: AnnotationRow) =>
    invoke<void>("db:annotations_upsert", { ann }),
  annotationsDelete: (id: string) => invoke<void>("db:annotations_delete", { id }),
  readingProgressGet: (paperId: string) =>
    invoke<ReadingProgressRow | null>("db:reading_progress_get", { paperId }),
  readingProgressUpsert: (p: ReadingProgressRow) =>
    invoke<void>("db:reading_progress_upsert", { progress: p }),
  settingsGet: (key: string) => invoke<string | null>("db:settings_get", { key }),
  settingsSet: (key: string, value: string) =>
    invoke<void>("db:settings_set", { key, value }),
  settingsAll: () => invoke<SettingRow[]>("db:settings_all"),
};

export const indexer = {
  search: (q: string, limit = 20) =>
    invoke<IndexHit[]>("indexer:search", { q, limit }),
  upsert: (paperId: string, title: string, abstractText: string) =>
    invoke<void>("indexer:upsert", { paperId, title, abstractText }),
};

export const keyring = {
  get: (user: string) => invoke<string | null>("keyring:get", { user }),
  set: (user: string, secret: string) =>
    invoke<void>("keyring:set", { user, secret }),
  delete: (user: string) => invoke<void>("keyring:delete", { user }),
};

export const upload = {
  validate: (path: string, kind: UploadKind) =>
    invoke<ValidateResult>("upload:validate", { path, kind }),
};

export const system = {
  paths: () => invoke<AppPaths>("system:app_paths"),
  openPath: (path: string) => invoke<void>("system:open_path", { path }),
  checkUpdate: () => invoke<UpdateInfo | null>("system:check_update"),
};

export const sync = {
  run: () => invoke<SyncResult>("sync:run"),
  status: () => invoke<SyncStatus>("sync:status"),
};
