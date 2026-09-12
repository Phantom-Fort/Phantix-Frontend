import React, { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Bot, ChevronLeft, ChevronRight, KeyRound, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { PageHeader, Card, TableCardSkeleton, ErrorState, EmptyState } from "@/components/ui";
import { isDenied, loadAgentActivity, type AgentAction } from "@/lib/agentActivity";
import { cx, timeAgo, formatDateTime } from "@/lib/utils";

// ── Agent activity ───────────────────────────────────────────────────────────
// The agent acts as the signed-in user and inherits no authority. Every tool call
// — allowed or denied — is recorded with the run, domain, the operator's intent,
// whether it was authorized, and what came back. A denied row is a control
// holding, not an error.

const PAGE_SIZE = 50;

const DOMAIN_LABEL: Record<string, string> = {
  cross: "Chief",
  threat_model: "Threat modelling",
  soc: "SOC",
  grc: "GRC",
  vapt: "VAPT",
  ti: "Threat intel",
  asset: "Asset",
  code: "Code",
  verify: "Verification",
  consultant: "Consultant",
};

function domainLabel(domain?: string | null): string {
  if (!domain) return "—";
  return DOMAIN_LABEL[domain] ?? domain.replace(/_/g, " ");
}

export default function AgentActivity() {
  const [items, setItems] = useState<AgentAction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("all");
  const [domain, setDomain] = useState("all");
  const [tool, setTool] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await loadAgentActivity({
        status: status === "all" ? undefined : status,
        domain: domain === "all" ? undefined : domain,
        tool: tool.trim() || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setItems(Array.isArray(res.items) ? res.items : []);
      setTotal(Number(res.total ?? 0));
    } catch (e) {
      setItems([]);
      setTotal(0);
      setError(e instanceof Error ? e.message : "Could not load agent activity");
    } finally {
      setLoading(false);
    }
  }, [status, domain, tool, page]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const t = window.setInterval(() => setReloadKey((k) => k + 1), 30000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => {
    if (reloadKey !== 0) void load();
  }, [reloadKey, load]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const deniedCount = items.filter(isDenied).length;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Agent activity"
        description="What the agent did for your organization — run, domain, intent, authorization and outcome for every action."
        actions={
          <button onClick={() => void load()} className="btn-ghost text-xs !py-2" title="Refresh">
            <RefreshCw size={14} className={cx("inline", loading && "animate-spin")} />
          </button>
        }
      />

      <p className="mb-4 flex items-start gap-2.5 rounded-md border border-gold-400/25 bg-gold-400/[0.06] p-3 text-[11px] leading-5 text-gold-200">
        <KeyRound size={13} className="mt-0.5 shrink-0 text-gold-300" />
        <span>
          The agent acts as you and can do only what your role allows. Every action that changes something needs a{" "}
          <strong className="font-semibold">fresh, single-use authorization</strong> bound to one action on one run.
          A denied row means a control held, not that something broke.
        </span>
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(0); }}
          className="input w-40 !py-1.5 !text-xs"
        >
          <option value="all">All outcomes</option>
          <option value="completed">Completed</option>
          <option value="failed">Denied / failed</option>
        </select>
        <select
          value={domain}
          onChange={(e) => { setDomain(e.target.value); setPage(0); }}
          className="input w-44 !py-1.5 !text-xs"
        >
          <option value="all">All domains</option>
          {Object.keys(DOMAIN_LABEL).map((d) => (
            <option key={d} value={d}>{domainLabel(d)}</option>
          ))}
        </select>
        <input
          value={tool}
          onChange={(e) => { setTool(e.target.value); setPage(0); }}
          placeholder="Tool (e.g. threat_model.generate)"
          className="input w-64 !py-1.5 !text-xs"
        />
        <span className="ml-auto text-[11px] text-slate-500">
          {total.toLocaleString()} actions · {deniedCount} denied on this page
        </span>
      </div>

      {error ? (
        <ErrorState title="Agent activity unavailable" body={error} onRetry={() => void load()} />
      ) : loading && !items.length ? (
        <TableCardSkeleton rows={8} cols={6} title={false} />
      ) : !items.length ? (
        <Card>
          <EmptyState
            icon={<Activity size={22} />}
            title="No agent actions yet"
            body="Ask the agent to do something — a read or a change — and it appears here with its intent and outcome."
          />
        </Card>
      ) : (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-phantix-700/40">
                    <th className="th">When</th>
                    <th className="th">Domain</th>
                    <th className="th">Action</th>
                    <th className="th">Intent</th>
                    <th className="th">Asked by</th>
                    <th className="th">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => {
                    const denied = isDenied(row);
                    return (
                      <React.Fragment key={row.id}>
                        <tr
                          className="cursor-pointer border-b border-phantix-800/40 hover:bg-phantix-800/35"
                          onClick={() => setOpen(open === row.id ? null : row.id)}
                        >
                          <td className="td whitespace-nowrap text-[11px] text-slate-400" title={row.created_at ? formatDateTime(row.created_at) : ""}>
                            {timeAgo(row.created_at ?? null)}
                            {row.run_id && <p className="font-mono text-[9px] text-slate-600">run {String(row.run_id).slice(0, 8)}</p>}
                          </td>
                          <td className="td"><span className="chip border-phantix-700 text-slate-300">{domainLabel(row.domain)}</span></td>
                          <td className="td">
                            <p className="flex items-center gap-1.5 font-mono text-[11px] text-slate-200">
                              <Bot size={11} className="text-gold-400" />
                              {row.tool ?? "—"}
                            </p>
                          </td>
                          <td className="td max-w-[320px] text-[11px] leading-5 text-slate-400">
                            {row.intent || <span className="text-slate-600">—</span>}
                          </td>
                          <td className="td">
                            {row.actor_name || row.actor_email || row.actor_user_id ? (
                              <div>
                                <p className="text-[11px] text-slate-300">{row.actor_name || row.actor_email || `user #${row.actor_user_id}`}</p>
                                <p className="text-[9px] capitalize text-slate-600">{row.actor_role || "—"}</p>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-600">org-level</span>
                            )}
                          </td>
                          <td className="td">
                            <span
                              className={cx(
                                "chip",
                                denied
                                  ? "border-severity-medium/30 bg-severity-medium/10 text-severity-medium"
                                  : "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
                              )}
                              title={row.error || undefined}
                            >
                              {denied ? <XCircle size={10} className="mr-1 inline" /> : <ShieldCheck size={10} className="mr-1 inline" />}
                              {denied ? "denied" : "done"}
                            </span>
                          </td>
                        </tr>
                        {open === row.id && (
                          <tr className="border-b border-phantix-800/40 bg-phantix-900/40">
                            <td colSpan={6} className="px-4 py-3">
                              <div className="space-y-1.5">
                                {row.params && (
                                  <p className="text-[11px] text-slate-400">
                                    <span className="text-slate-600">params:</span>{" "}
                                    <span className="font-mono text-slate-300">{row.params}</span>
                                  </p>
                                )}
                                {row.error && (
                                  <p className="text-[11px] text-severity-medium">
                                    <span className="text-slate-600">reason:</span> {row.error}
                                  </p>
                                )}
                                {(row.context?.length ?? 0) > 0 && (
                                  <p className="break-all font-mono text-[10px] leading-4 text-slate-600">
                                    {(row.context ?? []).join(" · ")}
                                  </p>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Showing <span className="font-semibold text-slate-300">{total === 0 ? 0 : page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)}</span> of{" "}
              <span className="font-semibold text-slate-300">{total.toLocaleString()}</span> actions
            </p>
            <div className="flex items-center gap-2">
              <button className="btn-ghost !px-2.5 !py-1.5 !text-xs" disabled={page === 0 || loading} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                <ChevronLeft size={14} /> Prev
              </button>
              <span className="text-xs text-slate-400">Page {page + 1} / {pageCount}</span>
              <button className="btn-ghost !px-2.5 !py-1.5 !text-xs" disabled={page + 1 >= pageCount || loading} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <p className="mt-5 text-xs text-slate-500">
        Rows live in the platform audit store (<span className="font-mono">ai_audit_logs</span>), never in your security
        database. Sensitive parameters are redacted before the row is written.
      </p>
    </div>
  );
}
