import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSyncStore } from "@/stores/sync";
import { Button } from "@/components/Button";

export function SyncPage() {
  const { t } = useTranslation();
  const status = useSyncStore((s) => s.status);
  const lastResult = useSyncStore((s) => s.lastResult);
  const running = useSyncStore((s) => s.running);
  const refresh = useSyncStore((s) => s.refresh);
  const run = useSyncStore((s) => s.run);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="p-4">
      <h1 className="mb-3 text-lg font-semibold">{t("sync.title")}</h1>
      <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        <div className="text-sm text-slate-500">
          {t("sync.status")}:{" "}
          {status
            ? status.pending > 0
              ? t("sync.pending", { count: status.pending })
              : t("sync.ok")
            : "—"}
        </div>
        {status?.lastError && (
          <div className="mt-1 text-sm text-red-600">
            {t("sync.lastError", { msg: status.lastError })}
          </div>
        )}
        {lastResult && (
          <div className="mt-1 text-xs text-slate-400">
            processed={lastResult.processed} failed={lastResult.failed}
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <Button onClick={() => void run()} disabled={running}>
            {t("sync.runNow")}
          </Button>
          <Button variant="secondary" onClick={() => void refresh()}>
            Refresh
          </Button>
        </div>
      </div>
    </div>
  );
}
