import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from "lucide-react";
import { tokens, isDemoMode, isDemoFlagSet, enterDemoMode, exitDemoMode, API_BASE, delay, api, deviceId } from "./api";
import {
  emptyDualControl,
  emptyOrganization,
  loadDualControl,
  loadOrganization,
  loadOrgUsers,
} from "./data";
import * as demo from "./demo-data";
import type { DualControlState, Organization } from "./types";

export type Session = {
  authenticated: boolean;
  realm: "platform" | "application";
  userEmail: string;
  userName: string;
} | null;

type ToastKind = "success" | "error" | "info" | "warning";
type Toast = { id: number; kind: ToastKind; title: string; body?: string };

type OperateState = {
  unlocked: boolean;
  actingUser: string | null;
  actingRole: "initiator" | "authorizer" | null;
  expiresAt: number | null;
};

type Store = {
  session: Session;
  org: Organization;
  dualControl: DualControlState;
  operate: OperateState;
  securityDbReady: boolean;
  /** True while browsing the demo tenant (no API, or demo flag from the landing page). */
  demoActive: boolean;
  /** True when a live API is configured — enables the "switch to real org" UX. */
  hasLiveApi: boolean;
  /** Enter the demo tenant without credentials (from the landing page). */
  enterDemo: () => void;
  /** Leave the demo and sign in with a real organization. */
  switchToRealOrg: () => void;
  login: (email: string, password: string) => Promise<{ mfaRequired: boolean }>;
  verifyMfa: (code: string) => Promise<void>;
  completeAppLogin: (email: string, name: string) => void;
  logout: () => void;
  unlockOperate: (email: string, code: string) => Promise<void>;
  lockOperate: () => void;
  /** Open dual-control sign-in overlay; resolves true when operate session is active. */
  requireDualControl: (reason?: string) => Promise<boolean>;
  dualControlPrompt: { open: boolean; reason: string };
  closeDualControlPrompt: (success: boolean) => void;
  requestDualControlOtp: (email: string) => Promise<{ destinationMasked: string; devOtp: string }>;
  verifyDualControlOtp: (code: string) => Promise<{ deviceRequired: boolean }>;
  confirmDualControlDevice: (code: string) => Promise<void>;
  toasts: Toast[];
  toast: (kind: ToastKind, title: string, body?: string) => void;
  dismissToast: (id: number) => void;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const demoSession: Session = { authenticated: true, realm: "platform", userEmail: "demo@acme.ng", userName: "Demo Explorer" };
  const [session, setSession] = useState<Session>(() =>
    isDemoFlagSet()
      ? demoSession
      : tokens.appSession
        ? { authenticated: true, realm: "application", userEmail: "", userName: "" }
        : tokens.platform
          ? { authenticated: true, realm: "platform", userEmail: "", userName: "" }
          : null,
  );
  const [org, setOrg] = useState<Organization>(() => (isDemoMode() ? demo.organization : emptyOrganization));
  const [dualControl, setDualControl] = useState<DualControlState>(() =>
    isDemoMode() ? demo.dualControl : emptyDualControl,
  );
  const [securityDbReady, setSecurityDbReady] = useState(isDemoMode());
  const [demoTick, setDemoTick] = useState(0);

  // Sync session with token state (handles 401-induced token clearing)
  useEffect(() => {
    const onStorage = () => {
      if (!tokens.appSession && !tokens.platform && !isDemoFlagSet()) {
        setSession(null);
      }
    };
    window.addEventListener("storage", onStorage);
    // Also poll for direct token clearing (api.ts clears tokens synchronously)
    const interval = setInterval(() => {
      if (session?.authenticated && !tokens.appSession && !tokens.platform && !isDemoFlagSet()) {
        setSession(null);
      }
    }, 2000);
    return () => {
      window.removeEventListener("storage", onStorage);
      clearInterval(interval);
    };
  }, [session?.authenticated]);
  const [operate, setOperate] = useState<OperateState>({
    unlocked: !!tokens.dualControl,
    actingUser: tokens.dualControl ? (isDemoMode() ? "Ada Okonkwo" : null) : null,
    actingRole: tokens.dualControl ? "initiator" : null,
    expiresAt: tokens.dualControl ? Date.now() + 3 * 60_000 : null,
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const [dualControlPrompt, setDualControlPrompt] = useState<{ open: boolean; reason: string }>({
    open: false,
    reason: "",
  });
  const dcPromptResolve = useRef<((ok: boolean) => void) | null>(null);
  const dcEmail = useRef("");
  const dcMfaToken = useRef("");
  const dcDeviceToken = useRef("");

  const toast = useCallback((kind: ToastKind, title: string, body?: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, kind, title, body }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5200);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const applyOperateSession = useCallback(
    (res: {
      access_token?: string;
      session_token?: string;
      dual_control_session?: string;
      inactivity_expires_at?: string;
      user?: { full_name?: string; email?: string };
    }) => {
      if (res.access_token) tokens.orgUser = res.access_token;
      const sessionTok = res.session_token || res.dual_control_session;
      if (sessionTok) tokens.dualControl = sessionTok;
      const email = res.user?.email || dcEmail.current;
      const name = res.user?.full_name || email || "Operate user";
      const isAuthorizer =
        !!dualControl.authorizer &&
        (dualControl.authorizer.email.toLowerCase() === email.toLowerCase() ||
          dualControl.authorizer.full_name === name);
      const expiresAt = res.inactivity_expires_at
        ? Date.parse(res.inactivity_expires_at)
        : Date.now() + 3 * 60_000;
      setOperate({
        unlocked: !!tokens.dualControl,
        actingUser: name,
        actingRole: isAuthorizer ? "authorizer" : "initiator",
        expiresAt: Number.isFinite(expiresAt) ? expiresAt : Date.now() + 3 * 60_000,
      });
    },
    [dualControl.authorizer],
  );

  // Hydrate tenant chrome from demo-data OR live API — never mix.
  useEffect(() => {
    if (!session?.authenticated) {
      if (!isDemoMode()) {
        setOrg(emptyOrganization);
        setDualControl(emptyDualControl);
        setSecurityDbReady(false);
      }
      return;
    }

    let cancelled = false;
    (async () => {
      if (isDemoMode()) {
        setOrg(demo.organization);
        setDualControl(demo.dualControl);
        setSecurityDbReady(true);
        return;
      }
      try {
        const [me, users] = await Promise.all([loadOrganization(), loadOrgUsers()]);
        const dc = await loadDualControl(users);
        if (cancelled) return;
        setOrg(me);
        setDualControl(dc);
        // security DB readiness
        try {
          const conns = await api.get<unknown>("/db-connections");
          const list = Array.isArray(conns)
            ? conns
            : ((conns as { items?: unknown[] })?.items ?? []);
          const ready = (list as { bootstrap_status?: string; connection_purpose?: string; status?: string }[]).some(
            (c) => {
              const purpose = c.connection_purpose;
              const st = String(c.bootstrap_status ?? c.status ?? "").toLowerCase();
              const isStorage = !purpose || purpose === "security_data_storage";
              const isReady = ["ready", "bootstrapped", "complete", "completed", "ok"].includes(st);
              return isStorage && isReady;
            },
          );
          // Also try primary-security-storage endpoint
          let primaryReady = false;
          try {
            const primary = await api.get<Record<string, unknown>>("/db-connections/primary-security-storage");
            const st = String(primary?.bootstrap_status ?? primary?.status ?? "").toLowerCase();
            primaryReady =
              ["ready", "bootstrapped", "complete", "completed", "ok"].includes(st) ||
              primary?.ready === true ||
              primary?.bootstrapped === true;
          } catch { /* no primary */ }
          setSecurityDbReady(ready || primaryReady);
        } catch {
          setSecurityDbReady(false);
        }
        if (session.userEmail === "" && me.name) {
          setSession((s) => (s ? { ...s, userName: s.userName || me.name, userEmail: s.userEmail } : s));
        }
      } catch {
        if (!cancelled) {
          setOrg(emptyOrganization);
          setDualControl(emptyDualControl);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.authenticated, demoTick]);

  const login = useCallback(
    async (email: string, _password: string) => {
      if (isDemoMode()) {
        await delay(650);
        if (!email.includes("@")) throw new Error("Enter a valid company email");
        return { mfaRequired: true };
      }
      const res = await api.postForm<{ access_token?: string; mfa_required?: boolean; mfa_token?: string }>(
        "/organizations/login",
        { username: email, password: _password },
      );
      if (res.access_token) {
        tokens.platform = res.access_token;
        setSession({ authenticated: true, realm: "platform", userEmail: email, userName: email });
        return { mfaRequired: false };
      }
      sessionStorage.setItem("mfa_token", res.mfa_token ?? "");
      sessionStorage.setItem("pending_login_email", email);
      return { mfaRequired: true };
    },
    [],
  );

  const verifyMfa = useCallback(async (code: string) => {
    if (isDemoMode()) {
      await delay(700);
      if (code.length !== 6) throw new Error("Enter the 6-digit code");
      tokens.platform = "demo.company.jwt";
      setSession({ authenticated: true, realm: "platform", userEmail: "ada@acme.ng", userName: "Ada Okonkwo" });
      return;
    }
    const email = sessionStorage.getItem("pending_login_email") ?? "";
    const res = await api.post<{ access_token: string }>("/organizations/login/mfa", {
      mfa_token: sessionStorage.getItem("mfa_token"),
      code,
    });
    tokens.platform = res.access_token;
    sessionStorage.removeItem("pending_login_email");
    setSession({ authenticated: true, realm: "platform", userEmail: email, userName: email });
  }, []);

  const logout = useCallback(() => {
    tokens.platform = null;
    tokens.orgUser = null;
    tokens.dualControl = null;
    tokens.appSession = null;
    tokens.device = null;
    exitDemoMode();
    setSession(null);
    setOrg(emptyOrganization);
    setDualControl(emptyDualControl);
    setOperate({ unlocked: false, actingUser: null, actingRole: null, expiresAt: null });
    setDemoTick((t) => t + 1);
  }, []);

  const completeAppLogin = useCallback((email: string, name: string) => {
    setSession({ authenticated: true, realm: "application", userEmail: email, userName: name || email });
  }, []);

  const enterDemo = useCallback(() => {
    enterDemoMode();
    setOrg(demo.organization);
    setDualControl(demo.dualControl);
    setSecurityDbReady(true);
    setSession({ authenticated: true, realm: "platform", userEmail: "demo@acme.ng", userName: "Demo Explorer" });
    setDemoTick((t) => t + 1);
  }, []);

  const switchToRealOrg = useCallback(() => {
    exitDemoMode();
    tokens.platform = null;
    tokens.orgUser = null;
    tokens.dualControl = null;
    setSession(null);
    setOrg(emptyOrganization);
    setDualControl(emptyDualControl);
    setSecurityDbReady(false);
    setOperate({ unlocked: false, actingUser: null, actingRole: null, expiresAt: null });
    setDemoTick((t) => t + 1);
  }, []);

  const lockOperate = useCallback(() => {
    tokens.dualControl = null;
    setOperate({ unlocked: false, actingUser: null, actingRole: null, expiresAt: null });
  }, []);

  const closeDualControlPrompt = useCallback((success: boolean) => {
    setDualControlPrompt({ open: false, reason: "" });
    const resolve = dcPromptResolve.current;
    dcPromptResolve.current = null;
    resolve?.(success);
  }, []);

  const requireDualControl = useCallback(
    (reason = "This action requires an active dual-control operate session.") => {
      if (operate.unlocked && tokens.dualControl) {
        if (operate.expiresAt && operate.expiresAt <= Date.now()) {
          tokens.dualControl = null;
          setOperate({ unlocked: false, actingUser: null, actingRole: null, expiresAt: null });
        } else {
          return Promise.resolve(true);
        }
      }
      if (!dualControl.configured && !isDemoMode()) {
        toast("warning", "Set up dual control first", "Assign initiator + authorizer under People & Control.");
        return Promise.resolve(false);
      }
      return new Promise<boolean>((resolve) => {
        dcPromptResolve.current = resolve;
        setDualControlPrompt({ open: true, reason });
      });
    },
    [operate.unlocked, operate.expiresAt, dualControl.configured, toast],
  );

  // Auto-lock when the dual-control idle window expires.
  useEffect(() => {
    if (!operate.unlocked || !operate.expiresAt) return;
    const ms = operate.expiresAt - Date.now();
    if (ms <= 0) {
      tokens.dualControl = null;
      setOperate({ unlocked: false, actingUser: null, actingRole: null, expiresAt: null });
      return;
    }
    const t = window.setTimeout(() => {
      tokens.dualControl = null;
      setOperate({ unlocked: false, actingUser: null, actingRole: null, expiresAt: null });
      toast("warning", "Operate session expired", "Unlock dual-control again to continue mutations.");
    }, ms);
    return () => window.clearTimeout(t);
  }, [operate.unlocked, operate.expiresAt, toast]);

  const requestDualControlOtp = useCallback(
    async (email: string) => {
      dcEmail.current = email;
      if (isDemoMode()) {
        await delay(500);
        const user = demo.orgUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
        if (!user) throw new Error("No organization user with that email");
        if (demo.dualControl.configured) {
          const ok = user.is_initiator || user.is_authorizer || user.id === demo.dualControl.initiator?.id || user.id === demo.dualControl.authorizer?.id;
          if (!ok) throw new Error("Only the assigned initiator or authorizer can open operate sessions");
        }
        const devOtp = String(Math.floor(100000 + Math.random() * 900000));
        sessionStorage.setItem("dc_dev_otp", devOtp);
        dcMfaToken.current = "demo-dc-mfa";
        return { destinationMasked: email.replace(/(.{2}).+(@.+)/, "$1***$2"), devOtp };
      }
      const res = await api.post<{
        mfa_required?: boolean;
        mfa_token?: string;
        destination_masked?: string;
        dev_otp?: string;
        access_token?: string;
        session_token?: string;
        dual_control_session?: string;
        user?: { full_name?: string; email?: string };
        inactivity_expires_at?: string;
      }>("/org-users/auth/login", {
        email,
        purpose: "dual_control",
        device_id: deviceId(),
      });
      if (res.access_token || res.session_token || res.dual_control_session) {
        applyOperateSession(res);
        return { destinationMasked: res.destination_masked || email, devOtp: "" };
      }
      dcMfaToken.current = res.mfa_token || "";
      if (!dcMfaToken.current) throw new Error("No MFA challenge returned");
      return {
        destinationMasked: res.destination_masked || email.replace(/(.{2}).+(@.+)/, "$1***$2"),
        devOtp: res.dev_otp || "",
      };
    },
    [applyOperateSession],
  );

  const verifyDualControlOtp = useCallback(
    async (code: string) => {
      if (isDemoMode()) {
        await delay(600);
        const expected = sessionStorage.getItem("dc_dev_otp");
        if (expected && code !== expected) throw new Error("That code isn't right");
        const email = dcEmail.current;
        const user = demo.orgUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
        tokens.orgUser = "demo.org_user.jwt";
        tokens.dualControl = `dc_${crypto.randomUUID()}`;
        setOperate({
          unlocked: true,
          actingUser: user?.full_name || email || "Operate user",
          actingRole: user?.is_authorizer && !user?.is_initiator ? "authorizer" : "initiator",
          expiresAt: Date.now() + 3 * 60_000,
        });
        return { deviceRequired: false };
      }
      const res = await api.post<{
        access_token?: string;
        session_token?: string;
        dual_control_session?: string;
        device_verification_required?: boolean;
        device_token?: string;
        inactivity_expires_at?: string;
        user?: { full_name?: string; email?: string };
      }>("/org-users/auth/login/mfa", {
        mfa_token: dcMfaToken.current,
        code,
        device_id: deviceId(),
      });
      if (res.device_verification_required && res.device_token) {
        dcDeviceToken.current = res.device_token;
        return { deviceRequired: true };
      }
      applyOperateSession(res);
      if (!tokens.dualControl) throw new Error("Operate session was not issued");
      return { deviceRequired: false };
    },
    [applyOperateSession],
  );

  const confirmDualControlDevice = useCallback(
    async (code: string) => {
      if (isDemoMode()) {
        tokens.dualControl = `dc_${crypto.randomUUID()}`;
        tokens.orgUser = "demo.org_user.jwt";
        setOperate({
          unlocked: true,
          actingUser: dcEmail.current || "Operate user",
          actingRole: "initiator",
          expiresAt: Date.now() + 3 * 60_000,
        });
        return;
      }
      const res = await api.post<{
        access_token?: string;
        session_token?: string;
        dual_control_session?: string;
        inactivity_expires_at?: string;
        user?: { full_name?: string; email?: string };
      }>("/org-users/auth/login/device", {
        device_token: dcDeviceToken.current,
        code,
        device_id: deviceId(),
      });
      applyOperateSession(res);
      if (!tokens.dualControl) throw new Error("Operate session was not issued");
    },
    [applyOperateSession],
  );

  // Keep unlockOperate stable with latest OTP helpers
  const unlockOperateStable = useCallback(
    async (email: string, code: string) => {
      await requestDualControlOtp(email);
      const res = await verifyDualControlOtp(code);
      if (res.deviceRequired) throw new Error("Device verification required — complete the dual-control overlay");
    },
    [requestDualControlOtp, verifyDualControlOtp],
  );

  const value = useMemo<Store>(
    () => ({
      session,
      org,
      dualControl,
      operate,
      securityDbReady,
      demoActive: isDemoMode(),
      hasLiveApi: !!API_BASE,
      enterDemo,
      switchToRealOrg,
      login,
      verifyMfa,
      completeAppLogin,
      logout,
      unlockOperate: unlockOperateStable,
      lockOperate,
      requireDualControl,
      dualControlPrompt,
      closeDualControlPrompt,
      requestDualControlOtp,
      verifyDualControlOtp,
      confirmDualControlDevice,
      toasts,
      toast,
      dismissToast,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      session, org, dualControl, operate, securityDbReady, toasts, toast, dismissToast,
      login, verifyMfa, completeAppLogin, logout, unlockOperateStable, lockOperate, enterDemo, switchToRealOrg,
      requireDualControl, dualControlPrompt, closeDualControlPrompt,
      requestDualControlOtp, verifyDualControlOtp, confirmDualControlDevice, demoTick,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used within StoreProvider");
  return s;
}

const icons: Record<ToastKind, React.ReactNode> = {
  success: <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400" size={18} />,
  error: <XCircle className="h-4.5 w-4.5 text-severity-critical" size={18} />,
  warning: <AlertTriangle className="h-4.5 w-4.5 text-severity-medium" size={18} />,
  info: <Info className="h-4.5 w-4.5 text-severity-low" size={18} />,
};

export function ToastViewport() {
  const { toasts, dismissToast } = useStore();
  return (
    <div className="fixed bottom-5 right-5 z-[100] flex w-[360px] flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 40, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 30, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="glass-bright rounded-xl p-3.5 shadow-card flex items-start gap-3"
          >
            <span className="mt-0.5 shrink-0">{icons[t.kind]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-100">{t.title}</p>
              {t.body && <p className="mt-0.5 text-xs text-slate-400 leading-5">{t.body}</p>}
            </div>
            <button
              onClick={() => dismissToast(t.id)}
              className="shrink-0 rounded-md p-1 text-slate-500 hover:text-slate-200 hover:bg-phantix-700/50"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
