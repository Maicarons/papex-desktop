/**
 * Design tokens shared between Tailwind (CSS, see `src/styles/global.css`) and
 * runtime consumers such as ECharts. Kept in TS so charts can reference the
 * same palette in both light and dark modes.
 */

export const palette = {
  // Semantic chart colors (work in light + dark via CSS variables fallback).
  primary: "#2f6df6",
  accent: "#16a34a",
  highlightYellow: "#fde047",
  highlightGreen: "#86efac",
  highlightBlue: "#93c5fd",
  highlightPink: "#f9a8d4",
  grid: "rgba(128,128,128,0.2)",
  text: "#1f2937",
  textDark: "#e5e7eb",
} as const;

export type HighlightColor = "yellow" | "green" | "blue" | "pink";

export const highlightColors: Record<HighlightColor, string> = {
  yellow: palette.highlightYellow,
  green: palette.highlightGreen,
  blue: palette.highlightBlue,
  pink: palette.highlightPink,
};

/** Tailwind breakpoints (px) for responsive component logic. */
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;
