import { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useLibraryStore } from "@/stores/library";

const NAV = [
  { to: "/library", key: "nav.library" },
  { to: "/reader", key: "nav.reader", disabled: true },
  { to: "/citations", key: "nav.citations" },
  { to: "/graph", key: "nav.graph" },
  { to: "/stats", key: "nav.stats" },
  { to: "/upload", key: "nav.upload" },
  { to: "/sync", key: "nav.sync" },
  { to: "/settings", key: "nav.settings" },
] as const;

export function AppLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const search = useLibraryStore((s) => s.search);

  // Global shortcut: Ctrl/Cmd+K opens the quick search overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submitSearch = () => {
    if (!q.trim()) return;
    void search(q.trim(), false);
    setSearchOpen(false);
    navigate("/library");
  };

  return (
    <div className="flex h-screen">
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="px-4 py-4 text-lg font-semibold text-brand">{t("common.appName")}</div>
        <nav className="flex flex-col gap-1 px-2">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm ${
                  isActive
                    ? "bg-brand/10 text-brand"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                } ${n.disabled ? "opacity-40" : ""}`
              }
            >
              {t(n.key)}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="relative flex-1 overflow-auto">
        <Outlet />
      </main>

      {searchOpen && (
        <div className="absolute inset-0 z-50 flex items-start justify-center bg-black/30 pt-32">
          <div className="w-full max-w-xl rounded-lg bg-white p-4 shadow-xl dark:bg-slate-800">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitSearch()}
              placeholder={t("common.search")}
              className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
            />
          </div>
        </div>
      )}
    </div>
  );
}
