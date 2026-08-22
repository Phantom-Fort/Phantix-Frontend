import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2, Mail, KeyRound } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * Request a password reset for an application (org) user.
 * Stays entirely inside the command-centre app rather than bouncing to the platform.
 */
export default function PasswordResetRequest() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    const value = identifier.trim();
    if (!value) {
      setErrorMsg("Enter the email or username on your account.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/app/auth/password-reset/request", { identifier: value });
      setSubmitted(true);
    } catch (err) {
      const detail =
        err instanceof ApiError
          ? (typeof err.detail === "string" ? err.detail : "We could not start the reset. Try again.")
          : "We could not start the reset. Try again.";
      setErrorMsg(detail);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-12">
      <div className="pointer-events-none absolute -top-24 right-0 h-72 w-72 rounded-full bg-gold-500/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-72 w-72 rounded-full bg-gold-500/10 blur-3xl" />

      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <BrandLogo className="h-10 w-auto object-contain" />
          <p className="mt-3 text-sm text-slate-400">Phantix Command Centre</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
          {!submitted ? (
            <>
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-500/15 text-gold-400">
                  <Mail size={18} />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-white">Reset your password</h1>
                  <p className="text-xs text-slate-400">We'll email you a secure reset link.</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">Email or username</label>
                  <input
                    type="text"
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="you@company.com"
                    className="input w-full"
                  />
                </div>

                {errorMsg && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    {errorMsg}
                  </div>
                )}

                <button type="submit" disabled={loading} className="btn-primary w-full !py-3">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : "Send reset link"}
                </button>
              </form>

              <button
                onClick={() => navigate("/login")}
                className="mt-4 flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200"
              >
                <ArrowLeft size={14} /> Back to sign in
              </button>
            </>
          ) : (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                <CheckCircle2 size={28} />
              </div>
              <h1 className="text-lg font-semibold text-white">Check your inbox</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm text-slate-400">
                If an account exists for <span className="text-slate-200">{identifier.trim()}</span>, we've
                sent a password reset link. The link expires shortly, so act fast.
              </p>
              <Link
                to="/login"
                className="mt-6 inline-flex items-center gap-1.5 text-xs text-gold-400 hover:text-gold-300"
              >
                <ArrowLeft size={14} /> Back to sign in
              </Link>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Remember it now?{" "}
          <Link to="/login" className="text-gold-400 hover:text-gold-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
