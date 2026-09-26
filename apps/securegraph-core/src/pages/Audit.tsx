import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ScrollText, Download, Filter, X, Loader2 } from "lucide-react";
import { PageHeader, Card, PageSkeleton, ErrorState } from "@sg/ui";
import { loadAuditBundle } from "@sg/data";
import { useResource } from "@sg/useResource";
import { describeEndpoint } from "@sg/auditExplain";
import { timeAgo, titleCase, cx } from "@sg/utils";
import { useStore } from "@sg/store";
import { api } from "@sg/api";
import type { AuditEvent } from "@sg/types";
import DocLink from "@sg/components/DocLink";
import { Pagination, usePaged } from "@sg/components/Pagination";

// The trail reads by application, the way the operator uses the product —
// engines are how the backend is built and mean nothing to the reader. The
// backend labels each event (shared and control-plane activity is unlabelled).
const APPLICATION_META: Record<string, { label: string; color: string }> = {
  core: { label: "Core", color: "text-gold-300" },
  attack: { label: "Attack", color: "text-severity-critical" },
  defend: { label: "Defend", color: "text-severity-low" },
  code: { label: "Code", color: "text-severity-info" },
};

function applicationMeta(key?: string | null) {
  if (!key) return { label: "Platform", color: "text-slate-400" };
  return APPLICATION_META[key] ?? { label: titleCase(key), color: "text-slate-400" };
}

export default function Audit() {
  const { toast } = useStore();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await api.download("/audit/export?format=csv");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `phantix-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("success", "Export ready", "Audit CSV downloaded");
    } catch (err) {
      toast("error", "Export failed", err instanceof Error ? err.message : "Could not download the audit trail");
    } finally {
      setExporting(false);
    }
  };
  const { data, loading, error, reload } = useResource(loadAuditBundle, { events: [] }, "audit");
  const auditEvents = data.events as AuditEvent[];
  const [appFilter, setAppFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const applications = useMemo(() => {
    const set = new Set<string>();
    auditEvents.forEach((e) => set.add(e.application ?? "platform"));
    return Array.from(set).sort();
  }, [auditEvents]);

  const filtered = useMemo(() => {
    return auditEvents.filter((e) => {
      if (appFilter !== "all" && (e.application ?? "platform") !== appFilter) return false;
      if (actionFilter !== "all") {
        if (actionFilter === "mutations" && e.details?.passive !== false) return false;
        if (actionFilter === "access" && e.details?.passive !== true) return false;
      }
      return true;
    });
  }, [auditEvents, appFilter, actionFilter]);
  const { pageItems, pagination } = usePaged(filtered, "core-audit", [appFilter, actionFilter]);

  if (loading) {
    return <PageSkeleton variant="table" rows={8} cols={5} actions />;
  }

  if (error && data.events.length === 0) {
    return (
      <ErrorState
        onRetry={reload}
        body="We could not load the audit trail. Check your connection and retry — your session stays signed in."
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Audit trail"
        description="Review every action taken in the organization, by application and by user."
        actions={<>
            <DocLink docId="howto-app-27" label="Audit how-to" />
          <button className="btn-secondary" onClick={() => void handleExport()} disabled={exporting}>
            {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Export CSV
          </button>
        </>}
      />

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Filter size={14} className="text-slate-500" />
            <select
              className="input !w-auto !py-1.5 text-xs"
              value={appFilter}
              onChange={(e) => setAppFilter(e.target.value)}
            >
              <option value="all">All applications ({auditEvents.length})</option>
              {applications.map((key) => (
                <option key={key} value={key}>{applicationMeta(key === "platform" ? null : key).label}</option>
              ))}
            </select>
            <select
              className="input !w-auto !py-1.5 text-xs"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="all">All activity</option>
              <option value="access">Viewed</option>
              <option value="mutations">Changed</option>
            </select>
            {(appFilter !== "all" || actionFilter !== "all") && (
              <button onClick={() => { setAppFilter("all"); setActionFilter("all"); }} className="flex items-center gap-1 rounded-lg border border-phantix-700/50 bg-phantix-950/70 px-2 py-1 text-xs text-slate-400 hover:text-slate-200">
                <X size={12} /> Clear
              </button>
            )}
            <span className="ml-auto text-[13px] text-slate-600">{filtered.length} events</span>
          </div>

          <Card className="!p-0 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-phantix-700/40">
                  <th className="th w-10" />
                  <th className="th">Action</th>
                  <th className="th">Application</th>
                  <th className="th">Initiator</th>
                  <th className="th">Authorizer</th>
                  <th className="th">IP</th>
                  <th className="th">Time</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((e, i) => {
                  // The description is written for the person reading it; the
                  // route and method that produced it stay in the staff trail.
                  const desc = describeEndpoint(
                    e.details?.method ?? "GET",
                    e.details?.path ?? e.action_label ?? "",
                  );
                  const am = applicationMeta(e.application);
                  return (
                    <motion.tr
                      key={e.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i, 12) * 0.02 }}
                      className="h-10 border-b border-phantix-800/40 hover:bg-phantix-800/35 group"
                    >
                      <td className="td text-center">
                        <span className={cx(
                          "inline-flex h-5 w-5 items-center justify-center rounded-full text-[12px] font-bold",
                          e.details?.passive !== false ? "bg-blue-400/15 text-blue-400" : "bg-emerald-400/15 text-emerald-400"
                        )}>
                          {e.details?.passive !== false ? "V" : "C"}
                        </span>
                      </td>
                      <td className="td max-w-[30rem]">
                        <span className="block truncate" title={(desc?.detail ?? e.summary) || undefined}>
                          <span className="font-medium text-slate-100">{(desc?.label ?? e.action_label) || "Activity"}</span>
                          <span className="ml-2 text-[13px] text-slate-500">{(desc?.detail ?? e.summary) || "An action was performed on the platform."}</span>
                        </span>
                      </td>
                      <td className="td">
                        <span className={cx("text-[13px] font-medium", am.color)}>{am.label}</span>
                      </td>
                      <td className="td">
                        <div className="flex items-center gap-1.5">
                          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-phantix-700/60 text-[12px] font-bold text-phantix-200">
                            {(e.initiator_name ?? "?").slice(0, 1)}
                          </span>
                          <span className="whitespace-nowrap text-[13px] text-slate-300">
                            {e.initiator_name ?? "—"}
                            {e.initiator_title && <span className="ml-1.5 text-slate-500">{e.initiator_title}</span>}
                          </span>
                        </div>
                      </td>
                      <td className="td">
                        {e.authorizer_name ? (
                          <div className="flex items-center gap-1.5">
                            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gold-400/20 text-[12px] font-bold text-gold-300">
                              {e.authorizer_name.slice(0, 1)}
                            </span>
                            <span className="whitespace-nowrap text-[13px] text-slate-300">
                              {e.authorizer_name}
                              {e.authorizer_title && <span className="ml-1.5 text-slate-500">{e.authorizer_title}</span>}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[13px] text-slate-600">—</span>
                        )}
                      </td>
                      <td className="td font-mono text-[12px] text-slate-500">{e.ip_address ?? "—"}</td>
                      <td className="td text-[13px] text-slate-500 whitespace-nowrap">{timeAgo(e.created_at)}</td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination {...pagination} itemLabel="events" keyboard />
          </Card>
      </motion.div>
    </div>
  );
}
