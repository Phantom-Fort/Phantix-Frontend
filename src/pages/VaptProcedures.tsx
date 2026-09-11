import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, GitBranch, Lightbulb, RefreshCw, Search, Workflow } from "lucide-react";
import { Card, CardHeader, EmptyState, ErrorState, PageHeader, SeverityBadge, Spinner, StatCard, Tabs, PageBodySkeleton } from "@/components/ui";
import {
  asArray, listCorrelationRules, listMinedCandidates, listProcedures,
  procedureKey, procedureName,
  type CorrelationRule, type RuleCandidate, type VaptProcedure,
} from "@/lib/vaptOps";
import { cx } from "@/lib/utils";
import type { Severity } from "@/lib/types";

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
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Procedures & correlation"
        description="What the testing engine can run, how it correlates findings, and which new rules it has mined from observed patterns."
        actions={
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
        }
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
              <div className="space-y-2">
                {visibleProcedures.map((p) => (
                  <Card key={procedureKey(p)}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-200">{procedureName(p)}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-slate-500">{procedureKey(p)}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {p.category && <span className="chip border-phantix-700 text-slate-400">{text(p.category)}</span>}
                          {p.phase && <span className="chip border-phantix-700 text-phantix-300">{text(p.phase)}</span>}
                          {p.required_role && <span className="chip border-gold-400/30 text-gold-200">needs {text(p.required_role)}</span>}
                          {Array.isArray(p.steps) && p.steps.length > 0 && (
                            <span className="chip border-phantix-700 text-slate-400">
                              <Workflow size={10} className="mr-1 inline" />{p.steps.length} steps
                            </span>
                          )}
                        </div>
                      </div>
                      {p.is_active === false && <span className="chip shrink-0 border-phantix-700 text-slate-500">Inactive</span>}
                    </div>
                  </Card>
                ))}
              </div>
            )
          )}

          {tab === "rules" && (
            !visibleRules.length ? (
              <Card><EmptyState icon={<GitBranch size={22} />} title="No correlation rules" body={rules.length ? "Nothing matches that search." : "No builtin or organization correlation rules are registered."} /></Card>
            ) : (
              <div className="space-y-2">
                {visibleRules.map((r, i) => (
                  <Card key={String(r.id ?? r.rule_key ?? i)}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-200">{text(r.name ?? r.title ?? r.rule_key, "Rule")}</p>
                        {r.description && <p className="mt-1 text-xs leading-5 text-slate-400">{text(r.description)}</p>}
                        {r.rule_key && <p className="mt-1 font-mono text-[11px] text-slate-500">{text(r.rule_key)}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {r.severity && <SeverityBadge severity={sevOf(r.severity)} />}
                        {r.source && <span className="chip border-phantix-700 text-slate-500">{text(r.source)}</span>}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )
          )}

          {tab === "candidates" && (
            <div className="space-y-3">
              <p className="flex items-start gap-2 rounded-md border border-gold-400/30 bg-gold-400/10 p-3 text-[11px] leading-5 text-gold-200">
                <Lightbulb size={12} className="mt-0.5 shrink-0" />
                {candidateNote ?? "Candidates require human review before activation as correlation rules."}
                {" "}Promotion is handled by staff — nothing here is active.
              </p>
              {!candidates.length ? (
                <Card><EmptyState icon={<Lightbulb size={22} />} title="No candidates mined" body="Either mining consent is off, or no pattern has met the frequency threshold yet." /></Card>
              ) : (
                candidates.map((c, i) => (
                  <Card key={i}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-200">{text(c.pattern ?? c.description, "Mined pattern")}</p>
                        {c.description && c.pattern && <p className="mt-1 text-xs leading-5 text-slate-400">{text(c.description)}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {c.frequency != null && <span className="chip border-phantix-700 text-slate-400">seen {String(c.frequency)}×</span>}
                        {c.confidence != null && <span className="chip border-gold-400/30 text-gold-200">confidence {String(c.confidence)}</span>}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
