import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Radar, ShieldCheck, X, XCircle } from "lucide-react";
import { useNotifications } from "./AlertNotifications";
import { useStore } from "../store";
import { useSseStream } from "../useSse";
import { isDemoMode } from "../api";
import {
  decideAgiAction,
  loadAgiNotifications,
  loadAgiPendingApprovals,
  type AgiNotification,
  type AgiPendingApproval,
} from "../agi";

// The Pentest Agent runs in the background. Two things must reach the operator
// wherever they are in the app:
//   1. the durable inbox (session complete / new finding / approval gate), fed
//      into the existing notification bell by polling + the org realtime stream;
//   2. a global approval popup when the agent is paused on a state-changing
//      step and the console is closed.
const NOTIF_POLL_MS = 20_000;
const APPROVAL_POLL_MS = 15_000;

type BellSeverity = "critical" | "high" | "medium" | "low" | "info";

const SEV_TO_BELL: Record<string, BellSeverity> = {
  critical: "critical",
  high: "high",
  medium: "medium",
  low: "low",
  info: "info",
  warning: "medium",
  success: "info",
};

function AgiNotificationsInner() {
  const { push } = useNotifications();
  const { toast, withOperate } = useStore();
  const [pending, setPending] = useState<AgiPendingApproval[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  // Dismiss ("review later") is keyed to the current set of held steps, so a new
  // approval always re-raises the popup.
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const seenRef = useRef<Set<number>>(new Set());
  const initializedRef = useRef(false);

  const approvalKey = useMemo(
    () =>
      pending
        .map((p) => p.action_id)
        .sort((a, b) => a - b)
        .join(","),
    [pending],
  );

  useEffect(() => {
    setDismissedKey(null);
  }, [approvalKey]);

  useEffect(() => {
    const onOpen = () => setConsoleOpen(true);
    const onClose = () => setConsoleOpen(false);
    window.addEventListener("phantix:agi-open", onOpen);
    window.addEventListener("phantix:agi-close", onClose);
    return () => {
      window.removeEventListener("phantix:agi-open", onOpen);
      window.removeEventListener("phantix:agi-close", onClose);
    };
  }, []);

  const ingest = useCallback(
    (rows: AgiNotification[]) => {
      for (const n of rows) {
        if (!n.id || seenRef.current.has(n.id)) continue;
        seenRef.current.add(n.id);
        push({
          id: n.id,
          severity: SEV_TO_BELL[n.severity] ?? "info",
          title: n.title,
          eventType: n.kind,
          createdAt: n.created_at,
        });
        if (n.kind === "agi_finding") {
          // The console's findings pane listens for this and re-reads instantly
          // instead of waiting for its 12–15s poll.
          window.dispatchEvent(
            new CustomEvent("phantix:agi-finding", {
              detail: { sessionId: n.session_id, notification: n },
            }),
          );
        }
        if (!initializedRef.current) continue;
        if (n.kind === "agi_finding") {
          toast("info", "New Pentest Agent finding", n.title);
        } else if (n.kind === "agi_session_completed" || n.kind === "agi_loop_stopped") {
          toast("success", "Pentest Agent session completed", n.body || n.title);
        } else if (n.kind === "agi_approval_required") {
          toast("warning", "Approval needed", n.title);
        }
      }
    },
    [push, toast],
  );

  const refreshNotifications = useCallback(async () => {
    const rows = await loadAgiNotifications({ limit: 30 });
    ingest(rows);
    initializedRef.current = true;
  }, [ingest]);

  const refreshApprovals = useCallback(async () => {
    try {
      setPending(await loadAgiPendingApprovals());
    } catch {
      /* transient — keep the last known queue */
    }
  }, []);

  useEffect(() => {
    void refreshNotifications();
    void refreshApprovals();
    const notifTimer = window.setInterval(() => void refreshNotifications(), NOTIF_POLL_MS);
    const approvalTimer = window.setInterval(() => void refreshApprovals(), APPROVAL_POLL_MS);
    const onFocus = () => {
      void refreshNotifications();
      void refreshApprovals();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") onFocus();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(notifTimer);
      window.clearInterval(approvalTimer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refreshNotifications, refreshApprovals]);

  // Realtime nudge: the poll is the safety net, the stream is the immediacy.
  useSseStream("/org/command-center/stream", {
    enabled: !isDemoMode(),
    onEvent: (evt) => {
      if (
        evt.event === "notificationCreated" ||
        evt.event === "agiApprovalRequired" ||
        evt.event === "agiSessionCompleted"
      ) {
        void refreshNotifications();
        void refreshApprovals();
      } else if (evt.event === "agiFindingRecorded") {
        const data = evt.data as { payload?: { sessionId?: number } } | null;
        window.dispatchEvent(
          new CustomEvent("phantix:agi-finding", {
            detail: { sessionId: data?.payload?.sessionId },
          }),
        );
        void refreshNotifications();
      }
    },
  });

  const decide = useCallback(
    async (item: AgiPendingApproval, approve: boolean) => {
      setBusy(item.action_id);
      try {
        const res = await withOperate(
          approve
            ? "Approving a Pentest Agent step requires a dual-control operate session."
            : "Rejecting a Pentest Agent step requires a dual-control operate session.",
          () => decideAgiAction(item.action_id, approve, ""),
        );
        if (res) {
          toast(
            approve ? "success" : "info",
            approve ? "Step approved" : "Step rejected",
            item.proposed_command.slice(0, 160),
          );
        }
      } catch (e) {
        toast("error", "Could not record the decision", e instanceof Error ? e.message : "");
      } finally {
        setBusy(null);
        await refreshApprovals();
      }
    },
    [withOperate, toast, refreshApprovals],
  );

  const openConsole = useCallback((fullscreen: boolean) => {
    setConsoleOpen(true);
    window.dispatchEvent(new CustomEvent("phantix:agi-open", { detail: { fullscreen } }));
  }, []);

  const primary = pending[0];
  const showPopup =
    pending.length > 0 && !consoleOpen && dismissedKey !== approvalKey && Boolean(primary);

  return (
    <AnimatePresence>
      {showPopup && primary && (
        <motion.div
          key="agi-approval-popup"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-phantix-950/80 p-4 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.94, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-severity-medium/40 bg-phantix-900 shadow-card"
          >
            <div className="flex items-start gap-3 border-b border-phantix-700/40 bg-severity-medium/10 px-4 py-3.5">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-severity-medium/20 text-severity-medium">
                <ShieldCheck size={18} className="animate-pulse" />
              </span>
              <div className="min-w-0">
                <p className="text-[12px] font-semibold uppercase tracking-wider text-amber-200">
                  Approval needed
                </p>
                <p className="text-sm font-medium text-white">
                  The Pentest Agent is paused
                  {pending.length > 1 ? ` · ${pending.length} steps waiting` : ""}
                </p>
              </div>
              <button
                onClick={() => setDismissedKey(approvalKey)}
                className="ml-auto rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-phantix-800 hover:text-white"
                aria-label="Review later"
                title="Review later"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 px-4 py-4">
              {primary.engagement_name && (
                <p className="text-xs text-slate-500">Engagement · {primary.engagement_name}</p>
              )}
              <p className="break-words rounded-lg bg-phantix-950/70 px-3 py-2 font-mono text-xs leading-relaxed text-slate-200">
                {primary.proposed_command}
              </p>
              {primary.rationale && (
                <p className="text-xs leading-relaxed text-slate-400">{primary.rationale}</p>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  disabled={busy !== null}
                  onClick={() => void decide(primary, true)}
                  className="btn-primary flex-1 !py-2 text-sm disabled:opacity-50"
                >
                  <CheckCircle2 size={14} className="mr-1 inline" /> Approve
                </button>
                <button
                  disabled={busy !== null}
                  onClick={() => void decide(primary, false)}
                  className="btn-ghost flex-1 !py-2 text-sm text-severity-critical hover:text-severity-critical disabled:opacity-50"
                >
                  <XCircle size={14} className="mr-1 inline" /> Reject
                </button>
              </div>

              <button
                onClick={() => openConsole(false)}
                className="w-full rounded-lg border border-phantix-700/40 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-gold-400/40 hover:text-gold-300"
              >
                <Radar size={12} className="mr-1 inline" /> Open the Pentest Agent console
                <ArrowRight size={11} className="ml-1 inline" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Mounted once by the shell. Only the Attack application owns the Pentest Agent,
 * so other applications render nothing.
 */
export default function AgiNotifications({ application }: { application: string }) {
  if (application !== "attack") return null;
  return <AgiNotificationsInner />;
}
