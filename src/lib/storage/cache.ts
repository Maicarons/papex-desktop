/**
 * Local PDF cache management.
 *
 * Downloaded PDFs are stored under `<app_cache_dir>/pdfs` (never in the app
 * bundle or arbitrary user paths). The cache is bounded by `CACHE_LIMIT_MB`;
 * oldest files are evicted when the budget is exceeded. All file IO goes through
 * the Tauri `fs` plugin — the frontend never handles raw filesystem paths.
 */

import { exists, readFile, writeFile, readDir, remove, stat, mkdir } from "@tauri-apps/plugin-fs";
import { system } from "@/lib/tauri/bridge";

const SUBDIR = "pdfs";
const DEFAULT_LIMIT_MB = 2048;

/** Absolute cache file path for a paper version. */
function absPath(baseDir: string, paperId: string, version: number): string {
  return `${baseDir}/${SUBDIR}/${paperId}@v${version}.pdf`;
}
function dirPath(baseDir: string): string {
  return `${baseDir}/${SUBDIR}`;
}

export function pdfCacheFile(paperId: string, version: number, baseDir: string): string {
  return absPath(baseDir, paperId, version);
}

export async function isCached(paperId: string, version: number, baseDir: string): Promise<boolean> {
  return exists(absPath(baseDir, paperId, version));
}

/** Read a cached PDF as a Blob (for pdf.js). Returns null if not cached. */
export async function readCachedPdf(
  paperId: string,
  version: number,
  baseDir: string,
): Promise<Blob | null> {
  const path = absPath(baseDir, paperId, version);
  if (!(await exists(path))) return null;
  const bytes = await readFile(path);
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

/** Save a PDF blob to the cache, then evict if over budget. */
export async function savePdf(
  paperId: string,
  version: number,
  blob: Blob,
  baseDir: string,
  limitMb = DEFAULT_LIMIT_MB,
): Promise<string> {
  const dir = dirPath(baseDir);
  if (!(await exists(dir))) await mkdir(dir, { recursive: true });
  const path = absPath(baseDir, paperId, version);
  const buf = new Uint8Array(await blob.arrayBuffer());
  await writeFile(path, buf);
  await evictIfNeeded(baseDir, limitMb);
  return path;
}

/** Evict oldest cached PDFs until total size is under `limitMb`. */
export async function evictIfNeeded(baseDir: string, limitMb = DEFAULT_LIMIT_MB): Promise<void> {
  const dir = dirPath(baseDir);
  if (!(await exists(dir))) return;
  const entries = await readDir(dir);
  const files = await Promise.all(
    entries
      .filter((e) => e.name?.endsWith(".pdf"))
      .map(async (e) => {
        const path = `${dir}/${e.name}`;
        const s = await stat(path);
        return { path, size: s.size ?? 0, mtime: s.mtimeMs ?? 0 };
      }),
  );
  const total = files.reduce((a, f) => a + f.size, 0);
  if (total <= limitMb * 1024 * 1024) return;
  const sorted = files.sort((a, b) => a.mtime - b.mtime);
  let used = total;
  for (const f of sorted) {
    if (used <= limitMb * 1024 * 1024) break;
    await remove(f.path);
    used -= f.size;
  }
}

/** Resolve the app cache directory (used by callers to build paths). */
export async function resolveCacheDir(): Promise<string> {
  const paths = await system.paths();
  if (!(await exists(paths.cacheDir))) {
    await mkdir(paths.cacheDir, { recursive: true });
  }
  return paths.cacheDir;
}
