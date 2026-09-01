import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, KeyRound, Mail, ShieldCheck, Smartphone, Loader2, PlayCircle,
  Link2, Building2, User, AlertOctagon, Check, Send, RefreshCw,
} from "lucide-react";
import { api, ApiError, isDemoMode, isDemoFlagSet, exitDemoMode, tokens, API_BASE, deviceId } from "@/lib/api";
import { useStore } from "@/lib/store";
import { PLATFORM_URL } from "@/lib/links";
import { cx } from "@/lib/utils";
import { listenDeviceConfirmed } from "@/lib/deviceConfirm";
import { BrandLogo } from "@/components/BrandLogo";
import AuthShowcase from "@/components/AuthShowcase";
import { ThemeToggle } from "@/components/ThemeToggle";

type Stage =
  | "email"
  | "password"
  | "set_password"
  | "mfa"
  | "device"
  | "service_key_blocked";

interface ChallengeData {
  next_step?: "set_password" | "password";
  must_set_password?: boolean;
  password_set?: boolean;
  organization_name?: string;
  organization_id?: number;
  user_full_name?: string;
  user_email_masked?: string;
  user_email?: string;
}

/** Detect the 403 service_key_required detail shape and return a friendly message. */
function serviceKeyMessage(err: unknown): string | null {
  if (!(err instanceof ApiError) || err.status !== 403) return null;
  const d = err.detail as Record<string, unknown> | undefined;
  if (d && (d.error === "service_key_required" || d.service_key_required === true)) {
    return "Application access is not enabled for this company yet. An admin must create a service key on the Platform before operators can sign in.";
  }
  return null;
}

/** Detect the device-bound 401 so the UI can offer rotation. */
function isDeviceBoundError(err: unknown): boolean {
  if (!(err instanceof ApiError) || err.status !== 401) return false;
  const msg = `${err.message} ${JSON.stringify(err.detail ?? "")}`.toLowerCase();
  return (
    msg.includes("bound to another device") ||
    msg.includes("device rotation") ||
    msg.includes("replace_primary")
  );
}

export default function Login() {
  const { enterDemo, toast } = useStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const org = searchParams.get("org") ?? "";
  const userId = searchParams.get("u") ?? "";
  const loginToken = searchParams.get("t") ?? "";
  const isInvite = Boolean(loginToken);

  useEffect(() => { if (API_BASE && isDemoFlagSet()) exitDemoMode(); }, []);

  const demoMode = isDemoMode();

  // No invite link and not demo → show returning sign-in (email + password) + paste-link option.
  if (!demoMode && !isInvite) {
    return <ReturningLogin enterDemo={enterDemo} navigate={navigate} toast={toast} />;
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

// ── Shared chrome: two-column layout mirroring the platform login ──────────────
function LoginChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen overflow-hidden bg-phantix-950">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-grid-faint bg-grid [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,black,transparent)]" />
        <div className="absolute left-1/2 top-1/3 h-[420px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-phantix-600/20 blur-[130px]" />
      </div>

      <div className="relative z-10 w-full lg:grid lg:min-h-screen lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)]">
        <AuthShowcase />

        <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10">
          <div className="absolute right-6 top-6 z-20"><ThemeToggle /></div>
          {children}
        </div>
      </div>
    </div>
  );
}

function LoginBrand({ subtitle, note, children }: { subtitle: string; note?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 text-center">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.7, delay: 0.1 }} className="mx-auto">
        <BrandLogo className="mx-auto h-20 w-20 drop-shadow-[0_0_40px_rgba(51,85,181,0.6)]" />
      </motion.div>
      <h1 className="mt-5 font-display text-2xl font-bold text-white">Command Centre</h1>
      <p className="mt-1.5 text-sm text-slate-400">
        {subtitle} · <span className="font-mono text-xs">app.phantixlabs.com</span>
      </p>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
      {children}
    </div>
  );
}

// ── Returning sign-in: email + password + OTP (no invite link) ────────────────
function ReturningLogin({
  enterDemo, navigate, toast,
}: {
  enterDemo: () => void;
  navigate: (path: string) => void;
  toast: (kind: "success" | "error" | "info" | "warning", title: string, body?: string) => void;
}) {
  const { completeAppLogin } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [stage, setStage] = useState<Stage>("email");
  const [mfaToken, setMfaToken] = useState("");
  const [code, setCode] = useState("");
  const [deviceToken, setDeviceToken] = useState("");
  const [maskedDest, setMaskedDest] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [deviceWait, setDeviceWait] = useState(false);

  const startLogin = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    setBlocked(null);
    try {
      const res = await api.post<{
        mfa_required?: boolean;
        mfa_token?: string;
        destination_masked?: string;
        message?: string;
      }>("/app/auth/login", { email: email.trim(), password }, { realm: "application" });
      setMfaToken(res.mfa_token ?? "");
      setMaskedDest(res.destination_masked ?? "");
      setStage("mfa");
      setCode("");
    } catch (err) {
      const sk = serviceKeyMessage(err);
      if (sk) { setBlocked(sk); setStage("service_key_blocked"); }
      else setError(err instanceof Error ? err.message : "Invalid email or password");
    } finally {
      setBusy(false);
    }
  };

  // Resend the one-time code: re-submit email+password to get a fresh OTP.
  const resendCode = async () => {
    if (busy) return;
    setError(null);
    await startLogin();
    setError("A new code was sent. Enter the latest code.");
  };

  type MfaResult = {
    access_token?: string;
    device_token?: string;
    device_verification_required?: boolean;
    user?: { full_name?: string; email?: string };
    user_email?: string;
    effective_role?: string;
    role?: string;
    can_operate?: boolean;
    is_initiator?: boolean;
    is_authorizer?: boolean;
    dual_control?: {
      session_token?: string;
      can_operate?: boolean;
      is_initiator?: boolean;
      is_authorizer?: boolean;
    };
    dual_control_session_token?: string;
  };

  const finishLogin = (res: MfaResult, rotated = false) => {
    tokens.appSession = res.access_token ?? "";
    tokens.device = res.device_token ?? "";
    const dcSessionToken = res.dual_control_session_token ?? res.dual_control?.session_token;
    if (dcSessionToken) tokens.dualControl = dcSessionToken;

    const name = res.user?.full_name ?? "";
    const emailAddr = res.user_email ?? res.user?.email ?? "";
    const isInit = res.is_initiator === true || res.dual_control?.is_initiator === true;
    const isAuth = res.is_authorizer === true || res.dual_control?.is_authorizer === true;
    completeAppLogin(emailAddr, name, isInit, isAuth);
    toast("success", rotated ? "Device confirmed" : "Signed in", rotated ? "Welcome" + (name ? " " + name : "") + " — this browser is now your primary device." : "Welcome" + (name ? " " + name : " back"));
    navigate("/dashboard");
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<MfaResult>("/app/auth/mfa", {
        mfa_token: mfaToken,
        code,
        device_id: deviceId(),
        replace_primary: false,
      }, { realm: "application" });

      if (res.device_verification_required && res.device_token) {
        // New browser → a confirmation link was emailed. Wait for the link, then poll.
        setDeviceToken(res.device_token);
        setStage("device");
        return;
      }
      finishLogin(res);
    } catch (err) {
      const sk = serviceKeyMessage(err);
      if (sk) { setBlocked(sk); setStage("service_key_blocked"); }
      else { setError(err instanceof Error ? err.message : "Verification failed"); setCode(""); }
    } finally {
      setBusy(false);
    }
  };

  // Poll /app/auth/device-status once the link is opened; completes when confirmed.
  const checkDeviceConfirmed = useCallback(async (): Promise<boolean> => {
    if (!deviceToken) return false;
    try {
      const res = await api.post<MfaResult & { confirmed?: boolean }>("/app/auth/device-status", {
        device_token: deviceToken,
        device_id: deviceId(),
      }, { realm: "application" });
      if (res && res.confirmed === false) return false;
      if (!res?.access_token) return false;
      finishLogin(res, true);
      return true;
    } catch {
      return false;
    }
  }, [deviceToken, finishLogin]);

  // While in the device stage: listen for the link tab + poll until confirmed.
  useEffect(() => {
    if (stage !== "device" || !deviceToken) return;
    setDeviceWait(true);
    let disposed = false;
    const stop = () => {
      if (disposed) return;
      disposed = true;
      setDeviceWait(false);
      clearInterval(timer);
      clearTimeout(timer);
    };
    const unsubscribe = listenDeviceConfirmed(() => {
      void checkDeviceConfirmed().then((ok) => { if (ok) stop(); });
    });
    const timer = setInterval(() => {
      void checkDeviceConfirmed().then((ok) => { if (ok) stop(); });
    }, 2500);
    const timeout = setTimeout(() => {
      if (!disposed) {
        clearInterval(timer);
        setError("The confirmation link may have expired. Restart sign-in to receive a fresh one.");
        setDeviceWait(false);
      }
    }, 15 * 60 * 1000);
    return () => {
      unsubscribe();
      clearInterval(timer);
      clearTimeout(timeout);
      disposed = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, deviceToken]);

  return (
    <LoginChrome>
      <motion.div initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }} className="w-full max-w-[420px]">
        <LoginBrand subtitle="Application sign-in" note="Returning user? Sign in with your email and password." />
        <div className="card p-7">
          {showInvite ? (
            <motion.div key="invite" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
              <p className="text-center text-xs text-slate-500">First time? Paste your invite link from the platform below, or sign in with your email.</p>
              <PasteLinkBox onCancel={() => setShowInvite(false)} />
            </motion.div>
          ) : (
          <AnimatePresence mode="wait">
            {blocked && stage === "service_key_blocked" && (
              <motion.div key="skb" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 14 }} className="space-y-4">
                <div className="rounded-xl border border-severity-medium/40 bg-severity-medium/10 p-4 text-center">
                  <AlertOctagon size={22} className="mx-auto text-severity-medium" />
                  <p className="mt-2 text-sm font-medium text-slate-200">Company access is not enabled</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{blocked}</p>
                </div>
                <a href={PLATFORM_URL} className="btn-primary w-full !py-3">Open Platform settings <ArrowRight size={15} /></a>
                <button type="button" onClick={() => { setBlocked(null); setStage("email"); }} className="w-full text-center text-xs text-slate-500 hover:text-slate-300">Try again</button>
              </motion.div>
            )}

            {!blocked && stage === "email" && (
              <motion.form key="email" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} onSubmit={(e) => { e.preventDefault(); void startLogin(); }} className="space-y-4">
                <div>
                  <label className="label">Work email</label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input type="email" className="input !pl-10" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoFocus autoComplete="email" />
                  </div>
                </div>
                <div>
                  <label className="label">Password</label>
                  <div className="relative">
                    <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input type="password" className="input !pl-10" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
                  </div>
                </div>
                {error && <p className="text-sm text-severity-critical">{error}</p>}
                <button className="btn-primary w-full !py-3" disabled={busy || !email.trim() || !password}>
                  {busy ? <><Loader2 size={14} className="mr-1.5 inline animate-spin" /> Signing in...</> : <>Continue <ArrowRight size={15} /></>}
                </button>
                <NewsletterField />
                <Link to="/password-reset" className="block text-center text-xs text-slate-500 hover:text-slate-300">Forgot password?</Link>
              </motion.form>
            )}

            {!blocked && stage === "mfa" && (
              <motion.div key="mfa" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 14 }} className="space-y-4">
                <div className="rounded-xl border border-phantix-600/40 bg-phantix-800/40 p-3.5 text-center">
                  <ShieldCheck size={22} className="mx-auto text-gold-400" />
                  <p className="mt-2 text-sm font-medium text-slate-200">Verify your identity</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {maskedDest ? "A code was sent to " + maskedDest : "Enter the verification code from your email"}
                  </p>
                </div>
                <OtpInput value={code} onChange={setCode} onEnter={() => code.length === 6 && void verify()} />
                {error && <p className="text-sm text-severity-critical">{error}</p>}
                <button className="btn-primary w-full !py-3" disabled={busy || code.length !== 6} onClick={() => void verify()}>
                  {busy ? <><Loader2 size={14} className="mr-1.5 inline animate-spin" /> Verifying...</> : <>Verify & sign in</>}
                </button>
                <button type="button" onClick={() => void resendCode()} disabled={busy} className="w-full text-center text-xs text-slate-500 hover:text-slate-300 disabled:opacity-50">Resend code</button>
                <button type="button" onClick={() => { setStage("email"); setError(null); }} disabled={busy} className="w-full text-center text-xs text-slate-500 hover:text-slate-300 disabled:opacity-50">Use a different account</button>
              </motion.div>
            )}

            {!blocked && stage === "device" && (
              <motion.div key="device" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 14 }} className="space-y-4">
                <div className="rounded-xl border border-severity-medium/40 bg-severity-medium/10 p-3.5 text-center">
                  <Smartphone size={22} className="mx-auto text-severity-medium" />
                  <p className="mt-2 text-sm font-medium text-slate-200">Confirm this new device</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    A confirmation link was sent to {maskedDest || "your organization address"}. Open it to make
                    this browser your primary device — no additional code needed.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                  {deviceWait ? <Loader2 size={14} className="animate-spin text-gold-400" /> : <Mail size={14} className="text-gold-400" />}
                  <span>{deviceWait ? "Waiting for you to open the link…" : "Check your inbox and click the link."}</span>
                </div>
                {error && <p className="text-sm text-severity-critical">{error}</p>}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => { setStage("email"); setError(null); }}
                  className="w-full text-center text-xs text-slate-500 hover:text-slate-300 disabled:opacity-50"
                >
                  Restart sign-in
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          )}
        </div>

        <div className="mt-5 space-y-2 text-center">
          <button onClick={() => { enterDemo(); navigate("/dashboard"); }} className="flex w-full items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-300">
            <PlayCircle size={13} /> Explore the demo tenant
          </button>
          <button onClick={() => { setShowInvite((v) => !v); setError(null); }} className="block w-full text-xs text-gold-400 hover:text-gold-300">
            {showInvite ? "Back to email sign-in" : "Use an invite link"}
          </button>
        </div>
      </motion.div>
    </LoginChrome>
  );
}

// ── Invite flow: challenge → set-password | password → MFA → dual tokens ──────
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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [deviceToken, setDeviceToken] = useState("");
  const [deviceWait, setDeviceWait] = useState(false);
  const [maskedDest, setMaskedDest] = useState("");
  const [mfaToken, setMfaToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challenged, setChallenged] = useState(false);
  const [nextStep, setNextStep] = useState<"set_password" | "password" | null>(null);
  const [orgName, setOrgName] = useState("");
  const [userName, setUserName] = useState("");
  const [blocked, setBlocked] = useState<string | null>(null);

  // Step 1: validate the invite link (APP_ACCESS_INVITE_AND_LOGIN_FE.md §6 Step A)
  useEffect(() => {
    if (demoMode || challenged) return;
    (async () => {
      setBusy(true);
      setError(null);
      try {
        const res = await api.post<ChallengeData & { user_email?: string; organization_name?: string; next_step?: string }>("/app/auth/challenge", {
          login_token: loginToken,
          organization_slug: org,
          organization_user_id: Number(userId),
        }, { realm: "application" });
        setChallenged(true);
        setOrgName(res.organization_name || "Your Organization");
        setUserName(res.user_full_name || res.user_email?.split("@")[0] || "");
        // Per §6: branch on next_step — set_password (first visit) vs password
        if (res.next_step === "set_password" || res.must_set_password === true) {
          setNextStep("set_password");
          setStage("set_password");
        } else {
          setNextStep("password");
          setStage("password");
        }
      } catch (err) {
        const sk = serviceKeyMessage(err);
        if (sk) { setBlocked(sk); setStage("service_key_blocked"); }
        else setError(err instanceof ApiError && err.status === 403
          ? "This login link requires an active service key. Contact your organization admin to create one on the platform."
          : err instanceof Error ? err.message : "Login link validation failed");
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Step B1 — first visit: set a new password (min 8)
  const handleSetPassword = async () => {
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{
        mfa_required?: boolean;
        mfa_token?: string;
        destination_masked?: string;
        password_set?: boolean;
      }>("/app/auth/set-password", {
        login_token: loginToken,
        password,
        organization_slug: org,
        organization_user_id: Number(userId),
      }, { realm: "application" });
      setMfaToken(res.mfa_token ?? "");
      setMaskedDest(res.destination_masked ?? "");
      setStage("mfa");
      setCode("");
    } catch (err) {
      const sk = serviceKeyMessage(err);
      if (sk) { setBlocked(sk); setStage("service_key_blocked"); }
      else setError(err instanceof Error ? err.message : "Could not save password");
    } finally {
      setBusy(false);
    }
  };

  // Step B2 — invite link + existing password
  const handlePassword = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{
        mfa_required?: boolean;
        mfa_token?: string;
        destination_masked?: string;
        message?: string;
      }>("/app/auth/password", {
        login_token: loginToken,
        password,
        organization_slug: org,
        organization_user_id: Number(userId),
      }, { realm: "application" });
      setMfaToken(res.mfa_token ?? "");
      setMaskedDest(res.destination_masked ?? maskedDest);
      setStage("mfa");
      setCode("");
    } catch (err) {
      const sk = serviceKeyMessage(err);
      if (sk) { setBlocked(sk); setStage("service_key_blocked"); }
      else setError(err instanceof Error ? err.message : "Password verification failed");
    } finally {
      setBusy(false);
    }
  };

  // Step C — MFA → dual tokens (+ dual-control session when eligible)
  const verifyMfa = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{
        access_token?: string;
        device_token?: string;
        device_verification_required?: boolean;
        user?: { full_name?: string; email?: string };
        user_email?: string;
        effective_role?: string;
        role?: string;
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
      }>("/app/auth/mfa", {
        mfa_token: mfaToken,
        code,
        device_id: deviceId(),
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

      // Per §6 Step D / §5.2: store dual-control session when issued
      const dcSessionToken = res.dual_control_session_token ?? res.dual_control?.session_token;
      if (dcSessionToken) tokens.dualControl = dcSessionToken;

      const email = res.user_email ?? res.user?.email ?? "";
      const name = res.user?.full_name ?? "";
      const isInit = res.is_initiator === true || res.dual_control?.is_initiator === true;
      const isAuth = res.is_authorizer === true || res.dual_control?.is_authorizer === true;
      completeAppLogin(email, name, isInit, isAuth);

      const canOperate = res.can_operate === true || res.dual_control?.can_operate === true;
      const dcInfo = canOperate && isInit && !isAuth ? " · operate as initiator" : canOperate && isAuth && !isInit ? " · operate as authorizer" : "";
      toast("success", "Signed in", "Welcome" + (name ? " " + name : " back") + dcInfo);
      navigate("/dashboard");
    } catch (err) {
      const sk = serviceKeyMessage(err);
      if (sk) { setBlocked(sk); setStage("service_key_blocked"); }
      else { setError(err instanceof Error ? err.message : "Verification failed"); setCode(""); }
    } finally {
      setBusy(false);
    }
  };

  // Poll /app/auth/device-status once the link is opened; completes when confirmed.
  const checkDeviceConfirmed = useCallback(async (): Promise<boolean> => {
    if (!deviceToken) return false;
    try {
      const res = await api.post<{ access_token?: string; device_token?: string; confirmed?: boolean; user?: { full_name?: string; email?: string }; user_email?: string; dual_control?: { session_token?: string; can_operate?: boolean; is_initiator?: boolean; is_authorizer?: boolean }; dual_control_session_token?: string }>("/app/auth/device-status", {
        device_token: deviceToken,
        device_id: deviceId(),
      }, { realm: "application" });
      if (!res || res.confirmed === false || !res.access_token) return false;

      tokens.appSession = res.access_token ?? "";
      tokens.device = res.device_token ?? "";
      const dcSessionToken = res.dual_control_session_token ?? res.dual_control?.session_token;
      if (dcSessionToken) tokens.dualControl = dcSessionToken;

      const email = res.user_email ?? res.user?.email ?? "";
      const name = res.user?.full_name ?? "";
      const isInit = res.dual_control?.is_initiator === true;
      const isAuth = res.dual_control?.is_authorizer === true;
      completeAppLogin(email, name, isInit, isAuth);
      toast("success", "Device confirmed", "Welcome" + (name ? " " + name : " back"));
      navigate("/dashboard");
      return true;
    } catch {
      return false;
    }
  }, [deviceToken, completeAppLogin, toast, navigate]);

  // While in the device stage: listen for the link tab + poll until confirmed.
  useEffect(() => {
    if (stage !== "device" || !deviceToken) return;
    setDeviceWait(true);
    let disposed = false;
    const stop = () => {
      if (disposed) return;
      disposed = true;
      setDeviceWait(false);
      clearInterval(timer);
      clearTimeout(timer);
    };
    const unsubscribe = listenDeviceConfirmed(() => {
      void checkDeviceConfirmed().then((ok) => { if (ok) stop(); });
    });
    const timer = setInterval(() => {
      void checkDeviceConfirmed().then((ok) => { if (ok) stop(); });
    }, 2500);
    const timeout = setTimeout(() => {
      if (!disposed) {
        clearInterval(timer);
        setError("The confirmation link may have expired. Restart sign-in to receive a fresh one.");
        setDeviceWait(false);
      }
    }, 15 * 60 * 1000);
    return () => {
      unsubscribe();
      clearInterval(timer);
      clearTimeout(timeout);
      disposed = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, deviceToken]);

  // Resend the OTP for the invite flow (POST /app/auth/otp).
  const resendInviteOtp = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ destination_masked?: string }>("/app/auth/otp", {
        login_token: loginToken,
        organization_slug: org,
        organization_user_id: Number(userId),
      }, { realm: "application" });
      setMaskedDest(res.destination_masked ?? maskedDest);
      setCode("");
      setError("A new code was sent. Enter the latest code.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend code");
    } finally {
      setBusy(false);
    }
  };

  // Demo mode: skip authentication
  if (demoMode) {
    return (
      <LoginChrome>
        <motion.div initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[420px] text-center">
          <LoginBrand subtitle="Application sign-in" note="Demo mode --- explore features instantly" />
          <button
            onClick={() => { enterDemo(); navigate("/dashboard"); }}
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-gold-400 px-6 py-3 font-semibold text-phantix-950 hover:bg-gold-300"
          >
            <PlayCircle size={16} /> Explore the demo tenant
          </button>
        </motion.div>
      </LoginChrome>
    );
  }

  // Loading / challenge state
  if (!challenged && !blocked) {
    return (
      <LoginChrome>
        <motion.div initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[420px] text-center">
          <LoginBrand subtitle="Application sign-in" />
          <p className="text-sm text-slate-400">Validating login link...</p>
          {error && (
            <div className="mx-auto mt-4 max-w-md rounded-xl border border-severity-critical/30 bg-severity-critical/10 px-4 py-3 text-sm text-severity-critical">{error}</div>
          )}
        </motion.div>
      </LoginChrome>
    );
  }

  return (
    <LoginChrome>
      <motion.div initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }} className="w-full max-w-[420px]">
        <LoginBrand subtitle="Application sign-in" note={nextStep === "set_password" ? "First sign-in: set a password for your account." : "Invite link verified."}>
          {(orgName || userName) && (
            <div className="mt-2 flex items-center justify-center gap-3 text-xs text-slate-500">
              {orgName && <span className="flex items-center gap-1"><Building2 size={11} /> {orgName}</span>}
              {userName && <span className="flex items-center gap-1"><User size={11} /> {userName}</span>}
            </div>
          )}
        </LoginBrand>

        <div className="card p-7">
          <AnimatePresence mode="wait">
            {/* Service key blocked */}
            {blocked && stage === "service_key_blocked" && (
              <motion.div key="skb" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 14 }} className="space-y-4">
                <div className="rounded-xl border border-severity-medium/40 bg-severity-medium/10 p-4 text-center">
                  <AlertOctagon size={22} className="mx-auto text-severity-medium" />
                  <p className="mt-2 text-sm font-medium text-slate-200">Company access is not enabled</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{blocked}</p>
                </div>
                <a href={PLATFORM_URL} className="btn-primary w-full !py-3">Open Platform settings <ArrowRight size={15} /></a>
              </motion.div>
            )}

            {/* First visit: set password */}
            {!blocked && nextStep === "set_password" && stage === "set_password" && (
              <motion.form key="sp" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} onSubmit={(e) => { e.preventDefault(); void handleSetPassword(); }} className="space-y-4">
                <div>
                  <label className="label">New password</label>
                  <div className="relative">
                    <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input type="password" className="input !pl-10" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" autoFocus autoComplete="new-password" />
                  </div>
                </div>
                <div>
                  <label className="label">Confirm password</label>
                  <div className="relative">
                    <Check size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input type="password" className="input !pl-10" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat password" autoComplete="new-password" />
                  </div>
                </div>
                {error && <p className="text-sm text-severity-critical">{error}</p>}
                <button className="btn-primary w-full !py-3" disabled={busy || !password || !confirmPassword}>
                  {busy ? <><Loader2 size={14} className="mr-1.5 inline animate-spin" /> Saving...</> : <>Set password & continue <ArrowRight size={15} /></>}
                </button>
              </motion.form>
            )}

            {/* Invite + existing password */}
            {!blocked && nextStep === "password" && stage === "password" && (
              <motion.form key="pw" initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }} onSubmit={(e) => { e.preventDefault(); void handlePassword(); }} className="space-y-4">
                <div>
                  <label className="label">Your password</label>
                  <div className="relative">
                    <KeyRound size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input type="password" className="input !pl-10" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoFocus />
                  </div>
                </div>
                {error && <p className="text-sm text-severity-critical">{error}</p>}
                <button className="btn-primary w-full !py-3" disabled={busy || !password}>
                  {busy ? <><Loader2 size={14} className="mr-1.5 inline animate-spin" /> Checking...</> : <>Continue <ArrowRight size={15} /></>}
                </button>
              </motion.form>
            )}

            {/* MFA */}
            {(stage === "mfa" || stage === "device") && (
              <motion.div key="mfa" initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 14 }} className="space-y-4">
                {stage === "device" ? (
                  <>
                    <div className="rounded-xl border border-severity-medium/40 bg-severity-medium/10 p-3.5 text-center">
                      <Smartphone size={22} className="mx-auto text-severity-medium" />
                      <p className="mt-2 text-sm font-medium text-slate-200">Confirm this new device</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        A confirmation link was sent to {maskedDest || "your organization address"}. Open it to make
                        this browser your primary device — no additional code needed.
                      </p>
                      {(orgName || userName) && (
                        <p className="mt-2 flex flex-wrap items-center justify-center gap-2 text-[10px] text-slate-600">
                          {orgName && <span className="flex items-center gap-1"><Building2 size={10} /> {orgName}</span>}
                          {userName && <span className="flex items-center gap-1"><User size={10} /> {userName}</span>}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                      {deviceWait ? <Loader2 size={14} className="animate-spin text-gold-400" /> : <Mail size={14} className="text-gold-400" />}
                      <span>{deviceWait ? "Waiting for you to open the link…" : "Check your inbox and click the link."}</span>
                    </div>
                    {error && <p className="text-sm text-severity-critical">{error}</p>}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => { setStage("email"); setError(null); }}
                      className="w-full text-center text-xs text-slate-500 hover:text-slate-300 disabled:opacity-50"
                    >
                      Restart sign-in
                    </button>
                  </>
                ) : (
                  <>
                    <div className="rounded-xl border border-phantix-600/40 bg-phantix-800/40 p-3.5 text-center">
                      <ShieldCheck size={22} className="mx-auto text-gold-400" />
                      <p className="mt-2 text-sm font-medium text-slate-200">Verify your identity</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {maskedDest ? "A code was sent to " + maskedDest : "Enter the verification code from your email"}
                      </p>
                      {(orgName || userName) && (
                        <p className="mt-2 flex flex-wrap items-center justify-center gap-2 text-[10px] text-slate-600">
                          {orgName && <span className="flex items-center gap-1"><Building2 size={10} /> {orgName}</span>}
                          {userName && <span className="flex items-center gap-1"><User size={10} /> {userName}</span>}
                        </p>
                      )}
                    </div>
                    <OtpInput value={code} onChange={setCode} onEnter={() => code.length === 6 && void verifyMfa()} />
                    {error && <p className="text-sm text-severity-critical">{error}</p>}
                    <button className="btn-primary w-full !py-3" disabled={busy || code.length !== 6} onClick={() => void verifyMfa()}>
                      {busy ? <><Loader2 size={14} className="mr-1.5 inline animate-spin" /> Verifying...</> : "Verify & sign in"}
                    </button>
                    <button type="button" onClick={() => void resendInviteOtp()} disabled={busy} className="w-full text-center text-xs text-slate-500 hover:text-slate-300 disabled:opacity-50">
                      Resend code
                    </button>
                    <p className="text-center text-[11px] text-slate-600">
                      No code? Check your inbox or spam.
                    </p>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="mt-5 text-center text-xs text-slate-500">
          Signing in via <a href={PLATFORM_URL} className="text-gold-400 hover:text-gold-300">organization login link</a>
        </p>
      </motion.div>
    </LoginChrome>
  );
}

// ── Shared inputs ──────────────────────────────────────────────────────────────
function NewsletterField() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subscribe = () => {
    const v = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setSubscribed(true);
  };

  return (
    <div className="border-t border-phantix-700/40 pt-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        Security insights in your inbox
      </p>
      {subscribed ? (
        <p className="mt-2 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-400">
          You're on the list. Watch your inbox for a welcome note.
        </p>
      ) : (
        <>
          <div className="mt-2 flex gap-2">
            <div className="relative flex-1">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                className="input !pl-9 !py-2 text-xs"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    subscribe();
                  }
                }}
                placeholder="you@company.com"
                aria-label="Newsletter email"
              />
            </div>
            <button type="button" onClick={subscribe} className="btn-secondary !px-3 !py-2">
              <Send size={14} />
            </button>
          </div>
          {error && <p className="mt-1.5 text-xs text-severity-critical">{error}</p>}
        </>
      )}
    </div>
  );
}

function OtpInput({ value, onChange, onEnter }: { value: string; onChange: (v: string) => void; onEnter: () => void }) {
  return (
    <input
      className="input text-center font-mono !text-xl !tracking-[0.5em]"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
      placeholder="••••••"
      autoFocus
      inputMode="numeric"
      autoComplete="one-time-code"
      onKeyDown={(e) => e.key === "Enter" && value.length === 6 && onEnter()}
    />
  );
}

// ── Paste invite link box (admin convenience; returning users can also use this) ─
const MAX_LINK_LENGTH = 250;

function PasteLinkBox({ onCancel }: { onCancel?: () => void }) {
  const navigate = useNavigate();
  const [link, setLink] = useState("");
  const [error, setError] = useState("");

  const validateAndGo = () => {
    setError("");
    const trimmed = link.trim();
    if (!trimmed) { setError("Paste your login link from the platform"); return; }
    if (trimmed.length > MAX_LINK_LENGTH) { setError(`Link is too long --- max ${MAX_LINK_LENGTH} characters`); return; }
    try {
      const url = new URL(trimmed);
      if (!url.hostname.includes("phantix") && !url.hostname.includes("localhost")) {
        setError("This doesn't look like a Phantix login link. Expected domain: app.phantixlabs.com");
        return;
      }
      if (!url.pathname.startsWith("/login")) {
        setError("This URL doesn't point to the login page. Expected path: /login");
        return;
      }
      const params = url.searchParams;
      const org = params.get("org");
      const u = params.get("u");
      const t = params.get("t");
      if (!org) { setError("Missing organization slug (org=...)"); return; }
      if (!u) { setError("Missing user ID (u=...)"); return; }
      if (!t) { setError("Missing login token (t=...)"); return; }
      if (t.length < 10) { setError("Login token appears too short or invalid"); return; }
      navigate(`/login?org=${encodeURIComponent(org)}&u=${encodeURIComponent(u)}&t=${encodeURIComponent(t)}`, { replace: true });
    } catch {
      setError("Invalid URL format. Paste the full login link from the platform (should start with https://).");
    }
  };

  return (
    <div className="space-y-2.5 text-left">
      <p className="flex items-center justify-center gap-1 text-center text-xs text-slate-500">
        <Link2 size={12} /> Paste your login link below
      </p>
      <textarea
        className="input resize-none font-mono text-xs"
        rows={2}
        maxLength={MAX_LINK_LENGTH}
        placeholder="https://app.phantixlabs.com/login?org=acme&u=42&t=..."
        value={link}
        onChange={(e) => { setLink(e.target.value); setError(""); }}
        onPaste={() => {
          setTimeout(() => {
            const pasted = link.trim();
            if (pasted && pasted.includes("?org=") && pasted.includes("&u=") && pasted.includes("&t=")) {
              validateAndGo();
            }
          }, 100);
        }}
      />
      <div className="flex items-center justify-between text-[10px]">
        <span className={cx(link.length > MAX_LINK_LENGTH * 0.9 ? "text-severity-medium" : "text-slate-600", link.length > 10 && "visible")}>
          {link.length > 10 ? `${link.length}/${MAX_LINK_LENGTH}` : ""}
        </span>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-slate-500 hover:text-slate-300">Back to email sign-in</button>
        )}
      </div>
      {error && <p className="text-xs text-severity-critical">{error}</p>}
      <button onClick={validateAndGo} disabled={!link.trim()} className="btn-secondary w-full text-sm">
        Continue with link <ArrowRight size={14} />
      </button>
    </div>
  );
}
