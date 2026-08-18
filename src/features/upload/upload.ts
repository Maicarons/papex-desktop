/**
 * Unified upload module (dev plan §2.3 / §6.3).
 *
 * All uploads (PDF submission, local PDF import, avatar, paper cover, note
 * attachment) funnel through here:
 *   1. Rust pre-flight validation (`upload:validate`: size + MIME) so nothing
 *      oversized/unsupported ever leaves the device;
 *   2. bytes are read via the Tauri `fs` plugin (frontend never holds a raw
 *      path);
 *   3. a direct `XMLHttpRequest` POST to the backend with a progress callback
 *      and abort support;
 *   4. automatic retry with backoff on transient failures.
 *
 * The backend endpoints are TODO(backend) for some flows; the request shapes
 * follow the documented contract and are exercised by E2E/mock servers.
 */

import { readFile } from "@tauri-apps/plugin-fs";
import { upload as uploadBridge, type UploadKind } from "@/lib/tauri/bridge";
import { ApiClient } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { UPLOAD_ENDPOINTS } from "@/lib/api/generated";

export interface UploadContext {
  client: ApiClient;
  getAccessToken: () => string | null;
  apiKey?: string;
}

export interface PickedFile {
  /** Path inside the app cache dir / Tauri fs scope. */
  path: string;
  name: string;
  mime: string;
  size: number;
}

function extToMime(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

/** Open the OS file dialog and resolve a `PickedFile` (path + metadata). */
export async function pickFile(accept?: string): Promise<PickedFile | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({ multiple: false, filters: accept ? toFilters(accept) : undefined });
  if (!selected || Array.isArray(selected)) return null;
  const name = selected.split(/[\\/]/).pop() ?? "file";
  const bytes = await readFile(selected);
  return { path: selected, name, mime: extToMime(name), size: bytes.length };
}

function toFilters(accept: string) {
  const map: Record<string, string[]> = {
    pdf: ["pdf"],
    image: ["png", "jpg", "jpeg", "webp"],
  };
  const exts = accept.split(",").flatMap((a) => map[a.trim()] ?? [a.trim()]);
  return [{ name: "Files", extensions: exts }];
}

async function readBlob(file: PickedFile): Promise<Blob> {
  const bytes = await readFile(file.path);
  return new Blob([bytes as BlobPart], { type: file.mime });
}

/** Validate size + MIME via Rust before any network transfer. */
export async function validate(file: PickedFile, kind: UploadKind): Promise<void> {
  const res = await uploadBridge.validate(file.path, kind);
  if (!res.ok) {
    const code = (res.error ?? "").includes("large") ? "UPLOAD_TOO_LARGE" : "UPLOAD_BAD_TYPE";
    throw new ApiError({
      code,
      message: res.error ?? "upload validation failed",
      status: 400,
    });
  }
}

function parseXhrHeaders(xhr: XMLHttpRequest): Headers {
  const h = new Headers();
  const raw = xhr.getAllResponseHeaders();
  raw.split("\r\n").forEach((line) => {
    const idx = line.indexOf(":");
    if (idx > 0) h.append(line.slice(0, idx).trim(), line.slice(idx + 1).trim());
  });
  return h;
}

/** POST a FormData with upload progress + abort. */
export function uploadWithProgress(
  ctx: UploadContext,
  endpoint: string,
  form: FormData,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${ctx.client.apiBaseUrl}${endpoint}`);
    const token = ctx.getAccessToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    if (ctx.apiKey) xhr.setRequestHeader("x-api-key", ctx.apiKey);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      const body = xhr.responseText;
      const headers = parseXhrHeaders(xhr);
      const resp = new Response(body || null, { status: xhr.status, headers });
      if (xhr.status >= 200 && xhr.status < 300) resolve(resp);
      else {
        let payload: { code?: string; message?: string };
        try {
          payload = JSON.parse(body || "{}");
        } catch {
          payload = { message: body };
        }
        reject(
          new ApiError({
            code: payload.code ?? `HTTP_${xhr.status}`,
            message: payload.message ?? xhr.statusText,
            status: xhr.status,
          }),
        );
      }
    };
    xhr.onerror = () =>
      reject(new ApiError({ code: "NETWORK_ERROR", message: "upload network error", status: 0 }));
    xhr.onabort = () => reject(new DOMException("aborted", "AbortError"));
    if (signal) {
      if (signal.aborted) xhr.abort();
      else signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }
    xhr.send(form);
  });
}

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const err = e as ApiError;
      if (!err?.retriable || i === retries) throw e;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
  throw lastErr;
}

// ---- High-level flows ----

export interface SubmitPaperInput {
  title: string;
  authors: string[];
  abstract: string;
  category: string;
  doi?: string;
  file: PickedFile;
}

export async function submitPaper(
  ctx: UploadContext,
  input: SubmitPaperInput,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  await validate(input.file, "paper_pdf");
  const blob = await readBlob(input.file);
  const form = new FormData();
  form.append("title", input.title);
  form.append("authors", JSON.stringify(input.authors));
  form.append("abstract", input.abstract);
  form.append("category", input.category);
  if (input.doi) form.append("doi", input.doi);
  form.append("pdf", blob, input.file.name);
  await withRetry(() => uploadWithProgress(ctx, UPLOAD_ENDPOINTS.submit(input), form, onProgress, signal));
}

export interface ImportPdfInput {
  file: PickedFile;
  title?: string;
  authors?: string[];
  abstract?: string;
  category?: string;
}

/** Local PDF import: parse via Rust, then upload to `/api/papers/import`. */
export async function importPdf(
  ctx: UploadContext,
  input: ImportPdfInput,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  await validate(input.file, "import_pdf");
  const blob = await readBlob(input.file);
  const form = new FormData();
  form.append("pdf", blob, input.file.name);
  if (input.title) form.append("title", input.title);
  if (input.authors) form.append("authors", JSON.stringify(input.authors));
  if (input.abstract) form.append("abstract", input.abstract);
  if (input.category) form.append("category", input.category);
  await withRetry(() => uploadWithProgress(ctx, UPLOAD_ENDPOINTS.import(), form, onProgress, signal));
}

export async function uploadAvatar(
  ctx: UploadContext,
  file: PickedFile,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  await validate(file, "avatar");
  const blob = await readBlob(file);
  const form = new FormData();
  form.append("avatar", blob, file.name);
  await withRetry(() => uploadWithProgress(ctx, UPLOAD_ENDPOINTS.avatar(), form, onProgress, signal));
}

export async function uploadCover(
  ctx: UploadContext,
  paperId: string,
  file: PickedFile,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  await validate(file, "cover");
  const blob = await readBlob(file);
  const form = new FormData();
  form.append("cover", blob, file.name);
  await withRetry(() =>
    uploadWithProgress(ctx, UPLOAD_ENDPOINTS.cover(paperId), form, onProgress, signal),
  );
}

export async function uploadNoteAttachment(
  ctx: UploadContext,
  noteId: string,
  file: PickedFile,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  await validate(file, "note_attachment");
  const blob = await readBlob(file);
  const form = new FormData();
  form.append("attachment", blob, file.name);
  await withRetry(() =>
    uploadWithProgress(ctx, UPLOAD_ENDPOINTS.noteAttachment(noteId), form, onProgress, signal),
  );
}
