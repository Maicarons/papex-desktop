/**
 * Reader store (Zustand). Tracks the open paper, page/zoom/dark state, the
 * annotations for the current (paper, version), and the persisted reading
 * progress. Local writes go through the bridge (`db:*`) and are marked
 * `pending` so the sync runner replays them to the cloud.
 */

import { create } from "zustand";
import type { Paper } from "@/lib/api/generated";
import { db, type AnnotationRow, type ReadingProgressRow } from "@/lib/tauri/bridge";
import { useAuthStore } from "./auth";

interface ReaderState {
  paper: Paper | null;
  version: number;
  page: number;
  zoom: number;
  dark: boolean;
  annotations: AnnotationRow[];
  loadPaper: (paper: Paper, version?: number) => Promise<void>;
  setPage: (page: number, total: number) => void;
  setZoom: (z: number) => void;
  toggleDark: () => void;
  addHighlight: (page: number, rect: unknown, color: string) => Promise<void>;
  addNote: (page: number, rect: unknown, content: string) => Promise<void>;
  deleteAnnotation: (id: string) => Promise<void>;
  saveProgress: () => Promise<void>;
}

function now(): number {
  return Date.now();
}

export const useReaderStore = create<ReaderState>((set, get) => ({
  paper: null,
  version: 1,
  page: 1,
  zoom: 1,
  dark: false,
  annotations: [],

  async loadPaper(paper, version = 1) {
    set({ paper, version, page: 1, annotations: [] });
    try {
      const anns = await db.annotationsGet(paper.id, version);
      set({ annotations: anns });
    } catch {
      /* offline: no annotations yet */
    }
    try {
      const prog = await db.readingProgressGet(paper.id);
      if (prog) set({ page: prog.page });
    } catch {
      /* ignore */
    }
  },

  setPage(page, total) {
    set({ page: Math.max(1, Math.min(page, total)) });
  },
  setZoom(z) {
    set({ zoom: Math.max(0.5, Math.min(3, z)) });
  },
  toggleDark() {
    set({ dark: !get().dark });
  },

  async addHighlight(page, rect, color) {
    const { paper, version, annotations } = get();
    if (!paper) return;
    const ann: AnnotationRow = {
      id: crypto.randomUUID(),
      paperId: paper.id,
      version,
      kind: "highlight",
      page,
      rectJson: JSON.stringify(rect),
      color,
      content: null,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      syncState: "pending",
    };
    await db.annotationsUpsert(ann);
    set({ annotations: [...annotations, ann] });
  },

  async addNote(page, rect, content) {
    const { paper, version, annotations } = get();
    if (!paper) return;
    const ann: AnnotationRow = {
      id: crypto.randomUUID(),
      paperId: paper.id,
      version,
      kind: "note",
      page,
      rectJson: JSON.stringify(rect),
      color: null,
      content,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      syncState: "pending",
    };
    await db.annotationsUpsert(ann);
    set({ annotations: [...annotations, ann] });
  },

  async deleteAnnotation(id) {
    const { annotations } = get();
    await db.annotationsDelete(id);
    set({ annotations: annotations.filter((a) => a.id !== id) });
  },

  async saveProgress() {
    const { paper, version, page, annotations } = get();
    if (!paper) return;
    const total = Math.max(page, 1);
    const percent = total > 0 ? Math.min(100, (page / total) * 100) : 0;
    const row: ReadingProgressRow = {
      paperId: paper.id,
      version,
      page,
      percent,
      updatedAt: now(),
      syncState: "pending",
    };
    await db.readingProgressUpsert(row);
    void annotations;
  },
}));

// Re-export for callers that need the active api stack (e.g. to fetch PDF).
export const readerApi = () => useAuthStore.getState().api.client;
