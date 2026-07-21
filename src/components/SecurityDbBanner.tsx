import React from "react";
import { Database, AlertTriangle, ExternalLink } from "lucide-react";
import { PLATFORM_CONNECTIONS_URL } from "@/lib/links";

/** Shown when product APIs return 409 because security storage is not bootstrapped. */
export default function SecurityDbBanner({ message }: { message?: string | null }) {
  return (
    <div className="mb-5 flex flex-wrap items-start gap-3 rounded-2xl border border-severity-medium/30 bg-severity-medium/8 px-4 py-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-severity-medium/15 text-severity-medium">
        <Database size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-100">
          <AlertTriangle size={14} className="text-severity-medium" />
          Security database not ready
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          {message ||
            "Connect and bootstrap the security_data_storage database in Platform settings. Assets, scans, and VAPT stay blocked until schema is ready."}
        </p>
      </div>
      <a href={PLATFORM_CONNECTIONS_URL} className="btn-primary !py-2 !text-xs">
        <ExternalLink size={12} /> Open Platform · Connections
      </a>
    </div>
  );
}
