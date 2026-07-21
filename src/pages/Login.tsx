import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ShieldCheck, Mail, KeyRound, ArrowRight, PlayCircle } from "lucide-react";
import { useStore } from "@/lib/store";
import { isDemoMode, isDemoFlagSet, exitDemoMode, API_BASE } from "@/lib/api";
import { PLATFORM_URL } from "@/lib/links";

export default function Login() {
  const { login, verifyMfa, enterDemo } = useStore();
  const navigate = useNavigate();

  // Arriving at sign-in from "switch to real organization" clears the demo
  // flag so credentials authenticate against the live API.
  useEffect(() => {
    if (API_BASE && isDemoFlagSet()) exitDemoMode();
  }, []);

  const demoMode = isDemoMode();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"password" | "mfa">("password");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (stage === "password") {
        const res = await login(email, password);
        if (res.mfaRequired) setStage("mfa");
        else navigate("/dashboard");
      } else {
        await verifyMfa(code);
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-grid-faint bg-grid [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,black,transparent)]" />
        <div className="absolute left-1/2 top-1/3 h-[420px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-phantix-600/20 blur-[130px]" />
      </div>

      <Link to="/" className="absolute left-6 top-6 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-200">
        <ArrowLeft size={15} /> Back to site
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 26 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-[420px]"
      >
        <div className="mb-8 text-center">
          <motion.img
            src="/logo-white.png"
            alt="Phantix"
            className="mx-auto h-20 w-20 object-contain drop-shadow-[0_0_40px_rgba(51,85,181,0.6)]"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.1 }}
          />
          <h1 className="mt-5 font-display text-2xl font-bold text-white">Platform Console</h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Sign in with your company account · <span className="font-mono text-xs">type=access</span>
          </p>
        </div>

        <div className="card p-7">
          <AnimatePresence mode="wait">
            {stage === "password" ? (
              <motion.form
                key="pw"
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -14 }}
                onSubmit={submit}
                className="space-y-4"
              >
                <div>
                  <label className="label">Company email</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input className="input !pl-10" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
                  </div>
                </div>
                <div>
                  <label className="label">Password</label>
                  <div className="relative">
                    <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input type="password" className="input !pl-10" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                  </div>
                </div>
                {error && <p className="text-sm text-severity-critical">{error}</p>}
                <button className="btn-primary w-full !py-3" disabled={busy}>
                  {busy ? "Checking…" : "Continue"} <ArrowRight size={15} />
                </button>
                <p className="text-center text-xs text-slate-500">
                  New tenant?{" "}
                  <a href={`${PLATFORM_URL}/register`} className="text-gold-400 hover:text-gold-300">
                    Register your organization
                  </a>
                </p>
              </motion.form>
            ) : (
              <motion.form
                key="mfa"
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 14 }}
                onSubmit={submit}
                className="space-y-4"
              >
                <div className="rounded-xl border border-phantix-600/40 bg-phantix-800/40 p-3.5 text-center">
                  <ShieldCheck size={22} className="mx-auto text-gold-400" />
                  <p className="mt-2 text-sm font-medium text-slate-200">Email verification</p>
                  <p className="mt-1 text-xs text-slate-500">
                    A 6-digit code was sent to {email.replace(/(.{2}).+(@.+)/, "$1***$2")}
                  </p>
                </div>
                <input
                  className="input text-center font-mono !text-xl !tracking-[0.5em]"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="••••••"
                  autoFocus
                />
                {error && <p className="text-sm text-severity-critical">{error}</p>}
                <button className="btn-primary w-full !py-3" disabled={busy || code.length !== 6}>
                  {busy ? "Verifying…" : "Verify & sign in"}
                </button>
                <button type="button" onClick={() => setStage("password")} className="w-full text-center text-xs text-slate-500 hover:text-slate-300">
                  ← Use a different account
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {demoMode ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-5 rounded-xl border border-gold-400/20 bg-gold-400/6 px-4 py-3 text-center text-xs leading-5 text-gold-300/80"
          >
            <p>
              <strong>Demo mode</strong> — any email works; enter any 6-digit code at the verification step.
            </p>
            <button
              onClick={() => {
                enterDemo();
                navigate("/dashboard");
              }}
              className="mt-2.5 inline-flex items-center gap-1.5 font-semibold text-gold-300 hover:text-gold-200"
            >
              <PlayCircle size={13} /> or skip sign-in and explore the demo tenant
            </button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-5 rounded-xl border border-phantix-600/40 bg-phantix-800/40 px-4 py-3 text-center text-xs leading-5 text-slate-400"
          >
            Just looking?{" "}
            <button
              onClick={() => {
                enterDemo();
                navigate("/dashboard");
              }}
              className="inline-flex items-center gap-1.5 font-semibold text-gold-300 hover:text-gold-200"
            >
              <PlayCircle size={13} /> Explore the demo tenant instead
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
