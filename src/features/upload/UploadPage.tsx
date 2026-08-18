import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth";
import {
  pickFile,
  submitPaper,
  uploadAvatar,
  uploadCover,
  type PickedFile,
  type UploadContext,
} from "./upload";
import { Button } from "@/components/Button";
import { ApiError } from "@/lib/api/errors";

type Tab = "submit" | "import" | "avatar" | "cover";
type Phase = "idle" | "validating" | "uploading" | "done" | "error";

function ctx(): UploadContext {
  const api = useAuthStore.getState().api;
  return {
    client: api.client,
    getAccessToken: () => api.tokenStore.getSession()?.accessToken ?? null,
    apiKey: api.apiKey,
  };
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="mt-2 h-2 w-full rounded bg-slate-200 dark:bg-slate-700">
      <div className="h-full rounded bg-brand transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function UploadPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("submit");
  const [phase, setPhase] = useState<Phase>("idle");
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<PickedFile | null>(null);
  const [paperId, setPaperId] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");

  const choose = async () => {
    setError(null);
    setPhase("validating");
    const f = await pickFile(tab === "avatar" || tab === "cover" ? "image" : "pdf");
    if (!f) {
      setPhase("idle");
      return;
    }
    setFile(f);
    setPhase("idle");
  };

  const run = async () => {
    if (!file) return;
    setError(null);
    setPhase("uploading");
    setPct(0);
    try {
      const c = ctx();
      const onProgress = (p: number) => setPct(p);
      if (tab === "submit") {
        await submitPaper(c, { title: title || file.name, authors: [], abstract: "", category: category || "c0", file }, onProgress);
      } else if (tab === "import") {
        await importUpload(c, file, onProgress);
      } else if (tab === "avatar") {
        await uploadAvatar(c, file, onProgress);
      } else if (tab === "cover") {
        if (!paperId) throw new ApiError({ code: "VALIDATION_FAILED", message: "paperId required", status: 400 });
        await uploadCover(c, paperId, file, onProgress);
      }
      setPhase("done");
    } catch (e) {
      setPhase("error");
      setError(e instanceof ApiError ? t(e.i18nKey()) : (e as Error).message);
    }
  };

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex gap-2">
        {(["submit", "import", "avatar", "cover"] as Tab[]).map((tb) => (
          <Button key={tb} variant={tab === tb ? "primary" : "secondary"} onClick={() => setTab(tb)}>
            {t(`upload.${tb === "submit" ? "submitPaper" : tb === "import" ? "importPdf" : tb}`)}
          </Button>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        <div
          onClick={choose}
          className="flex h-32 cursor-pointer items-center justify-center rounded border-2 border-dashed border-slate-300 text-sm text-slate-500 dark:border-slate-600"
        >
          {file ? file.name : t("upload.dropHint")}
        </div>

        {tab === "submit" && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <input
              placeholder={t("common.required") + ": " + "title"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
            <input
              placeholder="category id"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
          </div>
        )}
        {tab === "cover" && (
          <input
            placeholder="paper id"
            value={paperId}
            onChange={(e) => setPaperId(e.target.value)}
            className="mt-3 w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900"
          />
        )}

        {phase === "uploading" && <ProgressBar pct={pct} />}
        {phase === "done" && <div className="mt-2 text-sm text-accent">{t("upload.uploaded")}</div>}
        {phase === "error" && <div className="mt-2 text-sm text-red-600">{error}</div>}

        <div className="mt-3 flex gap-2">
          <Button onClick={run} disabled={!file || phase === "uploading"}>
            {phase === "uploading" ? t("upload.uploading") : t("common.submit")}
          </Button>
          {phase === "error" && (
            <Button variant="secondary" onClick={run}>
              {t("upload.retry")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Local import shares the same upload pipeline as submission.
import { importPdf as doImportPdf } from "./upload";
async function importUpload(c: UploadContext, file: PickedFile, onProgress?: (p: number) => void) {
  await doImportPdf(c, { file }, onProgress);
}
