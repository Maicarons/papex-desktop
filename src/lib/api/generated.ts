/**
 * API types for the Papex server.
 *
 * NOTE: In the real pipeline these are generated from `papex` `openapi.json`
 * via `scripts/gen-types.sh` (`openapi-typescript` -> `src/lib/api/generated.ts`).
 * This committed baseline mirrors the documented contract (dev plan §5/§6) so
 * the frontend compiles before `pnpm gen:types` is run against a live server.
 * Run `pnpm gen:types` to regenerate and overwrite this file.
 */

export interface ApiError {
  code: string;
  message: string;
  /** Optional field-level errors. */
  fields?: Record<string, string[]>;
  requestId?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: string;
  perms: string[];
}

export interface DeviceInfo {
  deviceId: string;
  deviceName: string;
  platform: "desktop" | "ios" | "android" | "web";
  fingerprint: string;
}

/** Response from `POST /api/auth/login` (App mode). */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  deviceId: string;
  user: User;
}

export interface Category {
  id: string;
  name: string;
  nameEn: string;
  parentId: string | null;
}

export interface PaperVersion {
  version: number;
  pdfUrl?: string;
  size: number;
  createdAt: string;
  coverUrl?: string;
}

export interface Paper {
  id: string;
  title: string;
  abstract?: string;
  authors: string[];
  category: string;
  status: string;
  latestVersion: number;
  versions: PaperVersion[];
  doi?: string;
  publishedAt?: string;
  createdAt: string;
}

export interface SearchHit {
  paper: Paper;
  score: number;
}

export interface SearchResponse {
  hits: SearchHit[];
  total: number;
  semantic: boolean;
}

export interface ReadingProgress {
  paperId: string;
  version: number;
  page: number;
  percent: number;
  updatedAt: string;
}

export type NoteKind = "highlight" | "note";

export interface Note {
  id: string;
  paperId: string;
  version: number;
  kind: NoteKind;
  page: number;
  rect: Rect;
  color?: string;
  content?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ImportPaperInput {
  title: string;
  authors?: string[];
  abstract?: string;
  category?: string;
  pdf: Blob;
}

export interface SubmitPaperInput {
  title: string;
  authors: string[];
  abstract: string;
  category: string;
  doi?: string;
  pdf: Blob;
}

/** Upload endpoints and their multipart field shapes. */
export const UPLOAD_ENDPOINTS = {
  submit: (input: { title: string }) => `/api/papers`,
  submitVersion: (paperId: string) => `/api/papers/${paperId}/pdf`,
  import: () => `/api/papers/import`,
  avatar: () => `/api/me/avatar`,
  cover: (paperId: string) => `/api/papers/${paperId}/cover`,
  noteAttachment: (noteId: string) => `/api/notes/${noteId}/attachment`,
} as const;
