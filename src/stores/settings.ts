/**
 * Settings store (Zustand). Theme + language are persisted to localStorage and
 * applied immediately; the PDF cache limit is persisted to the local SQLite
 * settings table via the bridge.
 */

import { create } from "zustand";
import { setLanguage, type Language } from "@/lib/i18n";
import { config } from "@/lib/config";
import { db } from "@/lib/tauri/bridge";

export type Theme = "light" | "dark" | "system";

interface SettingsState {
  theme: Theme;
  lang: Language;
  cacheLimitMb: number;
  setTheme: (t: Theme) => void;
  setLang: (l: Language) => void;
  setCacheLimit: (mb: number) => void;
  init: () => Promise<void>;
}

function applyTheme(t: Theme) {
  const dark =
    t === "dark" ||
    (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: (localStorage.getItem("papex.theme") as Theme) || "system",
  lang: (localStorage.getItem("papex.lang") as Language) || config.i18nFallback,
  cacheLimitMb: config.cacheLimitMb,

  setTheme(t) {
    localStorage.setItem("papex.theme", t);
    applyTheme(t);
    set({ theme: t });
  },
  setLang(l) {
    setLanguage(l);
    set({ lang: l });
  },
  async setCacheLimit(mb) {
    set({ cacheLimitMb: mb });
    try {
      await db.settingsSet("cacheLimitMb", String(mb));
    } catch {
      /* non-fatal */
    }
  },
  async init() {
    applyTheme(get().theme);
    setLanguage(get().lang);
    try {
      const raw = await db.settingsGet("cacheLimitMb");
      if (raw) set({ cacheLimitMb: Number(raw) });
    } catch {
      /* non-fatal */
    }
  },
}));
