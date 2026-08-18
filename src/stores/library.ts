/**
 * Library store (Zustand). Holds the paper list, the active category/filter/
 * sort, the search query, and the selected paper. Loads from the Papex API and
 * falls back to the local SQLite cache (`papers_cache`) for offline browsing.
 */

import { create } from "zustand";
import type { Paper, SearchResponse } from "@/lib/api/generated";
import { useAuthStore } from "./auth";
import { db } from "@/lib/tauri/bridge";

interface LibraryState {
  papers: Paper[];
  total: number;
  category: string | null;
  query: string;
  sort: "recent" | "title" | "version";
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  load: () => Promise<void>;
  search: (q: string, semantic?: boolean) => Promise<void>;
  setCategory: (c: string | null) => void;
  setQuery: (q: string) => void;
  setSort: (s: LibraryState["sort"]) => void;
  select: (id: string | null) => void;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  papers: [],
  total: 0,
  category: null,
  query: "",
  sort: "recent",
  loading: false,
  error: null,
  selectedId: null,

  async load() {
    set({ loading: true, error: null });
    const client = useAuthStore.getState().api.client;
    try {
      const { category, sort } = get();
      // TODO(backend): replace with /api/papers list endpoint (pagination).
      const res = await client.get<{ papers: Paper[]; total: number }>(
        `/api/papers?${new URLSearchParams({
          ...(category ? { category } : {}),
          sort,
        })}`,
      );
      set({ papers: res.papers, total: res.total, loading: false });
    } catch (e) {
      // Offline fallback: read the local cache.
      try {
        const cached = await db.queryLibrary({ category: get().category ?? undefined, sort, limit: 100 });
        const papers: Paper[] = cached.map((r) => ({
          id: r.id,
          title: r.title,
          abstract: r.abstract ?? undefined,
          authors: r.authors ? r.authors.split(",").map((s) => s.trim()) : [],
          category: r.category ?? "",
          status: r.status ?? "cached",
          latestVersion: r.latestVersion ?? 1,
          versions: [],
          createdAt: new Date(r.fetchedAt ?? 0).toISOString(),
        }));
        set({ papers, total: papers.length, loading: false, error: "offline" });
      } catch {
        set({ loading: false, error: (e as Error).message });
      }
    }
  },

  async search(q, semantic = false) {
    set({ loading: true, query: q });
    const client = useAuthStore.getState().api.client;
    try {
      const res = await client.get<SearchResponse>(
        `/api/search?q=${encodeURIComponent(q)}&semantic=${semantic ? 1 : 0}`,
      );
      set({ papers: res.hits.map((h) => h.paper), total: res.total, loading: false });
    } catch (e) {
      // Offline search falls back to the local tantivy index (P2). For P0 we
      // just surface the error; the local index is wired via `indexer.search`.
      set({ loading: false, error: (e as Error).message });
    }
  },

  setCategory(c) {
    set({ category: c });
    void get().load();
  },
  setQuery(q) {
    set({ query: q });
  },
  setSort(s) {
    set({ sort: s });
    void get().load();
  },
  select(id) {
    set({ selectedId: id });
  },
}));
