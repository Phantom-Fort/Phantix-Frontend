import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X, ChevronRight, CheckCircle2, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useOperations, type OperationStatus } from "@/lib/operations";
import { cx } from "@/lib/utils";

const STATUS_STYLE: Record<OperationStatus, { dot: string; border: string; text: string }> = {
  running: { dot: "bg-orange-400", border: "border-orange-400/50", text: "text-orange-300" },
  success: { dot: "bg-emerald-400", border: "border-emerald-400/50", text: "text-emerald-300" },
  error: { dot: "bg-severity-critical", border: "border-severity-critical/50", text: "text-red-300" },
};

function StatusIcon({ status }: { status: OperationStatus }) {
  if (status === "running") {
    return <Loader2 size={14} className="animate-spin text-orange-400" />;
  }
  return status === "success" ? (
    <CheckCircle2 size={14} className="text-emerald-400" />
  ) : (
    <XCircle size={14} className="text-severity-critical" />
  );
}

/**
 * Bottom-right "running operations" tray (Coolify-style). Shows a compact card
 * with a spinner + label while work is in progress; click opens a dropdown that
 * redirects to the page where each pending action is running.
 *
 * Terminal states (success/failure) auto-dismiss after 30s via the operations store.
 */
export default function OperationsWidget() {
  const { operations, remove } = useOperations();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const running = useMemo(() => operations.filter((o) => o.status === "running").length, [operations]);

  const summaryStatus: OperationStatus | null = useMemo(() => {
    if (running > 0) return "running";
    if (operations.some((o) => o.status === "error")) return "error";
    if (operations.length > 0) return "success";
    return null;
  }, [operations, running]);

  if (operations.length === 0 || summaryStatus === null) return null;

  const label =
    operations.length === 1
      ? `1 ${operations[0].label}`
      : `${operations.length} operations in progress`;
  const style = STATUS_STYLE[summaryStatus];

  return (
    <div className="fixed bottom-6 left-[264px] z-[72] flex flex-col items-start">
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[70]"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="absolute bottom-full z-[80] mb-2 w-80 overflow-hidden rounded-2xl border border-phantix-700/40 bg-phantix-900/95 shadow-card backdrop-blur-xl"
            >
              <div className="flex items-center justify-between border-b border-phantix-700/40 px-4 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Operations</p>
                <button onClick={() => setOpen(false)} className="rounded p-1 text-slate-500 hover:text-slate-200" aria-label="Close">
                  <X size={14} />
                </button>
              </div>
              <div className="max-h-72 divide-y divide-phantix-700/40 overflow-y-auto">
                {operations.map((op) => {
                  const s = STATUS_STYLE[op.status];
                  return (
                    <div
                      key={op.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setOpen(false);
                        navigate(op.route);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          setOpen(false);
                          navigate(op.route);
                        }
                      }}
                      className="group flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-phantix-800/50"
                    >
                      <StatusIcon status={op.status} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-100">{op.label}</span>
                        {op.detail && <span className="block truncate text-[11px] text-slate-500">{op.detail}</span>}
                      </span>
                      <span className={cx("h-2 w-2 shrink-0 rounded-full", s.dot)} />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(op.id);
                        }}
                        className="rounded p-1 text-slate-600 opacity-0 transition-opacity hover:text-slate-200 group-hover:opacity-100"
                        aria-label={`Dismiss ${op.label}`}
                      >
                        <X size={14} />
                      </button>
                      <ChevronRight size={14} className="shrink-0 text-slate-600" />
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen((v) => !v)}
        className={cx(
          "flex items-center gap-2.5 rounded-2xl border bg-phantix-900/95 py-2.5 pl-3 pr-4 shadow-card backdrop-blur-xl transition-transform hover:scale-[1.02]",
          style.border,
        )}
        title="Open operations"
        aria-label="Open operations"
      >
        {summaryStatus === "running" ? (
          <Loader2 size={16} className="animate-spin text-orange-400" />
        ) : summaryStatus === "success" ? (
          <CheckCircle2 size={16} className="text-emerald-400" />
        ) : (
          <XCircle size={16} className="text-severity-critical" />
        )}
        <span className={cx("max-w-[220px] truncate text-sm font-medium", style.text)}>{label}</span>
        <span className="rounded-md bg-phantix-800/70 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
          {operations.length}
        </span>
      </button>
    </div>
  );
}
