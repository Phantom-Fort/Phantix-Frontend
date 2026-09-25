import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle, Check, Globe, Loader2, Radar, RefreshCw, Search, ShieldAlert, Sparkles, X,
} from "lucide-react";
import { Card, CardHeader, EmptyState, ErrorState, Modal, TableSkeleton } from "../ui";
import { Pagination } from "./Pagination";
import { ApiError } from "../api";
import { useStore } from "../store";
import { cx, timeAgo } from "../utils";
import {
  listCandidates, candidateSummary, promoteCandidate, rejectCandidate, startPassiveEnum,
  PASSIVE_SOURCES, RESOLVE_TONE, TAKEOVER_TONE,
  type AssetCandidate, type CandidateSummary,
} from "../assetCandidates";

const PAGE_SIZES = [25, 50, 100, 200] as const;

function Pill({ tone, children, title }: { tone: string; children: React.ReactNode; title?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-medium", tone)} title={title}>
      {children}
    </span>
  );
}

function resolveLabel(state: string): string {
  return state === "resolves" ? "Resolves" : state === "dangling" ? "Dangling" : state === "unresolved" ? "No DNS" : "Unknown";
}

/**
 * Staged hosts found by passive sources. They are deliberately separate from the
 * verified inventory: nothing here is a scannable asset until an operator
 * promotes it. Dangling CNAMEs (a name pointing at a deprovisioned service) are
 * the ones worth a human look — they surface as takeover risk.
 */
export default function AssetCandidatesView({
  domains = [],
  onPromoted,
}: {
  domains?: string[];
  onPromoted?: () => void;
}) {
  const { toast } = useStore();
  const [items, setItems] = useState<AssetCandidate[]>([]);
  const [summary, setSummary] = useState<CandidateSummary | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("candidate");
  const [resolveState, setResolveState] = useState("");
  const [takeoverOnly, setTakeoverOnly] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const [busy, setBusy] = useState<number | null>(null);
  const [launchOpen, setLaunchOpen] = useState(false);
  const [launchedAt, setLaunchedAt] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, sum] = await Promise.all([
        listCandidates({ status: status || undefined, resolveState: resolveState || undefined, takeoverOnly, q, limit: pageSize, offset: (page - 1) * pageSize }),
        candidateSummary(),
      ]);
      setItems(Array.isArray(list.items) ? list.items : []);
      setTotal(list.total ?? 0);
      setSummary(sum);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load candidates.");
    } finally {
      setLoading(false);
    }
  }, [status, resolveState, takeoverOnly, q, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  // After a passive run is queued, refresh a few times so results appear without
  // a manual reload. Passive sources are slow; three spaced tries is plenty.
  useEffect(() => {
    if (!launchedAt) return;
    let tries = 0;
    timer.current = setInterval(() => {
      tries += 1;
      void load();
      if (tries >= 3 && timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    }, 20_000);
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };
  }, [launchedAt, load]);

  const promote = async (c: AssetCandidate, confirm = false) => {
    setBusy(c.id);
    try {
      const res = await promoteCandidate(c.id, confirm);
      toast("success", "Promoted to inventory", `${c.value} → asset #${res.asset_id}.`);
      onPromoted?.();
      await load();
    } catch (e) {
      if (!confirm && e instanceof ApiError && e.status === 422) {
        // The host does not resolve. Promotion is still possible with an
        // explicit ownership attestation — ask before taking that step.
        if (window.confirm(`${c.value} does not resolve.\n\nPromote it anyway? This records an ownership confirmation for a host that is not currently reachable.`)) {
          await promote(c, true);
          return;
        }
      } else {
        toast("error", "Could not promote", e instanceof Error ? e.message : undefined);
      }
    } finally {
      setBusy(null);
    }
  };

  const reject = async (c: AssetCandidate) => {
    if (!window.confirm(`Reject ${c.value}? It stays in the audit trail but is never promoted.`)) return;
    setBusy(c.id);
    try {
      await rejectCandidate(c.id);
      toast("success", "Candidate rejected", c.value);
      await load();
    } catch (e) {
      toast("error", "Could not reject", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  const counts = useMemo(() => {
    const s = summary;
    return {
      total: s?.total ?? 0,
      resolves: s?.by_resolve_state?.resolves ?? 0,
      dangling: s?.by_resolve_state?.dangling ?? 0,
      unresolved: s?.by_resolve_state?.unresolved ?? 0,
      takeover: s?.takeover_risk ?? 0,
    };
  }, [summary]);

  const selectCls = "input !w-auto !py-1.5 !pr-8 text-[13px]";

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Header + launcher */}
      <Card>
        <CardHeader
          title="Hidden asset candidates"
          subtitle="Hostnames found by passive sources — crawl data, archived pages, CT and passive DNS. Nothing is scannable until you promote it."
          action={
            <button className="btn-primary text-xs !py-2" onClick={() => setLaunchOpen(true)}>
              <Radar size={13} className="mr-1.5 inline" /> Find hidden assets
            </button>
          }
        />
        <div className="grid grid-cols-2 gap-3 px-5 pb-5 sm:grid-cols-5">
          {[
            { label: "Candidates", value: counts.total, tone: "text-slate-100" },
            { label: "Resolve now", value: counts.resolves, tone: "text-emerald-400" },
            { label: "Dangling", value: counts.dangling, tone: "text-severity-critical" },
            { label: "No DNS", value: counts.unresolved, tone: "text-slate-300" },
            { label: "Takeover risk", value: counts.takeover, tone: "text-severity-critical" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-phantix-700/50 bg-phantix-950/40 px-3 py-2.5">
              <p className="text-[12px] uppercase tracking-wider text-slate-500">{s.label}</p>
              <p className={cx("mt-0.5 font-mono text-xl font-semibold", s.tone)}>{s.value}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-72 max-w-full">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="input !pl-9 !py-1.5 text-[13px]"
            placeholder="Search host…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            aria-label="Search candidates"
          />
        </div>
        <label className="sr-only" htmlFor="cand-state">DNS state</label>
        <select id="cand-state" className={selectCls} value={resolveState} onChange={(e) => { setResolveState(e.target.value); setPage(1); }}>
          <option value="">Any DNS state</option>
          <option value="resolves">Resolves</option>
          <option value="dangling">Dangling</option>
          <option value="unresolved">No DNS</option>
        </select>
        <label className="sr-only" htmlFor="cand-status">Status</label>
        <select id="cand-status" className={selectCls} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="candidate">Open candidates</option>
          <option value="promoted">Promoted</option>
          <option value="rejected">Rejected</option>
          <option value="">All statuses</option>
        </select>
        <button
          type="button"
          onClick={() => { setTakeoverOnly((v) => !v); setPage(1); }}
          aria-pressed={takeoverOnly}
          className={cx("chip transition-colors", takeoverOnly ? "border-severity-critical/40 bg-severity-critical/10 text-severity-critical" : "border-phantix-700 text-slate-400 hover:text-slate-200")}
        >
          <ShieldAlert size={12} className="mr-1 inline" /> Takeover risk
        </button>
        <button className="btn-ghost ml-auto !py-1.5 text-xs" onClick={() => void load()} disabled={loading} title="Refresh">
          <RefreshCw size={13} className={cx("inline", loading && "animate-spin")} />
        </button>
      </div>

      <Card className="!p-0 overflow-hidden">
        {loading && items.length === 0 ? (
          <div className="p-4"><TableSkeleton rows={6} /></div>
        ) : error ? (
          <ErrorState title="Candidates unavailable" body={error} onRetry={() => void load()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Sparkles size={22} />}
            title={status === "candidate" ? "No hidden assets staged yet" : "Nothing here"}
            body={
              status === "candidate"
                ? "Run a passive search on a domain you own. Deep, unguessable names — the ones certificate transparency and wordlists miss — show up here for review."
                : "Switch the status filter to see other candidates."
            }
            action={
              status === "candidate" ? (
                <button className="btn-primary text-xs !py-2" onClick={() => setLaunchOpen(true)}>
                  <Radar size={13} className="mr-1.5 inline" /> Find hidden assets
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-phantix-700/40">
                  <th className="th">Host</th>
                  <th className="th hidden lg:table-cell">Sources</th>
                  <th className="th">DNS</th>
                  <th className="th hidden xl:table-cell">CNAME</th>
                  <th className="th">Takeover</th>
                  <th className="th hidden xl:table-cell">Confidence</th>
                  <th className="th hidden lg:table-cell">Last seen</th>
                  <th className="th w-40 text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id} className="border-b border-phantix-800/40 hover:bg-phantix-800/35">
                    <td className="td max-w-[26rem]">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-phantix-800/70 text-phantix-300">
                          <Globe size={14} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-200" title={c.value}>{c.value}</p>
                          <p className="truncate text-[12px] text-slate-500">{c.registrable_domain || c.asset_type}</p>
                        </div>
                      </div>
                    </td>
                    <td className="td hidden lg:table-cell">
                      <span className="flex flex-wrap gap-1">
                        {c.sources.map((s) => (
                          <span key={s} className="chip border-phantix-700 text-[12px] text-slate-400">{s}</span>
                        ))}
                      </span>
                    </td>
                    <td className="td">
                      <Pill tone={RESOLVE_TONE[c.resolve_state] ?? RESOLVE_TONE.unknown}>{resolveLabel(c.resolve_state)}</Pill>
                      {c.resolved_ips?.length > 0 && (
                        <p className="mt-1 font-mono text-[12px] text-slate-500">{c.resolved_ips.slice(0, 2).join(", ")}</p>
                      )}
                    </td>
                    <td className="td hidden max-w-[18rem] xl:table-cell">
                      <span className="block truncate font-mono text-[12px] text-slate-400" title={c.cname ?? undefined}>
                        {c.cname ?? "—"}
                      </span>
                    </td>
                    <td className="td">
                      <Pill tone={TAKEOVER_TONE[c.takeover_risk] ?? TAKEOVER_TONE.none}>
                        {c.takeover_risk === "none" ? "None" : `${c.takeover_risk} risk`}
                      </Pill>
                    </td>
                    <td className="td hidden font-mono text-[12px] text-slate-400 xl:table-cell">
                      {Math.round((c.confidence ?? 0) * 100)}%
                    </td>
                    <td className="td hidden text-[12px] text-slate-500 lg:table-cell">
                      {c.last_seen_at ? timeAgo(c.last_seen_at) : "—"}
                    </td>
                    <td className="td text-right">
                      {c.status === "candidate" ? (
                        <span className="inline-flex items-center gap-1">
                          <button
                            onClick={() => void promote(c)}
                            disabled={busy === c.id}
                            className="btn-primary !py-1.5 !text-xs"
                            title="Promote into the verified inventory"
                          >
                            {busy === c.id ? <Loader2 size={12} className="mr-1 inline animate-spin" /> : <Check size={12} className="mr-1 inline" />}
                            Promote
                          </button>
                          <button
                            onClick={() => void reject(c)}
                            disabled={busy === c.id}
                            className="btn-ghost !py-1.5 !text-xs"
                            title="Reject this candidate"
                            aria-label={`Reject ${c.value}`}
                          >
                            <X size={13} />
                          </button>
                        </span>
                      ) : (
                        <span className="text-[12px] text-slate-500">
                          {c.status === "promoted" && c.promoted_asset_id ? `Asset #${c.promoted_asset_id}` : "Rejected"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <Pagination
              totalItems={total}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
              itemLabel="candidates"
              pageSizeOptions={PAGE_SIZES}
            />
          </div>
        )}
      </Card>

      {launchOpen && (
        <LaunchModal
          domains={domains}
          onClose={() => setLaunchOpen(false)}
          onLaunched={() => { setLaunchOpen(false); setLaunchedAt(Date.now()); }}
        />
      )}
    </motion.div>
  );
}

function LaunchModal({
  domains,
  onClose,
  onLaunched,
}: {
  domains: string[];
  onClose: () => void;
  onLaunched: () => void;
}) {
  const { toast } = useStore();
  const [domain, setDomain] = useState(domains[0] ?? "");
  const [includeDns, setIncludeDns] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const toggleSource = (key: string) =>
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const submit = async () => {
    setBusy(true);
    try {
      await startPassiveEnum(domain, { includeDns, sources: selected });
      toast(
        "success",
        "Passive search queued",
        "Sources are queried in the background — candidates appear here as they return.",
      );
      onLaunched();
    } catch (e) {
      toast("error", "Could not start the search", e instanceof Error ? e.message : undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Find hidden assets">
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="passive-domain">Domain</label>
          <input
            id="passive-domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="example.com"
            className="input mt-1"
            list="passive-domain-options"
          />
          {domains.length > 0 && (
            <datalist id="passive-domain-options">
              {domains.map((d) => <option key={d} value={d} />)}
            </datalist>
          )}
          <p className="mt-1.5 text-[13px] text-slate-500">
            Only search domains your organisation owns. Results are staged for review — they never enter the inventory automatically.
          </p>
        </div>

        <div>
          <p className="label">Sources</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {PASSIVE_SOURCES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => toggleSource(s.key)}
                aria-pressed={selected.includes(s.key)}
                className={cx(
                  "chip transition-colors",
                  selected.includes(s.key) ? "border-gold-400/40 bg-gold-400/10 text-gold-200" : "border-phantix-700 text-slate-400 hover:text-slate-200",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-[13px] text-slate-500">None selected = every source the deployment has enabled.</p>
        </div>

        <label className="flex items-center gap-2 text-[13px] text-slate-300">
          <input type="checkbox" checked={includeDns} onChange={(e) => setIncludeDns(e.target.checked)} className="accent-gold-400" />
          Resolve each host and flag dangling CNAMEs (takeover risk)
        </label>

        <div className="flex items-start gap-2 rounded-lg border border-severity-medium/30 bg-severity-medium/10 p-3 text-[13px] text-severity-medium">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <p>Passive sources can return stale or unrelated names. Treat every candidate as unverified until promoted.</p>
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost text-xs !py-2">Cancel</button>
          <button onClick={() => void submit()} disabled={busy || !domain.trim()} className="btn-primary text-xs !py-2">
            {busy ? <Loader2 size={13} className="mr-1.5 inline animate-spin" /> : <Radar size={13} className="mr-1.5 inline" />}
            Start search
          </button>
        </div>
      </div>
    </Modal>
  );
}
