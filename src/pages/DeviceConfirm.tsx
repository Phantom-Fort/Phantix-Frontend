import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2, Mail } from "lucide-react";
import { api } from "@/lib/api";
import { notifyDeviceConfirmed } from "@/lib/deviceConfirm";
import { BrandLogo } from "@/components/BrandLogo";

/**
 * Opens from the org-specific confirmation email link:
 *   /device-confirm?org=<slug>&challenge=<token>
 * Confirms the new device on the backend, broadcasts to the login tab, and
 * tells the user they can return to sign-in.
 */
export default function DeviceConfirm() {
  const [params] = useSearchParams();
  const org = params.get("org") ?? "";
  const challenge = params.get("challenge") ?? "";
  const [state, setState] = useState<"loading" | "confirmed" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!org || !challenge) {
      setState("error");
      setError("This confirmation link is incomplete. Please sign in again and use the fresh link from your email.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        await api.post("/app/auth/device-confirm", { challenge });
        if (cancelled) return;
        setState("confirmed");
        notifyDeviceConfirmed();
      } catch (e) {
        if (cancelled) return;
        setState("error");
        setError(e instanceof Error ? e.message : "Confirmation failed. Please request a fresh link.");
      }
    })();
    return () => { cancelled = true; };
  }, [org, challenge]);

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
              <p className="mt-4 text-sm text-slate-400">Confirming this device for {org || "your organization"}...</p>
            </div>
          )}

          {state === "confirmed" && (
            <div className="py-2">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-400/12 text-emerald-400">
                <CheckCircle2 size={30} />
              </span>
              <h1 className="mt-5 font-display text-2xl font-bold text-white">Device confirmed</h1>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-400">
                This browser is now your primary device for <span className="text-slate-200">{org}</span>. You can return
                to the sign-in tab — it will finish automatically.
              </p>
              <Link to="/login" className="btn-primary mt-6 inline-flex w-full items-center justify-center !py-3">
                Return to sign in
              </Link>
            </div>
          )}

          {state === "error" && (
            <div className="py-2">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-severity-critical/12 text-severity-critical">
                <XCircle size={30} />
              </span>
              <h1 className="mt-5 font-display text-2xl font-bold text-white">Link not accepted</h1>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-400">{error}</p>
              <Link to="/login" className="btn-primary mt-6 inline-flex w-full items-center justify-center !py-3">
                <Mail size={15} /> Back to sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
