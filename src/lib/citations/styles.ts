/**
 * Citation style registry. We target the CSL styles supported by
 * `@citation-js/plugin-csl` plus the formats required by the dev plan (§P1):
 * GB/T 7714, APA, MLA and a handful of common journal styles. BibTeX and RIS are
 * handled by the respective plugins regardless of CSL.
 */

export interface CitationStyle {
  /** CSL style id understood by @citation-js. */
  id: string;
  /** Human label (shown in the UI, already translated elsewhere). */
  label: string;
  /** Locale for CSL rendering. */
  locale: string;
}

export const CITATION_STYLES: CitationStyle[] = [
  { id: "gb7714", label: "GB/T 7714", locale: "zh-CN" },
  { id: "apa", label: "APA", locale: "en-US" },
  { id: "mla", label: "MLA", locale: "en-US" },
  { id: "chicago", label: "Chicago", locale: "en-US" },
  { id: "ieee", label: "IEEE", locale: "en-US" },
  { id: "vancouver", label: "Vancouver", locale: "en-US" },
  { id: "harvard", label: "Harvard", locale: "en-US" },
  { id: "bibtex", label: "BibTeX", locale: "en-US" },
  { id: "ris", label: "RIS", locale: "en-US" },
  { id: "nature", label: "Nature", locale: "en-US" },
  { id: "springer", label: "Springer", locale: "en-US" },
];

export const EXPORT_FORMATS = ["bibtex", "ris"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];
