import { useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/Button";
import { ApiError } from "@/lib/api/errors";

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const accounts = useAuthStore((s) => s.accounts);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate("/library");
    } catch (err) {
      const code = err instanceof ApiError ? err.i18nKey() : "error.unknown";
      setError(t(code));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800"
      >
        <h1 className="mb-4 text-xl font-semibold">{t("auth.login")}</h1>
        <label className="mb-3 block text-sm">
          {t("auth.email")}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
          />
        </label>
        <label className="mb-4 block text-sm">
          {t("auth.password")}
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
          />
        </label>
        {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? t("auth.signingIn") : t("auth.login")}
        </Button>

        {accounts.length > 0 && (
          <div className="mt-4 text-sm text-slate-500">
            {t("auth.accounts")}: {accounts.length}
          </div>
        )}
      </form>
    </div>
  );
}
