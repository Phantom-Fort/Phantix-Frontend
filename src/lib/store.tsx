import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from "lucide-react";
import { tokens, isDemoMode, isDemoFlagSet, enterDemoMode, exitDemoMode, API_BASE, delay, api, deviceId } from "./api";
import { organization, dualControl, orgUsers } from "./demo-data";
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
  expiresAt: number | null; // epoch ms
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
  logout: () => void;
  unlockOperate: (email: string, code: string) => Promise<void>;
  lockOperate: () => void;
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
      : tokens.platform
        ? { authenticated: true, realm: "platform", userEmail: "ada@acme.ng", userName: "Ada Okonkwo" }
        : null,
  );
  const [demoTick, setDemoTick] = useState(0);
  const [operate, setOperate] = useState<OperateState>({
    unlocked: !!tokens.dualControl,
    actingUser: tokens.dualControl ? "Ada Okonkwo" : null,
    actingRole: tokens.dualControl ? "initiator" : null,
    expiresAt: tokens.dualControl ? Date.now() + 3 * 60_000 : null,
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const toast = useCallback((kind: ToastKind, title: string, body?: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, kind, title, body }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5200);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

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
    const res = await api.post<{ access_token: string }>("/organizations/login/mfa", {
      mfa_token: sessionStorage.getItem("mfa_token"),
      code,
    });
    tokens.platform = res.access_token;
    setSession({ authenticated: true, realm: "platform", userEmail: "", userName: "" });
  }, []);

  const logout = useCallback(() => {
    tokens.platform = null;
    tokens.orgUser = null;
    tokens.dualControl = null;
    exitDemoMode();
    setSession(null);
    setOperate({ unlocked: false, actingUser: null, actingRole: null, expiresAt: null });
    setDemoTick((t) => t + 1);
  }, []);

  const enterDemo = useCallback(() => {
    enterDemoMode();
    setSession({ authenticated: true, realm: "platform", userEmail: "demo@acme.ng", userName: "Demo Explorer" });
    setDemoTick((t) => t + 1);
  }, []);

  const switchToRealOrg = useCallback(() => {
    // Leave the demo tenant: clear the flag + any demo tokens so the next
    // sign-in runs against the live API with a real organization.
    exitDemoMode();
    tokens.platform = null;
    tokens.orgUser = null;
    tokens.dualControl = null;
    setSession(null);
    setOperate({ unlocked: false, actingUser: null, actingRole: null, expiresAt: null });
    setDemoTick((t) => t + 1);
  }, []);

  const unlockOperate = useCallback(async (email: string, code: string) => {
    // Mirrors POST /org-users/auth/login (purpose=dual_control) → /login/mfa
    if (isDemoMode()) {
      await delay(800);
      const user = orgUsers.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (!user) throw new Error("No organization user with that email");
      if (code.length !== 6) throw new Error("Enter the 6-digit code");
      tokens.orgUser = "demo.org_user.jwt";
      tokens.dualControl = `dc_${crypto.randomUUID()}`;
      setOperate({
        unlocked: true,
        actingUser: user.full_name,
        actingRole: user.is_initiator ? "initiator" : user.is_authorizer ? "authorizer" : "initiator",
        expiresAt: Date.now() + 3 * 60_000,
      });
      return;
    }
    const start = await api.post<{ mfa_token: string }>("/org-users/auth/login", {
      email,
      purpose: "dual_control",
      device_id: deviceId(),
    });
    const res = await api.post<{ access_token: string; session_token: string; user: { full_name?: string; email: string } }>(
      "/org-users/auth/login/mfa",
      { mfa_token: start.mfa_token, code, device_id: deviceId() },
    );
    tokens.orgUser = res.access_token;
    tokens.dualControl = res.session_token;
    setOperate({
      unlocked: true,
      actingUser: res.user.full_name ?? res.user.email,
      actingRole: "initiator",
      expiresAt: Date.now() + 3 * 60_000,
    });
  }, []);

  const lockOperate = useCallback(() => {
    tokens.dualControl = null;
    setOperate({ unlocked: false, actingUser: null, actingRole: null, expiresAt: null });
  }, []);

  const value = useMemo<Store>(
    () => ({
      session,
      org: organization,
      dualControl,
      operate,
      securityDbReady: true,
      demoActive: isDemoMode(),
      hasLiveApi: !!API_BASE,
      enterDemo,
      switchToRealOrg,
      login,
      verifyMfa,
      logout,
      unlockOperate,
      lockOperate,
      toasts,
      toast,
      dismissToast,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, operate, toasts, toast, dismissToast, login, verifyMfa, logout, unlockOperate, lockOperate, enterDemo, switchToRealOrg, demoTick],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used within StoreProvider");
  return s;
}

// ── Toast viewport ────────────────────────────────────────────────────────────
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
