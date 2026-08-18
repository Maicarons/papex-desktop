import type { Paper } from "@/lib/api/generated";
import { useTranslation } from "react-i18next";
import { categoryName } from "@/features/library/categories";

export function PaperCard({
  paper,
  onOpen,
}: {
  paper: Paper;
  onOpen?: (p: Paper) => void;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "en" ? "en" : "zh";
  return (
    <button
      onClick={() => onOpen?.(paper)}
      className="w-full rounded-lg border border-slate-200 bg-white p-4 text-left hover:shadow-md dark:border-slate-700 dark:bg-slate-800"
    >
      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{paper.title}</div>
      <div className="mt-1 text-xs text-slate-500">
        {paper.authors.slice(0, 3).join(", ")}
        {paper.authors.length > 3 ? " et al." : ""}
      </div>
      <div className="mt-2 inline-block rounded bg-brand/10 px-2 py-0.5 text-xs text-brand">
        {categoryName(paper.category, lang)}
      </div>
      <div className="mt-2 text-xs text-slate-400">
        {t("library.list")} · v{paper.latestVersion}
      </div>
    </button>
  );
}
