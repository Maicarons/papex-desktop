/**
 * i18next setup. Default language is `zh` (persisted in settings). Error codes
 * emitted by the Rust core / API are mapped to `error.*` keys (see errors.ts).
 * All user-facing copy must go through `t()` — no hardcoded strings.
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import zh from "./zh.json";

export const SUPPORTED_LANGUAGES = ["zh", "en"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

const FALLBACK: Language = "zh";

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    zh: { translation: zh },
  },
  lng: localStorage.getItem("papex.lang") ?? FALLBACK,
  fallbackLng: FALLBACK,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export function setLanguage(lang: Language): void {
  localStorage.setItem("papex.lang", lang);
  void i18n.changeLanguage(lang);
}

export default i18n;
