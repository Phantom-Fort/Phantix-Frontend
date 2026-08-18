import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FlaskConical, X } from "lucide-react";
import { loadSandboxMe, type SandboxMe } from "@/lib/sandbox";
import { PLATFORM_URL } from "@/lib/links";
import { cx } from "@/lib/utils";

/** Persistent BETA chip when org is enrolled in launch sandbox. */
export default function SandboxBanner() {
  const [me, setMe] = useState<SandboxMe | null>(null);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem("sandbox_banner_dismissed") === "1");

  useEffect(() => {
    let cancelled = false;
    void loadSandboxMe().then((m) => {
      if (!cancelled) setMe(m);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!me?.enrolled || dismissed) return null;

  const unread = me.unreadUpdates ?? 0;
  const latest = me.latestUpdate;
  const breaking = String(latest?.severity ?? "").toLowerCase() === "breaking";

  return (
    <div
      className={cx(
        "mb-4 flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3",
        breaking
          ? "border-severity-critical/40 bg-severity-critical/10"
          : "border-amber-400/30 bg-amber-400/8",
      )}
    >
      <FlaskConical size={16} className={breaking ? "text-severity-critical" : "text-amber-300"} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-slate-100">
          BETA sandbox{me.program?.name ? ` · ${me.program.name}` : ""}
          {unread > 0 && (
            <span className="ml-2 chip border-gold-400/40 bg-gold-400/15 text-[10px] text-gold-300">
              {unread} update{unread === 1 ? "" : "s"}
            </span>
          )}
        </p>
        {latest && (
          <p className="mt-0.5 truncate text-[11px] text-slate-400">
            {breaking ? "Breaking: " : ""}
            {latest.title}
            {(latest.version_label || latest.versionLabel) && (
              <span className="font-mono text-slate-500"> · {latest.version_label ?? latest.versionLabel}</span>
            )}
          </p>
        )}
      </div>
      <Link to="/sandbox" className="btn-secondary !py-1.5 !text-xs">
        App sandbox
      </Link>
      <a href={`${PLATFORM_URL}/sandbox`} className="btn-ghost !py-1.5 !text-xs text-gold-300" target="_blank" rel="noreferrer">
        Platform sandbox
      </a>
      <button
        type="button"
        aria-label="Dismiss"
        className="rounded-lg p-1.5 text-slate-500 hover:bg-phantix-800/60 hover:text-slate-300"
        onClick={() => {
          sessionStorage.setItem("sandbox_banner_dismissed", "1");
          setDismissed(true);
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
