import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, GitBranch, Lightbulb, RefreshCw, Search, Workflow } from "lucide-react";
import { Card, CardHeader, EmptyState, ErrorState, PageHeader, SeverityBadge, StatCard, Tabs, PageBodySkeleton } from "@sg/ui";
import {
  asArray, listCorrelationRules, listMinedCandidates, listProcedures,
  procedureKey, procedureName,
  type CorrelationRule, type RuleCandidate, type VaptProcedure,
} from "@sg/vaptOps";
import { cx } from "@sg/utils";
import type { Severity } from "@sg/types";
import DocLink from "@sg/components/DocLink";

// ── Procedure catalogue, correlation rules and mined candidates ──────────────
// Read-only reference for what the testing engine can run and how it correlates
// results. Mined candidates are explicitly *not* active rules — the backend
// returns them for human review only, and the UI says so.

type Tab = "procedures" | "rules" | "candidates";

function text(v: unknown, fallback = "—"): string {
  return v == null || v === "" ? fallback : String(v);
}

function sevOf(s: unknown): Severity {
  const v = String(s ?? "").toLowerCase();
  return (["critical", "high", "medium", "low", "info"] as const).includes(v as Severity) ? (v as Severity) : "info";
}

export default function VaptProcedures() {
  const [tab, setTab] = useState<Tab>("procedures");
  const [procedures, setProcedures] = useState<VaptProcedure[]>([]);
  const [rules, setRules] = useState<CorrelationRule[]>([]);
  const [candidates, setCandidates] = useState<RuleCandidate[]>([]);
  const [candidateNote, setCandidateNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Each panel is independent — one failing endpoint should not blank the
      // other two, so failures degrade to an empty list per section.
      const [p, r, c] = await Promise.all([
        listProcedures(),
        listCorrelationRules().catch(() => [] as CorrelationRule[]),
        listMinedCandidates().catch(() => ({ candidates: [] as RuleCandidate[], note: undefined })),
      ]);
      setProcedures(asArray(p));
      setRules(asArray(r));
      setCandidates(Array.isArray(c.candidates) ? c.candidates : []);
      setCandidateNote(c.note ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load the VAPT catalogue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const q = search.trim().toLowerCase();

  const visibleProcedures = useMemo(
    () => (!q ? procedures : procedures.filter((p) => `${procedureName(p)} ${procedureKey(p)} ${p.category ?? ""}`.toLowerCase().includes(q))),
    [procedures, q],
  );

  const visibleRules = useMemo(
    () => (!q ? rules : rules.filter((r) => JSON.stringify(r).toLowerCase().includes(q))),
    [rules, q],
  );

  const categories = useMemo(() => {
    const out: Record<string, number> = {};
    for (const p of procedures) {
      const c = String(p.category ?? "uncategorised");
      out[c] = (out[c] ?? 0) + 1;
    }
    return out;
  }, [procedures]);

  return (
    <div>
      <PageHeader
        title="Procedures & correlation"
        description="What the testing engine can run, how it correlates findings, and which new rules it has mined from observed patterns."
        actions={<>
            <DocLink docId="howto-app-23" label="VAPT scheduling how-to" />
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search catalogue"
                className="input w-56 !py-1.5 !pl-8 !text-xs"
                aria-label="Search the VAPT catalogue"
              />
            </div>
            <button onClick={() => void load()} className="btn-ghost text-xs !py-2" title="Refresh">
              <RefreshCw size={13} className={cx("inline", loading && "animate-spin")} />
            </button>
          </div>
        </>}
      />

      {loading && !procedures.length ? (
        <PageBodySkeleton stats={3} tabs={3} variant="section" rows={5} />
      ) : error ? (
        <ErrorState title="Catalogue unavailable" body={error} onRetry={() => void load()} />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Procedures" value={String(procedures.length)} hint={`${Object.keys(categories).length} categories`} />
            <StatCard label="Correlation rules" value={String(rules.length)} hint="builtin + org overrides" />
            <StatCard label="Mined candidates" value={String(candidates.length)} hint="awaiting review" />
          </div>

          <Tabs
            active={tab}
            onChange={(id) => setTab(id as Tab)}
            tabs={[
              { id: "procedures", label: <span className="flex items-center gap-1.5"><BookOpen size={14} /> Procedures</span>, count: procedures.length },
              { id: "rules", label: <span className="flex items-center gap-1.5"><GitBranch size={14} /> Correlation rules</span>, count: rules.length },
              { id: "candidates", label: <span className="flex items-center gap-1.5"><Lightbulb size={14} /> Candidates</span>, count: candidates.length },
            ]}
          />

          {tab === "procedures" && (
            !visibleProcedures.length ? (
              <Card><EmptyState icon={<BookOpen size={22} />} title="No procedures" body={procedures.length ? "Nothing matches that search." : "The engine returned no procedures for this organization."} /></Card>
            ) : (
              <Card className="!p-0 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-phantix-700/40">
                      <th className="th">Name</th>
                      <th className="th">Key</th>
                      <th className="th">Category</th>
                      <th className="th">Phase</th>
                      <th className="th">Steps</th>
                      <th className="th">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleProcedures.map((p) => (
                      <tr key={procedureKey(p)} className="border-b border-phantix-800/40 transition-colors hover:bg-phantix-800/35">
                        <td className="td">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-slate-200">{procedureName(p)}</span>
                            {p.required_role && <span className="chip w-fit border-gold-400/30 text-[11px] text-gold-200">needs {text(p.required_role)}</span>}
                          </div>
                        </td>
                        <td className="td font-mono text-[13px] text-slate-500">{procedureKey(p)}</td>
                        <td className="td">{p.category ? <span className="chip border-phantix-700 text-slate-400">{text(p.category)}</span> : <span className="text-slate-600">—</span>}</td>
                        <td className="td">{p.phase ? <span className="chip border-phantix-700 text-phantix-300">{text(p.phase)}</span> : <span className="text-slate-600">—</span>}</td>
                        <td className="td text-slate-400">
                          {Array.isArray(p.steps) && p.steps.length > 0 ? (
                            <span className="inline-flex items-center gap-1"><Workflow size={10} />{p.steps.length}</span>
                          ) : "—"}
                        </td>
                        <td className="td">
                          {p.is_active === false ? (
                            <span className="chip border-phantix-700 text-slate-500">Inactive</span>
                          ) : (
                            <span className="chip border-emerald-400/30 text-emerald-400">Active</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )
          )}

          {tab === "rules" && (
            !visibleRules.length ? (
              <Card><EmptyState icon={<GitBranch size={22} />} title="No correlation rules" body={rules.length ? "Nothing matches that search." : "No builtin or organization correlation rules are registered."} /></Card>
            ) : (
              <Card className="!p-0 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-phantix-700/40">
                      <th className="th">Name</th>
                      <th className="th">Description</th>
                      <th className="th">Severity</th>
                      <th className="th">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRules.map((r, i) => (
                      <tr key={String(r.id ?? r.rule_key ?? i)} className="border-b border-phantix-800/40 transition-colors hover:bg-phantix-800/35">
                        <td className="td">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-slate-200">{text(r.name ?? r.title ?? r.rule_key, "Rule")}</span>
                            {r.rule_key && <span className="font-mono text-[13px] text-slate-500">{text(r.rule_key)}</span>}
                          </div>
                        </td>
                        <td className="td text-xs leading-5 text-slate-400">{r.description ? text(r.description) : <span className="text-slate-600">—</span>}</td>
                        <td className="td">{r.severity ? <SeverityBadge severity={sevOf(r.severity)} /> : <span className="text-slate-600">—</span>}</td>
                        <td className="td">{r.source ? <span className="chip border-phantix-700 text-slate-500">{text(r.source)}</span> : <span className="text-slate-600">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )
          )}

          {tab === "candidates" && (
            <div className="space-y-3">
              <p className="flex items-start gap-2 rounded-md border border-gold-400/30 bg-gold-400/10 p-3 text-[13px] leading-5 text-gold-200">
                <Lightbulb size={12} className="mt-0.5 shrink-0" />
                <span>
                  {candidateNote ?? "Candidates require human review before activation as correlation rules."}
                  {" "}Promotion is handled by staff — nothing here is active.
                </span>
              </p>
              {!candidates.length ? (
                <Card><EmptyState icon={<Lightbulb size={22} />} title="No candidates mined" body="Either mining consent is off, or no pattern has met the frequency threshold yet." /></Card>
              ) : (
                <Card className="!p-0 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-phantix-700/40">
                        <th className="th">Pattern</th>
                        <th className="th">Description</th>
                        <th className="th">Frequency</th>
                        <th className="th">Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {candidates.map((c, i) => (
                        <tr key={i} className="border-b border-phantix-800/40 transition-colors hover:bg-phantix-800/35">
                          <td className="td text-slate-200">{text(c.pattern ?? c.description, "Mined pattern")}</td>
                          <td className="td text-xs leading-5 text-slate-400">{c.description && c.pattern ? text(c.description) : <span className="text-slate-600">—</span>}</td>
                          <td className="td">{c.frequency != null ? <span className="chip border-phantix-700 text-slate-400">seen {String(c.frequency)}×</span> : <span className="text-slate-600">—</span>}</td>
                          <td className="td">{c.confidence != null ? <span className="chip border-gold-400/30 text-gold-200">confidence {String(c.confidence)}</span> : <span className="text-slate-600">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
