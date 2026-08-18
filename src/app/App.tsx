import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router";
import { useAuthStore } from "@/stores/auth";
import { useSettingsStore } from "@/stores/settings";
import { AppLayout } from "@/app/layout/AppLayout";
import { LoginPage } from "@/features/library/LoginPage";
import { LibraryPage } from "@/features/library/LibraryPage";
import { ReaderPage } from "@/features/reader/ReaderPage";
import { CitationsPage } from "@/features/citations/CitationsPage";
import { GraphPage } from "@/features/graph/GraphPage";
import { StatsPage } from "@/features/stats/StatsPage";
import { UploadPage } from "@/features/upload/UploadPage";
import { SyncPage } from "@/features/sync/SyncPage";
import { SettingsPage } from "@/features/settings/SettingsPage";

/** Top-level: bootstraps settings + session, then routes with auth guard. */
export function App() {
  const initAuth = useAuthStore((s) => s.init);
  const initSettings = useSettingsStore((s) => s.init);
  const session = useAuthStore((s) => s.session);
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    void initSettings();
    void initAuth();
  }, [initAuth, initSettings]);

  if (status !== "ready") {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        {status === "logging-in" ? "…" : ""}
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/library" /> : <LoginPage />} />
      <Route element={<AppLayout />}>
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/reader/:id" element={<ReaderPage />} />
        <Route path="/citations" element={<CitationsPage />} />
        <Route path="/graph" element={<GraphPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/sync" element={<SyncPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to={session ? "/library" : "/login"} />} />
    </Routes>
  );
}
