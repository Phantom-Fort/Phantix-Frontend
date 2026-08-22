import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

/**
 * Complete a password reset for an application (org) user using the token
 * from the email link. Lives entirely inside the command-centre app.
 */
export default function PasswordResetComplete() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const tokenMissing = !token;

  function validate(): string | null {
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (password !== confirm) return "Passwords do not match.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    const v = validate();
    if (v) {
      setErrorMsg(v);
      return;
    }
    setLoading(true);
    try {
      await api.post("/app/auth/password-reset/complete", { token, password });
      setDone(true);
    } catch (err) {
      const detail =
        err instanceof ApiError
          ? (typeof err.detail === "string" ? err.detail : "We could not reset the password. Try again.")
          : "We could not reset the password. Try again.";
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
          {tokenMissing ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 text-red-400">
                <KeyRound size={26} />
              </div>
              <h1 className="text-lg font-semibold text-white">Missing reset token</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm text-slate-400">
                This link is incomplete. Open the reset email again or request a new link.
              </p>
              <Link
                to="/password-reset"
                className="mt-6 inline-flex items-center gap-1.5 text-xs text-gold-400 hover:text-gold-300"
              >
                <ArrowLeft size={14} /> Request a new link
              </Link>
            </div>
          ) : !done ? (
            <>
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-500/15 text-gold-400">
                  <KeyRound size={18} />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-white">Choose a new password</h1>
                  <p className="text-xs text-slate-400">Make it at least 8 characters.</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">New password</label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input w-full pr-20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200"
                    >
                      {showPw ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-300">Confirm password</label>
                  <input
                    type={showPw ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="input w-full"
                  />
                </div>

                {errorMsg && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    {errorMsg}
                  </div>
                )}

                <button type="submit" disabled={loading} className="btn-primary w-full !py-3">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : "Reset password"}
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
              <h1 className="text-lg font-semibold text-white">Password updated</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm text-slate-400">
                Your password has been reset. You can now sign in with your new password.
              </p>
              <Link
                to="/login"
                className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-gold-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-gold-400"
              >
                Continue to sign in
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
