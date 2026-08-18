import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "react-router";
import { useTranslation } from "react-i18next";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useReaderStore } from "@/stores/reader";
import { useLibraryStore } from "@/stores/library";
import { useAuthStore } from "@/stores/auth";
import {
  resolveCacheDir,
  readCachedPdf,
  savePdf,
  isCached,
} from "@/lib/storage/cache";
import { highlightColors, type HighlightColor } from "@/lib/theme/tokens";
import { Button } from "@/components/Button";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export function ReaderPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const paper = useReaderStore((s) => s.paper);
  const version = useReaderStore((s) => s.version);
  const page = useReaderStore((s) => s.page);
  const zoom = useReaderStore((s) => s.zoom);
  const dark = useReaderStore((s) => s.dark);
  const annotations = useReaderStore((s) => s.annotations);
  const loadPaper = useReaderStore((s) => s.loadPaper);
  const setPage = useReaderStore((s) => s.setPage);
  const setZoom = useReaderStore((s) => s.setZoom);
  const toggleDark = useReaderStore((s) => s.toggleDark);
  const addHighlight = useReaderStore((s) => s.addHighlight);
  const saveProgress = useReaderStore((s) => s.saveProgress);

  const papers = useLibraryStore((s) => s.papers);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [total, setTotal] = useState(1);
  const [color, setColor] = useState<HighlightColor>("yellow");
  const [drawing, setDrawing] = useState<{ x: number; y: number } | null>(null);
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  // Load the paper + PDF document.
  useEffect(() => {
    const target = papers.find((p) => p.id === id) ?? null;
    if (!target) return;
    void loadPaper(target, target.latestVersion);

    let cancelled = false;
    (async () => {
      const api = useAuthStore.getState().api;
      const cacheDir = await resolveCacheDir();
      const v = target.latestVersion;
      let blob: Blob | null = await readCachedPdf(target.id, v, cacheDir);
      if (!blob) {
        // TODO(backend): fetch from paper.versions[v-1].pdfUrl via API.
        const url = target.versions[v - 1]?.pdfUrl;
        if (url) {
          const res = await api.client.get<Blob>(url, { anonymous: false });
          blob = res;
          if (await isCached(target.id, v, cacheDir)) return;
          await savePdf(target.id, v, blob, cacheDir);
        }
      }
      if (!blob || cancelled) return;
      const buf = await blob.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: buf }).promise;
      if (cancelled) return;
      pdfDocRef.current = doc;
      setTotal(doc.numPages);
    })();

    return () => {
      cancelled = true;
    };
  }, [id, papers, loadPaper]);

  // Render the current page.
  useEffect(() => {
    const doc = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas) return;
    (async () => {
      const pg = await doc.getPage(page);
      const viewport = pg.getViewport({ scale: zoom });
      const ctx = canvas.getContext("2d")!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await pg.render({ canvasContext: ctx, viewport }).promise;
      void saveProgress();
    })();
  }, [page, zoom, saveProgress]);

  const onMouseDown = (e: React.MouseEvent) => {
    const r = containerRef.current!.getBoundingClientRect();
    setDrawing({ x: e.clientX - r.left, y: e.clientY - r.top });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!drawing) return;
    const r = containerRef.current!.getBoundingClientRect();
    setRect({
      x: Math.min(drawing.x, e.clientX - r.left),
      y: Math.min(drawing.y, e.clientY - r.top),
      w: Math.abs(e.clientX - r.left - drawing.x),
      h: Math.abs(e.clientY - r.top - drawing.y),
    });
  };
  const onMouseUp = useCallback(() => {
    if (rect && rect.w > 5 && rect.h > 5) {
      void addHighlight(page, rect, highlightColors[color]);
    }
    setDrawing(null);
    setRect(null);
  }, [rect, page, color, addHighlight]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-slate-200 p-2 dark:border-slate-800">
        <Button variant="ghost" onClick={() => setPage(page - 1, total)} disabled={page <= 1}>
          {t("reader.prevPage")}
        </Button>
        <span className="text-sm">
          {t("reader.page")} {page} {t("reader.of")} {total}
        </span>
        <Button variant="ghost" onClick={() => setPage(page + 1, total)} disabled={page >= total}>
          {t("reader.nextPage")}
        </Button>
        <Button variant="ghost" onClick={() => setZoom(zoom + 0.1)}>
          {t("reader.zoomIn")}
        </Button>
        <Button variant="ghost" onClick={() => setZoom(zoom - 0.1)}>
          {t("reader.zoomOut")}
        </Button>
        <Button variant="ghost" onClick={toggleDark}>
          {t("reader.darkMode")}
        </Button>
        <div className="ml-auto flex items-center gap-1">
          {(Object.keys(highlightColors) as HighlightColor[]).map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`h-5 w-5 rounded ${color === c ? "ring-2 ring-brand" : ""}`}
              style={{ background: highlightColors[c] }}
              aria-label={t("annotations.color")}
            />
          ))}
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative flex-1 overflow-auto bg-slate-100 p-4 dark:bg-slate-950"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
      >
        <div className="relative mx-auto w-fit">
          <canvas
            ref={canvasRef}
            className={dark ? "invert" : ""}
            style={{ filter: dark ? "invert(1) hue-rotate(180deg)" : undefined }}
          />
          {/* Annotation overlay (self-drawn highlights). */}
          {annotations
            .filter((a) => a.page === page && a.kind === "highlight")
            .map((a) => {
              const r = JSON.parse(a.rectJson) as { x: number; y: number; w: number; h: number };
              return (
                <div
                  key={a.id}
                  className="pointer-events-none absolute opacity-40"
                  style={{
                    left: r.x,
                    top: r.y,
                    width: r.w,
                    height: r.h,
                    background: a.color ?? highlightColors.yellow,
                  }}
                />
              );
            })}
          {rect && (
            <div
              className="pointer-events-none absolute opacity-50"
              style={{
                left: rect.x,
                top: rect.y,
                width: rect.w,
                height: rect.h,
                background: highlightColors[color],
              }}
            />
          )}
        </div>
      </div>

      <div className="border-t border-slate-200 p-2 text-xs text-slate-400 dark:border-slate-800">
        {t("reader.progress")}: {Math.round(((page / total) * 100) || 0)}% · v{version}
      </div>
    </div>
  );
}
