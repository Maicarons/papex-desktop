import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLibraryStore } from "@/stores/library";
import { CITATION_STYLES } from "@/lib/citations/styles";
import { generateCitation, type CiteFormat } from "./csl";
import { toBibtex } from "./bibtex";
import { toRis } from "./ris";
import { latexSnippet } from "./latex";
import { Button } from "@/components/Button";
import type { Paper } from "@/lib/api/generated";

export function CitationsPage() {
  const { t } = useTranslation();
  const papers = useLibraryStore((s) => s.papers);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [styleId, setStyleId] = useState(CITATION_STYLES[0]!.id);
  const [output, setOutput] = useState("");
  const [, setFormat] = useState<CiteFormat>("text");

  const chosen = papers.filter((p) => selected.has(p.id));

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const render = (fmt: CiteFormat) => {
    setFormat(fmt);
    if (chosen.length === 0) {
      setOutput(t("citations.empty"));
      return;
    }
    if (fmt === "bibtex") setOutput(toBibtex(chosen));
    else if (fmt === "ris") setOutput(toRis(chosen));
    else setOutput(generateCitation(chosen, styleId, fmt));
  };

  const latex = () => setOutput(chosen.length ? latexSnippet(chosen) : t("citations.empty"));

  return (
    <div className="flex h-full">
      <div className="w-72 overflow-auto border-r border-slate-200 p-3 dark:border-slate-800">
        <div className="mb-2 text-sm font-semibold">{t("library.list")}</div>
        {papers.map((p: Paper) => (
          <label key={p.id} className="flex items-center gap-2 py-1 text-sm">
            <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
            <span className="truncate">{p.title}</span>
          </label>
        ))}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select
            value={styleId}
            onChange={(e) => setStyleId(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900"
          >
            {CITATION_STYLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <Button variant="secondary" onClick={() => render("text")}>
            {t("citations.generate")}
          </Button>
          <Button variant="secondary" onClick={() => render("bibtex")}>
            {t("citations.exportBibtex")}
          </Button>
          <Button variant="secondary" onClick={() => render("ris")}>
            {t("citations.exportRis")}
          </Button>
          <Button variant="secondary" onClick={latex}>
            {t("citations.insertLatex")}
          </Button>
          <Button variant="ghost" onClick={() => navigator.clipboard.writeText(output)}>
            {t("citations.copy")}
          </Button>
        </div>
        <textarea
          readOnly
          value={output}
          className="flex-1 rounded border border-slate-300 p-3 font-mono text-sm dark:border-slate-600 dark:bg-slate-900"
        />
      </div>
    </div>
  );
}
