import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useLibraryStore } from "@/stores/library";
import { useReaderStore } from "@/stores/reader";
import { CATEGORIES } from "./categories";
import { PaperCard } from "@/components/PaperCard";
import { Spinner } from "@/components/Spinner";
import { Button } from "@/components/Button";
import type { Paper } from "@/lib/api/generated";

function CategoryTree() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "en" ? "en" : "zh";
  const category = useLibraryStore((s) => s.category);
  const setCategory = useLibraryStore((s) => s.setCategory);
  const parents = CATEGORIES.filter((c) => c.parentId === null);

  return (
    <div className="h-full overflow-auto border-r border-slate-200 p-2 dark:border-slate-800">
      <div className="px-2 py-1 text-xs font-semibold uppercase text-slate-400">
        {t("library.categories")}
      </div>
      <button
        onClick={() => setCategory(null)}
        className={`block w-full rounded px-2 py-1 text-left text-sm ${
          category === null ? "bg-brand/10 text-brand" : "hover:bg-slate-100 dark:hover:bg-slate-800"
        }`}
      >
        {t("common.all")}
      </button>
      {parents.map((p) => {
        const children = CATEGORIES.filter((c) => c.parentId === p.id);
        return (
          <div key={p.id}>
            <button
              onClick={() => setCategory(p.id)}
              className={`block w-full rounded px-2 py-1 text-left text-sm ${
                category === p.id
                  ? "bg-brand/10 text-brand"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {lang === "zh" ? p.name : p.nameEn}
            </button>
            {children.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`block w-full rounded px-2 py-1 pl-6 text-left text-sm ${
                  category === c.id
                    ? "bg-brand/10 text-brand"
                    : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                {lang === "zh" ? c.name : c.nameEn}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function PaperList() {
  const { t } = useTranslation();
  const papers = useLibraryStore((s) => s.papers);
  const loading = useLibraryStore((s) => s.loading);
  const select = useLibraryStore((s) => s.select);
  const selectedId = useLibraryStore((s) => s.selectedId);
  const loadReader = useReaderStore((s) => s.loadPaper);
  const navigate = useNavigate();

  const open = (p: Paper) => {
    select(p.id);
    void loadReader(p, p.latestVersion);
    navigate(`/reader/${p.id}`);
  };

  return (
    <div className="h-full overflow-auto p-3">
      {loading ? (
        <Spinner label={t("common.loading")} />
      ) : papers.length === 0 ? (
        <div className="p-6 text-sm text-slate-500">{t("library.empty")}</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {papers.map((p) => (
            <PaperCard
              key={p.id}
              paper={p}
              onOpen={open}
            />
          ))}
          {selectedId && null}
        </div>
      )}
    </div>
  );
}

function PaperDetail() {
  const { t } = useTranslation();
  const papers = useLibraryStore((s) => s.papers);
  const selectedId = useLibraryStore((s) => s.selectedId);
  const paper = papers.find((p) => p.id === selectedId);
  if (!paper) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        {t("library.detail")}
      </div>
    );
  }
  return (
    <div className="h-full overflow-auto border-l border-slate-200 p-4 dark:border-slate-800">
      <h2 className="text-lg font-semibold">{paper.title}</h2>
      <p className="mt-2 text-sm text-slate-500">{paper.abstract}</p>
      <div className="mt-4 text-xs text-slate-400">
        {paper.authors.join(", ")} · DOI: {paper.doi ?? "—"}
      </div>
    </div>
  );
}

export function LibraryPage() {
  const { t } = useTranslation();
  const load = useLibraryStore((s) => s.load);
  const query = useLibraryStore((s) => s.query);
  const setQuery = useLibraryStore((s) => s.setQuery);
  const search = useLibraryStore((s) => s.search);
  const sort = useLibraryStore((s) => s.sort);
  const setSort = useLibraryStore((s) => s.setSort);
  const importPdfPick = useImportPdf();

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex h-full">
      <div className="w-56 shrink-0">
        <CategoryTree />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-slate-200 p-2 dark:border-slate-800">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search(query)}
            placeholder={t("common.search")}
            className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "recent" | "title" | "version")}
            className="rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900"
          >
            <option value="recent">{t("library.sortRecent")}</option>
            <option value="title">{t("library.sortTitle")}</option>
            <option value="version">{t("library.sortVersion")}</option>
          </select>
          <Button variant="secondary" onClick={() => void importPdfPick()}>
            {t("library.importPdf")}
          </Button>
        </div>
        <div className="min-h-0 flex-1">
          <PaperList />
        </div>
      </div>
      <div className="w-80 shrink-0">
        <PaperDetail />
      </div>
    </div>
  );
}

// Local PDF import entry point (P1): pick -> parse via Rust -> upload.
function useImportPdf() {
  const { t } = useTranslation();
  return async function importPdf() {
    // Lazy import to keep the upload bundle out of the initial load.
    const { pickFile, importPdf: doImport } = await import("@/features/upload/upload");
    const api = useAuthStoreApi();
    const file = await pickFile("pdf");
    if (!file) return;
    try {
      // TODO(backend): pass parsed metadata from `pdf:parse` to the import call.
      await doImport(
        { client: api.client, getAccessToken: () => api.tokenStore.getSession()?.accessToken ?? null, apiKey: api.apiKey },
        { file },
      );
      void t;
    } catch (e) {
      console.error("import failed", e);
    }
  };
}

// Small helper to reach the active API stack from outside a component hook flow.
import { useAuthStore } from "@/stores/auth";
function useAuthStoreApi() {
  return useAuthStore.getState().api;
}
