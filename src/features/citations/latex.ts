/**
 * LaTeX integration (P1, stub to papex-latex).
 *
 * Produces the `\cite{...}` command and a `thebibliography` block for the
 * selected papers. The actual server-side papex-latex binding (uploading a `.tex`
 * project and resolving references) is TODO(backend) and is surfaced from the
 * UI as a copyable snippet.
 */

import type { Paper } from "@/lib/api/generated";
import { bibtexEntry, citeKey } from "./bibtex";

/** `\cite{key1,key2,...}` for inline insertion. */
export function citeCommand(papers: Paper[]): string {
  return `\\cite{${papers.map(citeKey).join(", ")}}`;
}

/** A minimal `thebibliography` block referencing the selected papers. */
export function bibliographyBlock(papers: Paper[]): string {
  const items = papers
    .map((p, i) => `\\bibitem{${citeKey(p)}} ${p.authors.join(", ")}. ${p.title}.`)
    .join("\n");
  return `\\begin{thebibliography}{${papers.length}}\n${items}\n\\end{thebibliography}`;
}

/** Combined snippet: BibTeX entries + cite command, ready to paste. */
export function latexSnippet(papers: Paper[]): string {
  const bib = papers.map(bibtexEntry).join("\n\n");
  return `% BibTeX entries\n${bib}\n\n% Inline citation\n${citeCommand(papers)}`;
}
