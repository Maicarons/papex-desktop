import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/stores/settings";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/Button";

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const theme = useSettingsStore((s) => s.theme);
  const lang = useSettingsStore((s) => s.lang);
  const cacheLimitMb = useSettingsStore((s) => s.cacheLimitMb);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setLang = useSettingsStore((s) => s.setLang);
  const setCacheLimit = useSettingsStore((s) => s.setCacheLimit);
  const session = useAuthStore((s) => s.session);
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="mx-auto max-w-2xl p-4">
      <h1 className="mb-4 text-lg font-semibold">{t("settings.title")}</h1>

      <section className="mb-6 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        <div className="mb-2 text-sm font-semibold">{t("settings.account")}</div>
        <div className="text-sm text-slate-500">
          {session ? `${session.name} (${session.email})` : "—"}
        </div>
        <Button variant="danger" className="mt-2" onClick={() => void logout()}>
          {t("auth.logout")}
        </Button>
      </section>

      <section className="mb-6 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        <div className="mb-2 text-sm font-semibold">{t("settings.theme")}</div>
        <div className="flex gap-2">
          {(["light", "dark", "system"] as const).map((th) => (
            <Button key={th} variant={theme === th ? "primary" : "secondary"} onClick={() => setTheme(th)}>
              {th}
            </Button>
          ))}
        </div>
      </section>

      <section className="mb-6 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        <div className="mb-2 text-sm font-semibold">{t("settings.language")}</div>
        <div className="flex gap-2">
          {(["zh", "en"] as const).map((l) => (
            <Button key={l} variant={lang === l ? "primary" : "secondary"} onClick={() => setLang(l)}>
              {l === "zh" ? "中文" : "English"}
            </Button>
          ))}
        </div>
        <div className="mt-1 text-xs text-slate-400">active: {i18n.language}</div>
      </section>

      <section className="mb-6 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        <div className="mb-2 text-sm font-semibold">{t("settings.storage")}</div>
        <label className="block text-sm text-slate-500">
          {t("settings.cacheLimit")}
          <input
            type="number"
            value={cacheLimitMb}
            onChange={(e) => void setCacheLimit(Number(e.target.value))}
            className="mt-1 w-32 rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-900"
          />
        </label>
        <Button variant="secondary" className="mt-2" onClick={() => void setCacheLimit(cacheLimitMb)}>
          {t("settings.clearCache")}
        </Button>
      </section>

      <section className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        <div className="mb-2 text-sm font-semibold">{t("settings.update")}</div>
        <Button variant="secondary" onClick={() => void checkUpdate()}>
          {t("settings.checkUpdate")}
        </Button>
        <div className="mt-1 text-xs text-slate-400">{t("settings.version")}: 0.1.0</div>
      </section>
    </div>
  );
}

async function checkUpdate() {
  // TODO(backend/tauri): bridge.system.checkUpdate() drives the updater plugin.
  const { system } = await import("@/lib/tauri/bridge");
  try {
    await system.checkUpdate();
  } catch {
    /* updater not available outside Tauri shell */
  }
}
