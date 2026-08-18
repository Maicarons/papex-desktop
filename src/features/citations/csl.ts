/**
 * Citation generation (P1). Uses `@citation-js` to render CSL styles
 * (GB/T 7714, APA, MLA, …) and to export BibTeX / RIS. LaTeX integration is a
 * thin helper that emits `\cite{...}` plus a bibliography block (dev plan §P1;
 * full papex-latex binding is a TODO).
 */

import { Cite } from "@citation-js/core";
import "@citation-js/plugin-csl";
import "@citation-js/plugin-bibtex";
import type { Paper } from "@/lib/api/generated";
import { CITATION_STYLES } from "@/lib/citations/styles";

interface CslJson {
  type: string;
  title: string;
  author: { family: string; given?: string }[];
  abstract?: string;
  DOI?: string;
  issued?: { "date-parts": number[][] };
  id: string;
}

export function paperToCsl(paper: Paper): CslJson {
  return {
    type: "article-journal",
    id: paper.id,
    title: paper.title,
    author: paper.authors.map((a) => {
      const [family, ...rest] = a.split(/\s+/);
      return { family: family ?? a, given: rest.join(" ") || undefined };
    }),
    abstract: paper.abstract,
    DOI: paper.doi,
    issued: paper.publishedAt
      ? { "date-parts": [[new Date(paper.publishedAt).getFullYear()]] }
      : undefined,
  };
}

export type CiteFormat = "text" | "html" | "bibtex" | "ris";

/** Render the selected papers into the requested style/format. */
export function generateCitation(
  papers: Paper[],
  styleId: string,
  format: CiteFormat = "text",
): string {
  const cite = new Cite(papers.map(paperToCsl));
  if (format === "bibtex") return cite.format("bibtex");
  if (format === "ris") return cite.format("ris");

  const style = CITATION_STYLES.find((s) => s.id === styleId);
  const template = style && style.id !== "bibtex" && style.id !== "ris" ? style.id : "apa";
  const language = style?.locale ?? "en-US";
  return cite.format("bibliography", {
    template,
    language,
    format: format === "html" ? "html" : "text",
  } as Parameters<typeof cite.format>[1]);
}

/** Build a BibTeX entry key for a paper (used by the LaTeX helper). */
export function citeKey(paper: Paper): string {
  const first = paper.authors[0]?.split(/\s+/)[0] ?? "anon";
  const year = paper.publishedAt ? new Date(paper.publishedAt).getFullYear() : "n.d.";
  return `${first}${year}`.replace(/[^A-Za-z0-9]/g, "");
}
