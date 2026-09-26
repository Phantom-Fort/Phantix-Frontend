import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  Inbox,
  KanbanSquare,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";
import {
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  SeverityBadge,
  TableSkeleton,
  VerificationBadge,
} from "@sg/ui";
import { Pagination } from "@sg/components/Pagination";
import {
  INTAKE_APPS,
  emptyIntake,
  loadFindingsIntake,
  promoteIntakeFindings,
  type IntakeApp,
  type IntakeFinding,
  type IntakeResponse,
  type IntakeView,
} from "@sg/findingsIntake";
import { useStore } from "@sg/store";
import { cx, timeAgo } from "@sg/utils";
import type { Severity, VerificationStatus } from "@sg/types";

const PAGE_SIZES = [25, 50, 100, 200] as const;

const SOURCE_LABEL: Record<string, string> = {
  scan_results: "Scanner",
  findings: "Findings register",
  soc_detections: "SOC detection",
  vapt_correlated_findings: "VAPT",
  code_review_findings: "Code review",
};

/** Same tone palette the candidate/tracker lists use for state pills. */
const APP_TONE: Record<IntakeApp, string> = {
  core: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  attack: "border-severity-high/40 bg-severity-high/10 text-severity-high",
  defend: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  code: "border-violet-500/40 bg-violet-500/10 text-violet-300",
};

function Pill({ tone, children, title }: { tone: string; children: React.ReactNode; title?: string }) {
  return (
    <span
      className={cx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-medium", tone)}
      title={title}
    >
      {children}
    </span>
  );
}

function verificationStatus(value: string): VerificationStatus {
  const s = String(value || "").toLowerCase();
  if (s === "auto_verified" || s === "manually_verified") return s;
  return "unverified";
}

export default function FindingsIntake() {
  const { toast } = useStore();
  const [view, setView] = useState<IntakeView>("unmanaged");
  const [app, setApp] = useState<IntakeApp | "">("");
  const [severity, setSeverity] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [data, setData] = useState<IntakeResponse>(() => emptyIntake("unmanaged"));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Debounce the free-text search so typing does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const offset = (page - 1) * pageSize;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await loadFindingsIntake({
        view,
        app: app || undefined,
        severity: severity || undefined,
        q: q || undefined,
        limit: pageSize,
        offset,
      });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load findings");
    } finally {
      setLoading(false);
    }
  }, [view, app, severity, q, pageSize, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const findings = data.findings;

  async function track(finding: IntakeFinding) {
    setBusy(finding.key);
    try {
      const res = await promoteIntakeFindings([
        { source_store: finding.source_store, source_id: finding.source_id },
      ]);
      if (res.count === 1) {
        toast("success", "Added to the tracker", finding.title);
      } else {
        toast("info", "Already on the tracker", finding.title);
      }
      await load();
    } catch (e) {
      toast("error", "Could not add to the tracker", e instanceof Error ? e.message : undefined);
      setError(e instanceof Error ? e.message : "Could not add the finding to the tracker");
    } finally {
      setBusy(null);
    }
  }

  const tiles = useMemo(() => {
    const s = data.summary;
    return [
      { key: "unmanaged" as IntakeView, label: "Needs attention", value: s.untracked + s.unverified, icon: <ShieldAlert size={18} />, tone: "text-gold-300" },
      { key: "untracked" as IntakeView, label: "Untracked", value: s.untracked, icon: <Inbox size={18} />, tone: "text-sky-300" },
      { key: "unverified" as IntakeView, label: "Unverified", value: s.unverified, icon: <Search size={18} />, tone: "text-severity-high" },
      { key: "all" as IntakeView, label: "All findings", value: s.scanned, icon: <KanbanSquare size={18} />, tone: "text-slate-300" },
    ];
  }, [data.summary]);

  const selectCls = "input !w-auto !py-1.5 !pr-8 text-[13px]";

  return (
    <div>
      <PageHeader
        title="Findings intake"
        description="Every raw finding across the scanner, VAPT, code review and SOC stores — flagged when it is not on the tracker or not yet verified, so nothing is worked twice."
        actions={
          <button className="btn-ghost !py-1.5 text-xs" onClick={() => void load()} disabled={loading} title="Refresh">
            <RefreshCw size={13} className={cx("inline", loading && "animate-spin")} />
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t, i) => {
          const active = view === t.key;
          return (
            <motion.button
              key={t.key}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => { setView(t.key); setPage(1); }}
              aria-pressed={active}
              className={cx(
                "card flex items-center gap-3 p-4 text-left transition-colors hover:border-phantix-600",
                active && "!border-gold-400/50 bg-gold-400/[0.04]",
              )}
            >
              <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-phantix-700 bg-phantix-900", t.tone)}>
                {t.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] text-slate-400">{t.label}</span>
                <span className="block font-mono text-2xl font-semibold leading-tight text-white">{t.value}</span>
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative w-72 max-w-full">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="input !pl-9 !py-1.5 text-[13px]"
            placeholder="Search findings…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search findings"
          />
        </div>
        <label className="sr-only" htmlFor="intake-app">App</label>
        <select id="intake-app" className={selectCls} value={app} onChange={(e) => { setApp(e.target.value as IntakeApp | ""); setPage(1); }}>
          <option value="">All apps</option>
          {INTAKE_APPS.map((a) => (
            <option key={a.key} value={a.key}>{a.label}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="intake-severity">Severity</label>
        <select id="intake-severity" className={selectCls} value={severity} onChange={(e) => { setSeverity(e.target.value); setPage(1); }}>
          <option value="">Any severity</option>
          {["critical", "high", "medium", "low", "info"].map((s) => (
            <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <span className="ml-auto text-[12px] text-slate-500">
          {data.summary.scanned} raw finding{data.summary.scanned === 1 ? "" : "s"} scanned
          {data.truncated ? " (truncated)" : ""}
        </span>
      </div>

      <Card className="mt-3 !p-0 overflow-hidden">
        {loading && findings.length === 0 ? (
          <div className="p-4"><TableSkeleton rows={6} /></div>
        ) : error && findings.length === 0 ? (
          <ErrorState title="Findings unavailable" body={error} onRetry={() => void load()} />
        ) : findings.length === 0 ? (
          <EmptyState
            icon={<Inbox size={22} />}
            title={view === "untracked" ? "Nothing untracked" : "Nothing in this view"}
            body={
              view === "untracked"
                ? "Every finding in the raw stores is already on the remediation tracker."
                : "No findings match the current filters."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-phantix-700/40">
                  <th className="th">Finding</th>
                  <th className="th">App</th>
                  <th className="th">Severity</th>
                  <th className="th">Evidence</th>
                  <th className="th hidden lg:table-cell">Tracker</th>
                  <th className="th hidden lg:table-cell">Detected</th>
                  <th className="th w-32 text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {findings.map((f) => (
                  <tr key={f.key} className="border-b border-phantix-800/40 hover:bg-phantix-800/35">
                    <td className="td max-w-[34rem]">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-phantix-800/70 text-phantix-300">
                          <Inbox size={14} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-200" title={f.title}>
                            {f.title || "(untitled finding)"}
                          </p>
                          <p className="truncate text-[12px] text-slate-500">
                            {SOURCE_LABEL[f.source_store] ?? f.source_store} · {f.surface}
                            {f.asset_id ? ` · asset #${f.asset_id}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="td">
                      <Pill tone={APP_TONE[f.app] ?? APP_TONE.core}>
                        <span className="capitalize">{f.app}</span>
                      </Pill>
                    </td>
                    <td className="td"><SeverityBadge severity={f.severity as Severity} /></td>
                    <td className="td"><VerificationBadge status={verificationStatus(f.verification_status)} /></td>
                    <td className="td hidden lg:table-cell">
                      {f.tracked ? (
                        <span className="inline-flex items-center gap-1 text-[12px] text-emerald-300">
                          <KanbanSquare size={13} /> {f.tracker_status ?? "tracked"}
                        </span>
                      ) : (
                        <span className="text-[12px] text-slate-500">Not tracked</span>
                      )}
                    </td>
                    <td className="td hidden text-[12px] text-slate-500 lg:table-cell">
                      {f.detected_at ? timeAgo(f.detected_at) : "—"}
                    </td>
                    <td className="td text-right">
                      {f.tracked ? (
                        <span className="text-[12px] text-slate-500">{f.tracker_key ?? "On board"}</span>
                      ) : (
                        <button
                          onClick={() => void track(f)}
                          disabled={busy === f.key}
                          className="btn-primary !py-1.5 !text-xs"
                          title="Add this finding to the remediation tracker"
                        >
                          {busy === f.key ? (
                            <Loader2 size={12} className="mr-1 inline animate-spin" />
                          ) : (
                            <Check size={12} className="mr-1 inline" />
                          )}
                          Track
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <Pagination
              totalItems={data.total}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
              itemLabel="findings"
              pageSizeOptions={PAGE_SIZES}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
