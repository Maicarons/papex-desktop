/**
 * BibTeX export (P1). Delegates to `@citation-js` but also offers a hand-rolled
 * serializer so we can emit a deterministic, per-paper `.bib` block even when
 * the CSL pipeline is unavailable (offline / lightweight path).
 */

import type { Paper } from "@/lib/api/generated";
import { citeKey, generateCitation } from "./csl";

export function toBibtex(papers: Paper[]): string {
  return generateCitation(papers, "bibtex", "bibtex");
}

/** Per-paper BiBTeX snippet with an explicit key (for LaTeX `\cite`). */
export function bibtexEntry(paper: Paper): string {
  const key = citeKey(paper);
  const authors = paper.authors.join(" and ");
  const year = paper.publishedAt ? new Date(paper.publishedAt).getFullYear() : "unknown";
  return [
    `@article{${key},`,
    `  title = {${paper.title}},`,
    `  author = {${authors}},`,
    `  year = {${year}},`,
    paper.doi ? `  doi = {${paper.doi}},` : null,
    paper.abstract ? `  abstract = {${paper.abstract}},` : null,
    `}`,
  ]
    .filter(Boolean)
    .join("\n");
}
