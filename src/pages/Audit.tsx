import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ScrollText, Download, Filter, X } from "lucide-react";
import { PageHeader, Card, Spinner } from "@/components/ui";
import { loadAuditBundle } from "@/lib/data";
import { useResource } from "@/lib/useResource";
import { timeAgo, titleCase, cx } from "@/lib/utils";
import { useStore } from "@/lib/store";
import type { AuditEvent } from "@/lib/types";

const ENGINE_MAP: Record<string, { label: string; color: string }> = {
  assets: { label: "Asset Engine", color: "text-blue-400" },
  scans: { label: "Scanner Engine", color: "text-cyan-400" },
  vapt: { label: "VAPT Engine", color: "text-purple-400" },
  risks: { label: "Risk Engine", color: "text-red-400" },
  reports: { label: "Reporting Engine", color: "text-emerald-400" },
  compliance: { label: "Compliance Engine", color: "text-amber-400" },
  alerts: { label: "Alert Engine", color: "text-orange-400" },
  audit: { label: "Audit Engine", color: "text-gray-400" },
  "db-connections": { label: "DB Connections", color: "text-teal-400" },
  "org-users": { label: "Org Users", color: "text-indigo-400" },
  organizations: { label: "Organization", color: "text-pink-400" },
  auth: { label: "Auth", color: "text-yellow-400" },
  ai: { label: "AI Engine", color: "text-fuchsia-400" },
  support: { label: "Support", color: "text-lime-400" },
  engines: { label: "Engines", color: "text-slate-300" },
};

function parseEngine(path: string): string {
  if (!path) return "unknown";
  const parts = path.replace("/api/v1/", "").split("/");
  return parts[0] || "unknown";
}

function engineMeta(engine: string) {
  return ENGINE_MAP[engine] ?? { label: titleCase(engine.replace(/-/g, " ")), color: "text-slate-400" };
}

const METHOD_COLORS: Record<string, string> = {
  GET: "border-blue-400/40 bg-blue-400/10 text-blue-300",
  POST: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  PATCH: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  PUT: "border-purple-400/40 bg-purple-400/10 text-purple-300",
  DELETE: "border-red-400/40 bg-red-400/10 text-red-300",
};

export default function Audit() {
  const { toast } = useStore();
  const { data, loading } = useResource(loadAuditBundle, { events: [] });
  const auditEvents = data.events as AuditEvent[];
  const [engineFilter, setEngineFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const engines = useMemo(() => {
    const set = new Set<string>();
    auditEvents.forEach((e) => {
      const path = e.details?.path ?? e.action_label ?? "";
      set.add(parseEngine(path));
    });
    return Array.from(set).sort();
  }, [auditEvents]);

  const filtered = useMemo(() => {
    return auditEvents.filter((e) => {
      const path = e.details?.path ?? e.action_label ?? "";
      const engine = parseEngine(path);
      if (engineFilter !== "all" && engine !== engineFilter) return false;
      if (actionFilter !== "all") {
        if (actionFilter === "mutations" && e.details?.passive !== false) return false;
        if (actionFilter === "access" && e.details?.passive !== true) return false;
      }
      return true;
    });
  }, [auditEvents, engineFilter, actionFilter]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-slate-400">
        <Spinner className="h-5 w-5" /> Loading audit trail...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Audit trail"
        description="Immutable dual-control trail --- every action carries initiator and authorizer snapshots, IP, and token type. Grouped by engine for compliance export."
        actions={
          <button className="btn-secondary" onClick={() => toast("info", "Export", "GET /audit/export?format=csv")}>
            <Download size={15} /> Export CSV
          </button>
        }
      />

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Filter size={14} className="text-slate-500" />
            <select
              className="rounded-lg border border-phantix-700/50 bg-phantix-950/70 px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-gold-400/50"
              value={engineFilter}
              onChange={(e) => setEngineFilter(e.target.value)}
            >
              <option value="all">All engines ({auditEvents.length})</option>
              {engines.map((eng) => (
                <option key={eng} value={eng}>{engineMeta(eng).label}</option>
              ))}
            </select>
            <select
              className="rounded-lg border border-phantix-700/50 bg-phantix-950/70 px-2.5 py-1.5 text-xs text-slate-300 outline-none focus:border-gold-400/50"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="all">All actions</option>
              <option value="access">GETs / reads</option>
              <option value="mutations">POST / PATCH / DELETE</option>
            </select>
            {(engineFilter !== "all" || actionFilter !== "all") && (
              <button onClick={() => { setEngineFilter("all"); setActionFilter("all"); }} className="flex items-center gap-1 rounded-lg border border-phantix-700/50 bg-phantix-950/70 px-2 py-1 text-xs text-slate-400 hover:text-slate-200">
                <X size={12} /> Clear
              </button>
            )}
            <span className="ml-auto text-[11px] text-slate-600">{filtered.length} events</span>
          </div>

          <Card className="!p-0 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-phantix-700/40">
                  <th className="th w-10" />
                  <th className="th">Path</th>
                  <th className="th">Method</th>
                  <th className="th">Engine</th>
                  <th className="th">Initiator</th>
                  <th className="th">Authorizer</th>
                  <th className="th">IP</th>
                  <th className="th">Time</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => {
                  const path = e.details?.path ?? e.action_label ?? "";
                  const method = e.details?.method ?? "GET";
                  const engine = parseEngine(path);
                  const em = engineMeta(engine);
                  return (
                    <motion.tr
                      key={e.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="border-b border-phantix-800/40 hover:bg-phantix-800/35 group"
                    >
                      <td className="td text-center">
                        <span className={cx(
                          "inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold",
                          e.details?.passive !== false ? "bg-blue-400/15 text-blue-400" : "bg-emerald-400/15 text-emerald-400"
                        )}>
                          {e.details?.passive !== false ? "R" : "W"}
                        </span>
                      </td>
                      <td className="td max-w-[240px]">
                        <p className="truncate font-mono text-[11px] text-slate-300">{path}</p>
                        <p className="text-[10px] text-slate-500">{e.summary}</p>
                      </td>
                      <td className="td">
                        <span className={cx("rounded-md border px-1.5 py-0.5 font-mono text-[9px] font-bold", METHOD_COLORS[method] ?? "border-slate-500/50 bg-slate-800/50 text-slate-400")}>
                          {method}
                        </span>
                      </td>
                      <td className="td">
                        <span className={cx("text-[11px] font-medium", em.color)}>{em.label}</span>
                        {e.details?.token_type && <p className="text-[9px] text-slate-600">{e.details.token_type}</p>}
                      </td>
                      <td className="td">
                        <div className="flex items-center gap-1.5">
                          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-phantix-700/60 text-[9px] font-bold text-phantix-200">
                            {(e.initiator_name ?? "?").slice(0, 1)}
                          </span>
                          <div>
                            <p className="text-[11px] text-slate-300">{e.initiator_name ?? "---"}</p>
                            <p className="text-[9px] text-slate-600">{e.initiator_title ?? ""}</p>
                          </div>
                        </div>
                      </td>
                      <td className="td">
                        {e.authorizer_name ? (
                          <div className="flex items-center gap-1.5">
                            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gold-400/20 text-[9px] font-bold text-gold-300">
                              {e.authorizer_name.slice(0, 1)}
                            </span>
                            <div>
                              <p className="text-[11px] text-slate-300">{e.authorizer_name}</p>
                              <p className="text-[9px] text-slate-600">{e.authorizer_title ?? ""}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-600">---</span>
                        )}
                      </td>
                      <td className="td font-mono text-[10px] text-slate-500">{e.ip_address ?? "---"}</td>
                      <td className="td text-[11px] text-slate-500 whitespace-nowrap">{timeAgo(e.created_at)}</td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
      </motion.div>
    </div>
  );
}
