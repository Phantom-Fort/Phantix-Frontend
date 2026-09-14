import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { BrandLogo } from "@/components/BrandLogo";

/**
 * Integrations Hub OAuth callback landing page.
 *
 * The API and the Platform are different origins, so the provider redirects the
 * browser HERE (e.g. platform.phantix.site/integrations/oauth/gitlab/callback).
 * The single-use `state` carries the organization + installation, so this page
 * simply forwards `code`/`state` to the API callback, which performs the token
 * exchange and marks the installation active. Mirrors GithubCallback.
 */
export default function IntegrationOAuthCallback() {
  const { connectorId = "" } = useParams();
  const [params] = useSearchParams();
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [error, setError] = useState("");
  const [alreadyActive, setAlreadyActive] = useState(false);

  const label = connectorId
    ? connectorId.charAt(0).toUpperCase() + connectorId.slice(1)
    : "Integration";

  useEffect(() => {
    const providerError = params.get("error");
    const code = params.get("code");
    const oauthState = params.get("state");

    if (providerError) {
      setState("error");
      setError(params.get("error_description") || `Authorization was declined (${providerError}).`);
      return;
    }
    if (!code || !oauthState) {
      setState("error");
      setError("This callback is missing `code`/`state`. Please start the connection again from the Platform.");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const qs = new URLSearchParams({ code, state: oauthState, format: "json" }).toString();
        const res = await api.get<{ ok?: boolean; installation_id?: number; already_active?: boolean }>(
          `/integrations/oauth/${encodeURIComponent(connectorId)}/callback?${qs}`,
        );
        if (cancelled) return;
        setAlreadyActive(Boolean(res?.already_active));
        setState("done");
      } catch (e: unknown) {
        if (cancelled) return;
        const err = e as { detail?: { message?: string }; message?: string };
        setState("error");
        setError(err?.detail?.message || err?.message || `Could not complete the ${label} connection.`);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-phantix-950 px-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-grid-faint bg-grid [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,black,transparent)]" />
        <div className="absolute left-1/2 top-1/3 h-[420px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-phantix-600/20 blur-[130px]" />
      </div>

      <div className="relative w-full max-w-[440px] text-center">
        <BrandLogo className="mx-auto h-20 w-20 drop-shadow-[0_0_40px_rgba(232,181,77,0.5)]" />
        <div className="card mt-8 p-8">
          {state === "loading" && (
            <div className="py-4">
              <Loader2 size={28} className="mx-auto animate-spin text-gold-400" />
              <p className="mt-4 text-sm text-slate-400">Finishing your {label} connection…</p>
            </div>
          )}

          {state === "done" && (
            <div className="py-2">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-400/12 text-emerald-400">
                <CheckCircle2 size={30} />
              </span>
              <h1 className="mt-5 font-display text-2xl font-bold text-white">
                {alreadyActive ? `${label} already connected` : `${label} connected`}
              </h1>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-400">
                The {label} connector is active. Repositories and pull/merge-request reviews are managed from the
                Code page.
              </p>
              <Link to="/integrations" className="btn-primary mt-6 inline-flex w-full items-center justify-center !py-3">
                Back to Integrations
              </Link>
              <Link to="/code" className="mt-3 inline-block text-xs text-slate-400 underline">
                Open the Code page
              </Link>
            </div>
          )}

          {state === "error" && (
            <div className="py-2">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-severity-critical/12 text-severity-critical">
                <XCircle size={30} />
              </span>
              <h1 className="mt-5 font-display text-2xl font-bold text-white">Connection failed</h1>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-400">{error}</p>
              <Link to="/integrations" className="btn-primary mt-6 inline-flex w-full items-center justify-center !py-3">
                Back to Integrations
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
