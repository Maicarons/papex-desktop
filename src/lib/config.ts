/**
 * Runtime configuration sourced from build-time environment (`VITE_*` vars,
 * see `.env.example`). Centralised so stores/components read one place.
 */

// Cast to our known keys without re-declaring the global `ImportMeta` (which is
// already provided by vite/client). Unknown VITE_ vars fall back gracefully.
const env = import.meta.env as unknown as {
  VITE_API_BASE_URL?: string;
  VITE_I18N_FALLBACK?: string;
  VITE_CACHE_LIMIT_MB?: string;
  VITE_PAPEX_API_KEY?: string;
};

export const config = {
  apiBaseUrl: env.VITE_API_BASE_URL ?? "https://api.papex.example.com",
  i18nFallback: (env.VITE_I18N_FALLBACK === "en" ? "en" : "zh") as "zh" | "en",
  cacheLimitMb: Number(env.VITE_CACHE_LIMIT_MB ?? 2048),
  apiKey: env.VITE_PAPEX_API_KEY ?? "",
};
