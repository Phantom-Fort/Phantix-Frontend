import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, KeyRound, Mail, ShieldCheck, Smartphone, Loader2, PlayCircle } from "lucide-react";
import { api, ApiError, isDemoMode, isDemoFlagSet, exitDemoMode, tokens, API_BASE } from "@/lib/api";
import { useStore } from "@/lib/store";
import { PLATFORM_URL } from "@/lib/links";

type Stage = "password" | "otp" | "mfa" | "device";

export default function Login() {
  const { enterDemo, toast } = useStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const org = searchParams.get("org") ?? "";
  const userId = searchParams.get("u") ?? "";
  const loginToken = searchParams.get("t") ?? "";

  useEffect(() => { if (API_BASE && isDemoFlagSet()) exitDemoMode(); }, []);

  const demoMode = isDemoMode();

  // If no login link params, redirect to platform
  if (!demoMode && (!org || !userId || !loginToken)) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-grid-faint bg-grid [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,black,transparent)]" />
          <div className="absolute left-1/2 top-1/3 h-[420px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-phantix-600/20 blur-[130px]" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative w-full max-w-[420px] text-center"
        >
          <img src="/logo-white.png" alt="Phantix" className="mx-auto h-20 w-20 object-contain" />
          <h1 className="mt-5 font-display text-2xl font-bold text-white">Application Access</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Sign in to <strong>app.phantix.site</strong> using a login link from your organization administrator.
            Visit <strong className="text-gold-300">platform.phantix.site</strong> to manage your organization.
          </p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-6"
          >
            <a href={PLATFORM_URL} className="btn-primary inline-flex items-center gap-2 !py-3">
              Go to Platform <ArrowRight size={15} />
            </a>
          </motion.div>
          <p className="mt-4 text-xs text-slate-500">
            Admin? <a href={`${PLATFORM_URL}/login`} className="text-gold-400 hover:text-gold-300">Sign in to the platform</a>
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <AppLoginFlow
      org={org}
      userId={userId}
      loginToken={loginToken}
      demoMode={demoMode}
      enterDemo={enterDemo}
      navigate={navigate}
      toast={toast}
    />
  );
}

// ── App login flow component ───────────────────────────────────────────────────
function AppLoginFlow({
  org, userId, loginToken, demoMode, enterDemo, navigate, toast,
}: {
  org: string; userId: string; loginToken: string; demoMode: boolean;
  enterDemo: () => void; navigate: (path: string) => void;
  toast: (kind: "success" | "error" | "info" | "warning", title: string, body?: string) => void;
}) {
  const { completeAppLogin } = useStore();
  const [stage, setStage] = useState<Stage>("password");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [maskedDest, setMaskedDest] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [deviceToken, setDeviceToken] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challenged, setChallenged] = useState(false);
  const [nextStep, setNextStep] = useState<"otp" | "password" | null>(null);

  // Step 1: validate the login link — per 03_APPLICATION_IMPLEMENTATION.md §2.3
  useEffect(() => {
    if (demoMode || challenged) return;
    (async () => {
      setBusy(true);
      setError(null);
      try {
        const res = await api.post<{
          next_step?: string;
          mfa_token?: string;
          destination_masked?: string;
          user_email?: string;
          user_name?: string;
          otp_only?: boolean;
          password_required?: boolean;
          organization_id?: number;
          organization_name?: string;
          message?: string;
        }>("/app/auth/challenge", {
          login_token: loginToken,
          organization_slug: org,
          organization_user_id: Number(userId),
        }, { realm: "application" });
        setChallenged(true);
        setEmail(res.user_email ?? "");
        setMfaToken(res.mfa_token ?? "");
        setMaskedDest(res.destination_masked ?? "");
        if (res.next_step === "password") {
          setNextStep("password");
        } else {
          setNextStep("otp");
        }
      } catch (err) {
        const msg = err instanceof ApiError && err.status === 403
          ? "This login link requires an active service key. Contact your organization admin to create one on the platform."
          : err instanceof Error ? err.message : "Login link validation failed";
        setError(msg);
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendOtp = async () => {
    setBusy(true);
    setError(null);
    try {
      // Per §2.3 Step C1: no mfa_token yet — send login_token, org slug, user_id
      const res = await api.post<{
        mfa_required?: boolean;
        mfa_token?: string;
        destination_masked?: string;
        dev_otp?: string;
        message?: string;
      }>("/app/auth/otp", {
        login_token: loginToken,
        organization_slug: org,
        organization_user_id: Number(userId),
      }, { realm: "application" });
      setMfaToken(res.mfa_token ?? "");
      setMaskedDest(res.destination_masked ?? maskedDest);
      setDevOtp(res.dev_otp ?? null);
      setStage("mfa");
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send verification code");
    } finally {
      setBusy(false);
    }
  };

  const handlePassword = async () => {
    setBusy(true);
    setError(null);
    try {
      // Per §2.3 Step C2
      const res = await api.post<{
        mfa_token?: string;
        destination_masked?: string;
        dev_otp?: string;
        message?: string;
      }>("/app/auth/password", {
        login_token: loginToken,
        password,
        organization_slug: org,
        organization_user_id: Number(userId),
      }, { realm: "application" });
      setMfaToken(res.mfa_token ?? "");
      setMaskedDest(res.destination_masked ?? maskedDest);
      setDevOtp(res.dev_otp ?? null);
      setStage("mfa");
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password verification failed");
    } finally {
      setBusy(false);
    }
  };

  const verifyMfa = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{
        access_token?: string;
        token_type?: string;
        device_token?: string;
        device_verification_required?: boolean;
        user?: { full_name?: string; email?: string };
        user_email?: string;
        role?: string;
        effective_role?: string;
        can_operate?: boolean;
        is_initiator?: boolean;
        is_authorizer?: boolean;
        dual_control?: {
          configured?: boolean;
          eligible?: boolean;
          is_initiator?: boolean;
          is_authorizer?: boolean;
          session_token?: string;
          header_name?: string;
          inactivity_minutes?: number;
          can_operate?: boolean;
        };
        dual_control_session_token?: string;
        dual_control_header?: string;
      }>("/app/auth/mfa", {
        mfa_token: mfaToken,
        code,
        device_id: localStorage.getItem("phantix_device_id") ?? crypto.randomUUID(),
      }, { realm: "application" });

      if (res.device_verification_required && res.device_token) {
        setDeviceToken(res.device_token);
        setStage("device");
        return;
      }

      tokens.appSession = res.access_token ?? "";
      tokens.device = res.device_token ?? "";
      const devId2 = localStorage.getItem("phantix_device_id") ?? crypto.randomUUID();
      localStorage.setItem("phantix_device_id", devId2);

      // Per §2.4/§5.2: store dual-control session from MFA response (auto-issued for initiator/authorizer)
      const dcSessionToken = res.dual_control_session_token ?? res.dual_control?.session_token;
      if (dcSessionToken) {
        tokens.dualControl = dcSessionToken;
      }

      const email = res.user_email ?? res.user?.email ?? "";
      const name = res.user?.full_name ?? "";
      const isInit = res.is_initiator === true || res.dual_control?.is_initiator === true;
      const isAuth = res.is_authorizer === true || res.dual_control?.is_authorizer === true;
      completeAppLogin(email, name, isInit, isAuth);

      const roleLabel = res.effective_role ?? res.role ?? "";
      const canOperate = res.can_operate === true || res.dual_control?.can_operate === true;
      const dcInfo = canOperate && isInit && !isAuth ? " · operate as initiator" : canOperate && isAuth && !isInit ? " · operate as authorizer" : "";
      toast("success", "Signed in", "Welcome" + (name ? " " + name : " back") + dcInfo);
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const verifyDevice = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{
        access_token?: string;
        token_type?: string;
        device_token?: string;
        user?: { full_name?: string; email?: string };
        user_email?: string;
        role?: string;
        effective_role?: string;
        can_operate?: boolean;
        is_initiator?: boolean;
        is_authorizer?: boolean;
        dual_control?: {
          configured?: boolean;
          eligible?: boolean;
          is_initiator?: boolean;
          is_authorizer?: boolean;
          session_token?: string;
          header_name?: string;
          inactivity_minutes?: number;
          can_operate?: boolean;
        };
        dual_control_session_token?: string;
        dual_control_header?: string;
      }>("/app/auth/mfa", {
        device_token: deviceToken,
        code,
        device_id: localStorage.getItem("phantix_device_id") ?? crypto.randomUUID(),
      }, { realm: "application" });

      tokens.appSession = res.access_token ?? "";
      tokens.device = res.device_token ?? "";
      const devId3 = localStorage.getItem("phantix_device_id") ?? crypto.randomUUID();
      localStorage.setItem("phantix_device_id", devId3);

      const dcSessionToken = res.dual_control_session_token ?? res.dual_control?.session_token;
      if (dcSessionToken) tokens.dualControl = dcSessionToken;

      const email = res.user_email ?? res.user?.email ?? "";
      const name = res.user?.full_name ?? "";
      const isInit = res.is_initiator === true || res.dual_control?.is_initiator === true;
      const isAuth = res.is_authorizer === true || res.dual_control?.is_authorizer === true;
      completeAppLogin(email, name, isInit, isAuth);

      toast("success", "Device confirmed", "Welcome" + (name ? " " + name : " back"));
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Device verification failed");
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  // Demo mode: skip authentication
  if (demoMode) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-grid-faint bg-grid [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,black,transparent)]" />
          <div className="absolute left-1/2 top-1/3 h-[420px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-phantix-600/20 blur-[130px]" />
        </div>
        <motion.div initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} className="relative w-full max-w-[420px] text-center">
          <img src="/logo-white.png" alt="Phantix" className="mx-auto h-20 w-20 object-contain" />
          <h1 className="mt-5 font-display text-2xl font-bold text-white">Command Centre</h1>
          <p className="mt-2 text-sm text-slate-400">Demo mode — explore features instantly</p>
          <button
            onClick={() => { enterDemo(); navigate("/dashboard"); }}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gold-400 px-6 py-3 font-semibold text-phantix-950 hover:bg-gold-300"
          >
            <PlayCircle size={16} /> Explore the demo tenant
          </button>
        </motion.div>
      </div>
    );
  }

  // Loading / challenge state
  if (!challenged) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-grid-faint bg-grid [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,black,transparent)]" />
          <div className="absolute left-1/2 top-1/3 h-[420px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-phantix-600/20 blur-[130px]" />
        </div>
        <div className="relative text-center">
          <img src="/logo-white.png" alt="Phantix" className="mx-auto h-20 w-20 animate-pulse-soft object-contain" />
          <p className="mt-4 text-sm text-slate-400">Validating login link…</p>
          {error && (
            <div className="mt-4 max-w-md rounded-xl border border-severity-critical/30 bg-severity-critical/10 px-4 py-3 text-sm text-severity-critical">
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

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
          <img src="/logo-white.png" alt="Phantix" className="mx-auto h-20 w-20 object-contain" />
          <h1 className="mt-5 font-display text-2xl font-bold text-white">Command Centre</h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Application sign-in · <span className="font-mono text-xs">app.phantix.site</span>
          </p>
          {email && <p className="mt-1 text-xs text-slate-500">{email}</p>}
        </div>

        <div className="card p-7">
          <AnimatePresence mode="wait">
            {/* Stage: Password */}
            {nextStep === "password" && stage === "password" && (
              <motion.form
                key="pw"
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -14 }}
                onSubmit={async (e) => { e.preventDefault(); await handlePassword(); }}
                className="space-y-4"
              >
                <div>
                  <label className="label">Your password</label>
                  <div className="relative">
                    <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input type="password" className="input !pl-10" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoFocus />
                  </div>
                </div>
                {error && <p className="text-sm text-severity-critical">{error}</p>}
                <button className="btn-primary w-full !py-3" disabled={busy || !password}>
                  {busy ? "Checking…" : "Continue"} <ArrowRight size={15} />
                </button>
              </motion.form>
            )}

            {/* Stage: OTP/MFA */}
            {(stage === "mfa" || stage === "otp") && (
              <motion.div
                key="mfa"
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 14 }}
                className="space-y-4"
              >
                <div className="rounded-xl border border-phantix-600/40 bg-phantix-800/40 p-3.5 text-center">
                  <ShieldCheck size={22} className="mx-auto text-gold-400" />
                  <p className="mt-2 text-sm font-medium text-slate-200">Verify your identity</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {maskedDest ? "A code was sent to " + maskedDest : "Enter the verification code from your email"}
                  </p>
                </div>

                {devOtp && import.meta.env.DEV && (
                  <div className="rounded-xl border border-gold-400/30 bg-gold-400/8 p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-gold-400/80">Dev OTP</p>
                    <p className="mt-1 font-mono text-xl font-bold tracking-[0.35em] text-gold-300">{devOtp}</p>
                  </div>
                )}

                <input
                  className="input text-center font-mono !text-xl !tracking-[0.5em]"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="••••••"
                  autoFocus
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  onKeyDown={(e) => e.key === "Enter" && code.length === 6 && void (stage === "mfa" ? verifyMfa() : undefined)}
                />
                {error && <p className="text-sm text-severity-critical">{error}</p>}
                <button className="btn-primary w-full !py-3" disabled={busy || code.length !== 6} onClick={() => void verifyMfa()}>
                  {busy ? (<> <Loader2 size={14} className="animate-spin inline" /> Verifying…</>) : "Verify & sign in"}
                </button>
                <button
                  type="button"
                  onClick={() => sendOtp()}
                  disabled={busy}
                  className="w-full text-center text-xs text-slate-500 hover:text-slate-300 disabled:opacity-50"
                >
                  Resend code
                </button>
              </motion.div>
            )}

            {/* Stage: New device verification */}
            {stage === "device" && (
              <motion.div
                key="device"
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 14 }}
                className="space-y-4"
              >
                <div className="rounded-xl border border-severity-medium/40 bg-severity-medium/10 p-3.5 text-center">
                  <Smartphone size={22} className="mx-auto text-severity-medium" />
                  <p className="mt-2 text-sm font-medium text-slate-200">New device detected</p>
                  <p className="mt-1 text-xs text-slate-500">A second code was emailed to confirm this browser.</p>
                </div>
                <input
                  className="input text-center font-mono !text-xl !tracking-[0.5em]"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="••••••"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && code.length === 6 && void verifyDevice()}
                />
                {error && <p className="text-sm text-severity-critical">{error}</p>}
                <button className="btn-primary w-full !py-3" disabled={busy || code.length !== 6} onClick={() => void verifyDevice()}>
                  {busy ? (<> <Loader2 size={14} className="animate-spin inline" /> Confirming…</>) : "Verify device & sign in"}
                </button>
              </motion.div>
            )}

            {/* OTP send button (for OTP-only users) */}
            {nextStep === "otp" && stage === "password" && (
              <motion.div
                key="otpSend"
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div className="rounded-xl border border-phantix-600/40 bg-phantix-800/40 p-3.5 text-center">
                  <Mail size={22} className="mx-auto text-gold-400" />
                  <p className="mt-2 text-sm font-medium text-slate-200">OTP sign-in</p>
                  <p className="mt-1 text-xs text-slate-500">
                    This account uses email OTP — click below to receive a code.
                  </p>
                </div>
                {error && <p className="text-sm text-severity-critical">{error}</p>}
                <button className="btn-primary w-full !py-3" disabled={busy} onClick={() => sendOtp()}>
                  {busy ? (<> <Loader2 size={14} className="animate-spin inline" /> Sending…</>) : (<> Send verification code <ArrowRight size={15} /></>)}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-5 text-center text-xs text-slate-500">
          Signing in via <a href={PLATFORM_URL} className="text-gold-400 hover:text-gold-300">organization login link</a>
        </p>
      </motion.div>
    </div>
  );
}
