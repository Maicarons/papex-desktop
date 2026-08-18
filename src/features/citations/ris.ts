/**
 * RIS export (P1). Delegates to `@citation-js`; exported as a standalone helper
 * so callers can request RIS independently of the CSL text rendering.
 */

import type { Paper } from "@/lib/api/generated";
import { generateCitation } from "./csl";

export function toRis(papers: Paper[]): string {
  return generateCitation(papers, "ris", "ris");
}
