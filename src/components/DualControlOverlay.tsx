import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldCheck, Mail, KeyRound, Smartphone, Loader2, X, Lock } from "lucide-react";
import { useStore } from "@/lib/store";

function maskEmail(email: string): string {
  return email.replace(/(.{2}).+(@.+)/, "$1***$2");
}

/**
 * Full-screen dual-control unlock overlay.
 * Opens via requireDualControl() whenever a mutation needs an operate session.
 * Flow: email → OTP (purpose=dual_control) → optional new-device confirm.
 */
export default function DualControlOverlay() {
  const {
    dualControlPrompt,
    closeDualControlPrompt,
    requestDualControlOtp,
    verifyDualControlOtp,
    confirmDualControlDevice,
    dualControl,
    toast,
  } = useStore();

  const { session } = useStore();

  const open = dualControlPrompt.open;
  const reason = dualControlPrompt.reason;
  const initiator = dualControl.initiator;
  const authorizer = dualControl.authorizer;

  const [stage, setStage] = useState<"email" | "otp" | "device">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [deviceCode, setDeviceCode] = useState("");
  const [masked, setMasked] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStage("email");
    // Per 03_APPLICATION_IMPLEMENTATION.md §5.2: use app session email, never ask to re-enter
    setEmail(session?.userEmail ?? "");
    setCode("");
    setDeviceCode("");
    setMasked("");
    setError(null);
    setDevOtp(null);
    setBusy(false);
  }, [open, session?.userEmail]);

  const cancel = () => closeDualControlPrompt(false);

  const sendCode = async () => {
    setError(null);
    if (!email.includes("@")) {
      setError("Enter a valid work email");
      return;
    }
    setBusy(true);
    try {
      const res = await requestDualControlOtp(email.trim());
      setMasked(res.destinationMasked || maskEmail(email));
      setDevOtp(res.devOtp || null);
      setStage("otp");
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    setError(null);
    if (code.length !== 6) {
      setError("Enter the 6-digit code");
      return;
    }
    setBusy(true);
    try {
      const res = await verifyDualControlOtp(code);
      if (res.deviceRequired) {
        setStage("device");
        setDeviceCode("");
        return;
      }
      toast("success", "Operate mode unlocked", "Dual-control session active — mutations enabled for ~3 minutes of idle time.");
      closeDualControlPrompt(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const verifyDevice = async () => {
    setError(null);
    if (deviceCode.length !== 6) {
      setError("Enter the device confirmation code");
      return;
    }
    setBusy(true);
    try {
      await confirmDualControlDevice(deviceCode);
      toast("success", "Operate mode unlocked", "Device confirmed — dual-control session is active.");
      closeDualControlPrompt(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Device confirmation failed");
      setDeviceCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[95] flex items-center justify-center bg-phantix-950/90 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dc-overlay-title"
        >
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-phantix-600/50 bg-phantix-900/95 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-0 bg-grid-faint bg-grid opacity-40" />
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gold-400/10 blur-3xl" />

            <div className="relative border-b border-phantix-700/50 px-6 py-5">
              <button
                type="button"
                onClick={cancel}
                className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-500 hover:bg-phantix-800/80 hover:text-slate-200"
                aria-label="Cancel"
              >
                <X size={16} />
              </button>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-400/15 text-gold-400">
                  <Lock size={20} />
                </span>
                <div>
                  <p id="dc-overlay-title" className="font-display text-lg font-bold text-white">
                    Dual-control required
                  </p>
                  <p className="text-xs text-slate-400">Operate session · purpose=dual_control</p>
                </div>
              </div>
              {reason && (
                <p className="mt-3 rounded-xl border border-phantix-700/50 bg-phantix-950/60 px-3.5 py-2.5 text-xs leading-5 text-slate-300">
                  {reason}
                </p>
              )}
            </div>

            <div className="relative space-y-4 px-6 py-5">
              {(initiator || authorizer) && (
                <div className="rounded-xl border border-phantix-700/40 bg-phantix-950/50 px-3.5 py-3 text-[11px] leading-5 text-slate-400">
                  <p className="mb-1 font-semibold uppercase tracking-wider text-slate-500">Assigned controllers</p>
                  {initiator && (
                    <p>
                      Initiator: <span className="text-slate-200">{initiator.full_name}</span>
                      {initiator.title ? ` · ${initiator.title}` : ""}
                    </p>
                  )}
                  {authorizer && (
                    <p>
                      Authorizer: <span className="text-slate-200">{authorizer.full_name}</span>
                      {authorizer.title ? ` · ${authorizer.title}` : ""}
                    </p>
                  )}
                </div>
              )}

              {stage === "email" && (
                <>
                  <div>
                    <label className="label">Signing in as</label>
                    <div className="relative">
                      <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        className="input !pl-10 !opacity-70"
                        value={email || session?.userEmail || "…"}
                        readOnly
                        autoFocus
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">Your email from the login link — no re-entry needed.</p>
                  </div>
                  {error && <p className="text-sm text-severity-critical">{error}</p>}
                  <button type="button" className="btn-primary w-full !py-3" disabled={busy} onClick={() => void sendCode()}>
                    {busy ? (
                      <>
                        <Loader2 size={15} className="animate-spin" /> Sending code…
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={15} /> Email me a one-time code
                      </>
                    )}
                  </button>
                </>
              )}

              {stage === "otp" && (
                <>
                  <div className="rounded-xl border border-phantix-600/40 bg-phantix-800/40 p-3.5 text-center">
                    <KeyRound size={20} className="mx-auto text-gold-400" />
                    <p className="mt-2 text-sm font-medium text-slate-200">Enter the email code</p>
                    <p className="mt-1 text-xs text-slate-500">Sent to {masked || maskEmail(email)}</p>
                  </div>
                  {devOtp && (
                    <div className="rounded-xl border border-gold-400/30 bg-gold-400/8 p-3 text-center">
                      <p className="text-[10px] uppercase tracking-wider text-gold-400/80">Dev OTP</p>
                      <p className="mt-1 font-mono text-xl font-bold tracking-[0.35em] text-gold-300">{devOtp}</p>
                    </div>
                  )}
                  <input
                    className="input text-center font-mono !text-2xl !tracking-[0.5em]"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="••••••"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && code.length === 6 && void verifyOtp()}
                  />
                  {error && <p className="text-sm text-severity-critical">{error}</p>}
                  <button type="button" className="btn-primary w-full !py-3" disabled={busy || code.length !== 6} onClick={() => void verifyOtp()}>
                    {busy ? (
                      <>
                        <Loader2 size={15} className="animate-spin" /> Unlocking…
                      </>
                    ) : (
                      "Unlock operate session"
                    )}
                  </button>
                  <button type="button" className="w-full text-center text-xs text-slate-500 hover:text-slate-300" disabled={busy} onClick={() => void sendCode()}>
                    Resend code
                  </button>
                  <button type="button" className="w-full text-center text-xs text-slate-500 hover:text-slate-300" disabled={busy} onClick={() => setStage("email")}>
                    Use a different email
                  </button>
                </>
              )}

              {stage === "device" && (
                <>
                  <div className="rounded-xl border border-severity-medium/40 bg-severity-medium/10 p-3.5 text-center">
                    <Smartphone size={20} className="mx-auto text-severity-medium" />
                    <p className="mt-2 text-sm font-medium text-slate-200">Confirm this browser</p>
                    <p className="mt-1 text-xs text-slate-500">A second code was emailed to verify the new device.</p>
                  </div>
                  <input
                    className="input text-center font-mono !text-2xl !tracking-[0.5em]"
                    value={deviceCode}
                    onChange={(e) => setDeviceCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="••••••"
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && deviceCode.length === 6 && void verifyDevice()}
                  />
                  {error && <p className="text-sm text-severity-critical">{error}</p>}
                  <button type="button" className="btn-primary w-full !py-3" disabled={busy || deviceCode.length !== 6} onClick={() => void verifyDevice()}>
                    {busy ? (
                      <>
                        <Loader2 size={15} className="animate-spin" /> Confirming…
                      </>
                    ) : (
                      "Confirm device & unlock"
                    )}
                  </button>
                </>
              )}

              <button type="button" onClick={cancel} className="btn-ghost w-full !py-2.5 text-slate-400" disabled={busy}>
                Cancel action
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
