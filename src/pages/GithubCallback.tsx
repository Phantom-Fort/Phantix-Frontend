import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { BrandLogo } from "@/components/BrandLogo";

/**
 * GitHub App setup/callback landing page (app.phantix.site/integrations/github/callback).
 * GitHub redirects here after the user installs the App. We forward the params to
 * the backend callback, then point the user to the Platform's GitHub page.
 */
export default function GithubCallback() {
  const [params] = useSearchParams();
  const installationId = params.get("installation_id");
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!installationId && !params.get("setup_action")) {
      setState("error");
      setError("This GitHub callback is missing installation details. Please connect again from the Platform.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await api.post("/github/callback", {
          installation_id: installationId ? Number(installationId) : undefined,
          state: params.get("state") || "",
          setup_action: params.get("setup_action") || "",
          account_login: params.get("account_login") || "",
          account_type: params.get("account_type") || "",
          request_id: params.get("request_id") ? Number(params.get("request_id")) : undefined,
          requested_by_login: params.get("requested_by_login") || "",
        });
        if (!cancelled) setState("done");
      } catch (e) {
        if (!cancelled) {
          setState("error");
          setError(e instanceof Error ? e.message : "Could not complete the GitHub connection.");
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-phantix-950 px-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-grid-faint bg-grid [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,black,transparent)]" />
        <div className="absolute left-1/2 top-1/3 h-[420px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-phantix-600/20 blur-[130px]" />
      </div>

      <div className="relative w-full max-w-[440px] text-center">
        <BrandLogo className="mx-auto h-20 w-20 drop-shadow-[0_0_40px_rgba(51,85,181,0.6)]" />
        <div className="card mt-8 p-8">
          {state === "loading" && (
            <div className="py-4">
              <Loader2 size={28} className="mx-auto animate-spin text-gold-400" />
              <p className="mt-4 text-sm text-slate-400">Recording your GitHub connection…</p>
            </div>
          )}

          {state === "done" && (
            <div className="py-2">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-400/12 text-emerald-400">
                <CheckCircle2 size={30} />
              </span>
              <h1 className="mt-5 font-display text-2xl font-bold text-white">GitHub connected</h1>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-400">
                The Phantix GitHub App is now installed. Manage repositories and analysis on the Platform.
              </p>
              <a
                href="https://platform.phantix.site/github"
                target="_blank"
                rel="noreferrer"
                className="btn-primary mt-6 inline-flex w-full items-center justify-center !py-3"
              >
                <ExternalLink size={15} /> Open GitHub on the Platform
              </a>
            </div>
          )}

          {state === "error" && (
            <div className="py-2">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-severity-critical/12 text-severity-critical">
                <XCircle size={30} />
              </span>
              <h1 className="mt-5 font-display text-2xl font-bold text-white">GitHub connection failed</h1>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-400">{error}</p>
              <Link to="/" className="btn-primary mt-6 inline-flex w-full items-center justify-center !py-3">
                Back to the app
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
