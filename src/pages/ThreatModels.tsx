import React, { useCallback, useEffect, useState } from "react";
import {
  ChevronDown, Download, FileText, HelpCircle, Info, Loader2, Play, Plus, RefreshCw, Search, Send, ShieldAlert, Sparkles, X,
} from "lucide-react";
import { Card, CardHeader, EmptyState, ErrorState, Modal, PageHeader, Spinner, StatCard, PageBodySkeleton } from "@/components/ui";
import { CreateProductModal, ProjectInputsModal } from "@/components/ThreatModelInputs";
import { useStore } from "@/lib/store";
import { ApiError } from "@/lib/api";
import {
  answerThreatClarification, deliverThreatModel, exportThreatModel, generateThreatModel, getContextSummary, getThreatModel, GRADE_TONE,
  listProjects, listThreatModels, patchThreat, regenerateThreatModel,
  type ProductContextSummary, type ProductProject, type RememberedModel, type Threat, type ThreatModelDetail,
} from "@/lib/productContext";
import { cx } from "@/lib/utils";

// ── Threat models ────────────────────────────────────────────────────────────
// Generated from a product project's parsed context. Threats are graded by how
// well the model's own evidence supports them, and anything it could not settle
// becomes a verification question — answering one re-grades the affected threats.
//
// Index: GET /threat-models?project_id= is authoritative (staging rollout §11b).
// There is no local browser index — a model created on another device or by the
// refresh schedule is still found, and the list is never a stale local guess.

export default function ThreatModels() {
  const { toast } = useStore();
  const [projects, setProjects] = useState<ProductProject[]>([]);
  const [remembered, setRemembered] = useState<RememberedModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState<number | null>(null);
  const [lookupId, setLookupId] = useState("");
  const [openModelId, setOpenModelId] = useState<number | null>(null);
  const [summaries, setSummaries] = useState<Record<number, ProductContextSummary | null>>({});
  const [creating, setCreating] = useState(false);
  const [inputsFor, setInputsFor] = useState<ProductProject | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listProjects(true);
      const projectItems = Array.isArray(res.items) ? res.items : [];
      setProjects(projectItems);
      // Readiness per project drives the input checklist and the generate guard.
      const summaryRows = await Promise.all(
        projectItems.map((p) => getContextSummary(p.id, p).catch(() => null)),
      );
      const nextSummaries: Record<number, ProductContextSummary | null> = {};
      projectItems.forEach((p, i) => { nextSummaries[p.id] = summaryRows[i]; });
      setSummaries(nextSummaries);
      const byId = new Map(projectItems.map((p) => [p.id, p]));
      const lists = await Promise.all(
        projectItems.map((p) => listThreatModels(p.id).catch(() => null)),
      );
      const fromApi: RememberedModel[] = [];
      for (const list of lists) {
        if (!list?.models?.length) continue;
        for (const m of list.models) {
          const project = byId.get(Number(m.project_id));
          const seenAt = Date.parse(String(m.updated_at || m.created_at || "")) || Date.now();
          fromApi.push({
            modelId: Number(m.id),
            projectId: Number(m.project_id),
            projectName: project?.name ?? "",
            seenAt,
          });
        }
      }
      if (fromApi.length) {
        setRemembered(fromApi);
      } else {
        setRemembered([]);
      }
    } catch (e) {
      setRemembered([]);
      setError(
        e instanceof ApiError && e.status === 409
          ? "Security storage is not activated yet — product context and threat models live there."
          : e instanceof Error ? e.message : "Failed to load projects.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const generate = async (project: ProductProject) => {
    setGenerating(project.id);
    try {
      const res = await generateThreatModel(project.id, project.stage);
      toast(
        "success",
        "Generation queued",
        res.message ?? "The model is being generated in the background. Open it by id once the worker finishes.",
      );
      // Refresh index so the new model appears once the worker creates the row.
      window.setTimeout(() => { void load(); }, 2500);
    } catch (e) {
      toast(
        "error",
        "Could not start generation",
        e instanceof ApiError && e.status === 503
          ? "No background worker is available, and threat generation never runs on the request thread."
          : e instanceof Error ? e.message : undefined,
      );
    } finally {
      setGenerating(null);
    }
  };

  const openById = (id: number, project?: ProductProject) => {
    void project;
    setOpenModelId(id);
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Threat models"
        description="STRIDE-style threats derived from a product's real components, data flows and product information, graded by how well the evidence supports them."
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setCreating(true)} className="btn-primary text-xs !py-2">
              <Plus size={13} className="mr-1.5 inline" /> New product
            </button>
            <button onClick={() => void load()} className="btn-ghost text-xs !py-2" title="Refresh">
              <RefreshCw size={13} className={cx("inline", loading && "animate-spin")} />
            </button>
          </div>
        }
      />

      {loading && !projects.length ? (
        <PageBodySkeleton variant="cards" rows={6} />
      ) : error ? (
        <ErrorState title="Threat models unavailable" body={error} onRetry={() => void load()} />
      ) : (
        <div className="space-y-5">
          <p className="flex items-start gap-2 rounded-md border border-gold-400/30 bg-gold-400/10 p-3 text-[11px] leading-5 text-gold-200">
            <Info size={12} className="mt-0.5 shrink-0" />
            A model comes from a product's information. Add <strong className="font-semibold">product information</strong>, an architecture diagram
            or requirements under <span className="mx-1 font-mono">Inputs</span>, then generate. Models load from the
            project-scoped index (<span className="mx-1 font-mono">GET /threat-models?project_id=</span>).
          </p>

          {!projects.length ? (
            <Card>
              <CardHeader title="Your product" subtitle="Add its information, then generate its model" />
              <EmptyState
                icon={<ShieldAlert size={22} />}
                title="No product yet"
                body="Create your product, then add its information — product description, architecture diagram or requirements. Threats are derived from that context."
                action={
                  <button onClick={() => setCreating(true)} className="btn-primary text-xs !py-2">
                    <Plus size={13} className="mr-1.5 inline" /> New product
                  </button>
                }
              />
            </Card>
          ) : projects.length === 1 ? (
            // Single-product orgs go straight to the Inputs/Generate flow — there's
            // nothing to choose between, so we don't frame this as a product picker.
            (() => {
              const p = projects[0];
              const summary = summaries[p.id];
              const notReady = summary != null && !summary.ready;
              return (
                <Card>
                  <CardHeader
                    title={p.name}
                    subtitle={`#${p.id} · ${p.stage}`}
                    action={
                      <button onClick={() => setCreating(true)} className="btn-ghost text-xs !py-1.5" title="Add another product">
                        <Plus size={12} className="mr-1.5 inline" /> Add product
                      </button>
                    }
                  />
                  <ReadinessChips summary={summary} />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setInputsFor(p)}
                      className={cx("btn-secondary text-xs !py-1.5", notReady && "text-gold-200")}
                      title="Add product information, a diagram or requirements"
                    >
                      <FileText size={12} className="mr-1.5 inline" /> Inputs
                    </button>
                    <button
                      onClick={() => void generate(p)}
                      disabled={generating === p.id}
                      className="btn-primary text-xs !py-1.5 disabled:opacity-40"
                      title={notReady ? "Add an input first so the model has something to reason over" : undefined}
                    >
                      {generating === p.id ? <Loader2 size={12} className="mr-1.5 inline animate-spin" /> : <Sparkles size={12} className="mr-1.5 inline" />}
                      Generate
                    </button>
                  </div>
                </Card>
              );
            })()
          ) : (
            <Card>
              <CardHeader title="Products" subtitle="Pick a product, then generate its model" />
              <div className="space-y-2">
                {projects.map((p) => {
                  const summary = summaries[p.id];
                  const notReady = summary != null && !summary.ready;
                  return (
                    <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-phantix-700 bg-phantix-900/60 p-3">
                      <div className="min-w-0">
                        <p className="text-sm text-slate-200">{p.name}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">#{p.id} · {p.stage}</p>
                        <ReadinessChips summary={summary} />
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          onClick={() => setInputsFor(p)}
                          className={cx("btn-ghost text-xs !py-1.5", notReady && "text-gold-200")}
                          title="Add product information, a diagram or requirements"
                        >
                          <FileText size={12} className="mr-1.5 inline" /> Inputs
                        </button>
                        <button
                          onClick={() => void generate(p)}
                          disabled={generating === p.id}
                          className="btn-secondary text-xs !py-1.5 disabled:opacity-40"
                          title={notReady ? "Add an input first so the model has something to reason over" : undefined}
                        >
                          {generating === p.id ? <Loader2 size={12} className="mr-1.5 inline animate-spin" /> : <Sparkles size={12} className="mr-1.5 inline" />}
                          Generate
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Open a model"
              subtitle="By id, or from your projects' models"
              action={
                <div className="flex items-center gap-2">
                  <input
                    value={lookupId}
                    onChange={(e) => setLookupId(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => { if (e.key === "Enter" && lookupId) openById(Number(lookupId)); }}
                    placeholder="Model id"
                    className="input w-28 !py-1.5 !text-xs"
                    aria-label="Threat model id"
                  />
                  <button
                    onClick={() => lookupId && openById(Number(lookupId))}
                    disabled={!lookupId}
                    className="btn-secondary text-xs !py-1.5 disabled:opacity-40"
                  >
                    <Search size={12} className="mr-1.5 inline" /> Open
                  </button>
                </div>
              }
            />
            {!remembered.length ? (
              <p className="text-xs text-slate-500">No models for your projects yet — generate one above, or open by id.</p>
            ) : (
              <div className="space-y-1.5">
                {remembered.map((r) => (
                  <div key={r.modelId} className="flex items-center justify-between gap-3 rounded-md border border-phantix-700 bg-phantix-900/60 px-3 py-2">
                    <button onClick={() => setOpenModelId(r.modelId)} className="min-w-0 flex-1 text-left">
                      <span className="block text-sm text-slate-200">Model #{r.modelId}</span>
                      <span className="block text-[11px] text-slate-500">
                        {r.projectName || "unknown project"} · {new Date(r.seenAt).toLocaleDateString()}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setRemembered((rows) => rows.filter((x) => x.modelId !== r.modelId));
                      }}
                      className="shrink-0 rounded p-1 text-slate-500 hover:text-slate-300"
                      aria-label={`Hide model ${r.modelId}`}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {openModelId != null && (
        <ThreatModelDrawer modelId={openModelId} onClose={() => setOpenModelId(null)} />
      )}

      {creating && (
        <CreateProductModal
          onClose={() => setCreating(false)}
          onCreated={(p) => {
            setCreating(false);
            void load();
            setInputsFor(p);
          }}
        />
      )}

      {inputsFor && (
        <ProjectInputsModal
          project={inputsFor}
          onClose={() => {
            setInputsFor(null);
            void load();
          }}
          onChanged={() => void load()}
        />
      )}
    </div>
  );
}

function ReadinessChips({ summary }: { summary?: ProductContextSummary | null }) {
  if (!summary) {
    return <p className="mt-1.5 text-[11px] text-slate-600">Add product information, a diagram or requirements</p>;
  }
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {summary.inputs.map((item) => (
        <span
          key={item.key}
          title={`${item.hint}${item.met ? " — present" : " — missing"}`}
          className={cx(
            "chip",
            item.met ? "border-emerald-400/30 text-emerald-400" : "border-phantix-700 text-slate-600",
          )}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function ThreatModelDrawer({ modelId, onClose }: { modelId: number; onClose: () => void }) {
  const { toast } = useStore();
  const [data, setData] = useState<ThreatModelDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answering, setAnswering] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [regenerating, setRegenerating] = useState(false);
  const [exportMenu, setExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [delivering, setDelivering] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getThreatModel(modelId));
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 404
          ? `No threat model with id ${modelId}. It may still be generating, or the id is wrong.`
          : e instanceof Error ? e.message : "Failed to load the threat model.",
      );
    } finally {
      setLoading(false);
    }
  }, [modelId]);

  useEffect(() => {
    void load();
  }, [load]);

  const answer = async (clarificationId: number) => {
    const text = (answers[clarificationId] ?? "").trim();
    if (!text) return;
    setAnswering(clarificationId);
    try {
      const res = await answerThreatClarification(modelId, clarificationId, text);
      const regraded = res.re_graded_threat_ids?.length ?? 0;
      setAnswers((a) => ({ ...a, [clarificationId]: "" }));
      if (res.still_open) {
        // Contract: keep it open and say why, rather than clearing it.
        toast("info", "Question not settled", "Your answer did not settle this question, so it stays open — a conditional threat is never over-stated.");
      } else {
        toast("success", "Answer applied", regraded ? `${regraded} threat(s) re-graded — only those changed.` : "Recorded.");
      }
      await load();
    } catch (e) {
      toast("error", "Could not apply the answer", e instanceof Error ? e.message : undefined);
    } finally {
      setAnswering(null);
    }
  };

  const regenerate = async () => {
    const projectId = data?.model?.project_id;
    if (!projectId) {
      toast("warning", "Unknown project", "The model did not report which project it belongs to.");
      return;
    }
    setRegenerating(true);
    try {
      await regenerateThreatModel(modelId, projectId);
      toast("success", "Regeneration queued", "The model is being rebuilt from current context.");
    } catch (e) {
      toast(
        "error",
        "Could not regenerate",
        e instanceof ApiError && e.status === 503 ? "No background worker is available." : e instanceof Error ? e.message : undefined,
      );
    } finally {
      setRegenerating(false);
    }
  };

  // §9b export — POST /threat-models/{id}/export → file. PDF may 503 (renderer
  // not deployed) → keep md/html working.
  const exportAs = async (format: "md" | "html" | "pdf") => {
    if (exporting) return;
    setExportMenu(false);
    setExporting(true);
    try {
      const blob = await exportThreatModel(modelId, format);
      downloadBlob(blob, `threat-model-${modelId}.${format}`);
      toast("success", "Export ready", `threat-model-${modelId}.${format}`);
    } catch (e) {
      toast(
        "error",
        "Export failed",
        e instanceof ApiError && e.status === 503 ? "PDF renderer unavailable on this deployment — export Markdown or HTML instead." : e instanceof Error ? e.message : undefined,
      );
    } finally {
      setExporting(false);
    }
  };

  // §9b deliver — POST /threat-models/{id}/deliver parks behind approval (202).
  const deliver = async () => {
    if (delivering) return;
    setDelivering(true);
    try {
      const res = await deliverThreatModel(modelId, { only_supported: true });
      const r = res as { pending?: boolean; ok?: boolean; failed?: number; detail?: string; status?: string };
      if (r.pending === true || r.status === "pending") {
        // Contract: 202 pending:true means nothing was delivered yet.
        toast("info", "Sent for approval", "The push is parked for an authorizer — approve it from Authorizations for the tickets to be created.");
      } else if (r.ok === false || (typeof r.failed === "number" && r.failed > 0)) {
        toast("warning", "Partly delivered", (r.detail as string) ?? "Some issues were rejected by the tracker.");
      } else {
        toast("success", "Delivered", "Threats were sent to your connected tracker.");
      }
    } catch (e) {
      toast("error", "Could not deliver", e instanceof Error ? e.message : undefined);
    } finally {
      setDelivering(false);
    }
  };

  // §9b disposition — PATCH /threats/{id}. No grade control: grade is rule-computed.
  const patchThreatField = async (t: Threat, patch: { status?: string; owner_type?: string; owner_ref?: number }) => {
    try {
      await patchThreat(t.id, patch);
      toast("success", "Threat updated", "Disposition and ownership saved.");
      await load();
    } catch (e) {
      // 422 → { reason, allowed } — render the allowed values, not a generic error.
      if (e instanceof ApiError && e.status === 422 && e.detail && typeof e.detail === "object") {
        const d = e.detail as { reason?: string; allowed?: unknown };
        const allowed = Array.isArray(d.allowed) ? d.allowed.map(String).join(", ") : null;
        toast("error", "Not allowed", allowed ? `${d.reason ?? "Invalid value"} — choose one of: ${allowed}.` : (d.reason ?? "Invalid value."));
      } else {
        toast("error", "Could not update", e instanceof Error ? e.message : undefined);
      }
      void load();
    }
  };

  const threats = data?.threats ?? [];
  const open = (data?.questions ?? []).filter((q) => q.open);
  const supported = threats.filter((t) => t.grade === "supported").length;

  return (
    <Modal open onClose={onClose} title={`Threat model #${modelId}`} wide>
      {loading ? (
        <PageBodySkeleton stats={3} variant="detail" />
      ) : error ? (
        <ErrorState title="Not available" body={error} onRetry={() => void load()} className="min-h-[30vh]" />
      ) : (
        <div className="space-y-5">
          {data?.model?.stage === "planned" && (
            <p className="flex items-start gap-2 rounded-md border border-sky-400/30 bg-sky-400/10 p-3 text-[11px] leading-5 text-sky-300">
              <Info size={12} className="mt-0.5 shrink-0" />
              Planned design review — the entries below are design decisions to take, not confirmed defects.
            </p>
          )}
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Threats" value={String(threats.length)} />
            <StatCard label="Evidence-supported" value={String(supported)} />
            <StatCard label="Open questions" value={String(open.length)} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-slate-500">
              Stage <span className="text-slate-300">{data?.model?.stage ?? "—"}</span> · status{" "}
              <span className="text-slate-300">{data?.model?.status ?? "—"}</span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {/* Export dropdown (md/html/pdf) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setExportMenu((v) => !v)}
                  disabled={exporting}
                  className="btn-ghost text-xs !py-1.5"
                >
                  {exporting ? <Loader2 size={12} className="mr-1.5 inline animate-spin" /> : <Download size={12} className="mr-1.5 inline" />}
                  Export <ChevronDown size={11} className="ml-1 inline" />
                </button>
                {exportMenu && (
                  <div className="absolute right-0 z-30 mt-1 w-44 overflow-hidden rounded-lg border border-phantix-700 bg-phantix-900 py-1 shadow-card">
                    {(["md", "html", "pdf"] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => void exportAs(fmt)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-phantix-800"
                      >
                        <FileText size={12} className="text-slate-500" />
                        {fmt === "md" ? "Markdown (.md)" : fmt === "html" ? "HTML (.html)" : "PDF (.pdf)"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => void deliver()} disabled={delivering || exporting} className="btn-ghost text-xs !py-1.5">
                {delivering ? <Loader2 size={12} className="mr-1.5 inline animate-spin" /> : <Send size={12} className="mr-1.5 inline" />}
                Send to tracker
              </button>
              <button onClick={() => void regenerate()} disabled={regenerating} className="btn-ghost text-xs !py-1.5">
                {regenerating ? <Loader2 size={12} className="mr-1.5 inline animate-spin" /> : <Play size={12} className="mr-1.5 inline" />}
                Regenerate
              </button>
            </div>
          </div>

          {open.length > 0 && (
            <Card>
              <CardHeader title="Verification questions" subtitle="Answering re-grades the threats that depend on it" />
              <div className="space-y-3">
                {open.map((q) => (
                  <div key={q.id} className="rounded-md border border-phantix-700 bg-phantix-900/60 p-3">
                    <p className="text-sm leading-6 text-slate-200">{q.question}</p>
                    <div className="mt-2 flex gap-2">
                      <input
                        value={answers[q.id] ?? ""}
                        onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") void answer(q.id); }}
                        placeholder="Your answer"
                        className="input flex-1 !py-1.5 !text-xs"
                      />
                      <button
                        onClick={() => void answer(q.id)}
                        disabled={answering === q.id || !(answers[q.id] ?? "").trim()}
                        className="btn-secondary shrink-0 text-xs !py-1.5 disabled:opacity-40"
                      >
                        {answering === q.id ? <Loader2 size={12} className="animate-spin" /> : "Answer"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Threats" subtitle="Evidence-supported first" />
            {!threats.length ? (
              <EmptyState icon={<ShieldAlert size={20} />} title="No threats recorded" body="The model exists but produced no threats — it may still be generating." />
            ) : (
              <div className="space-y-2">
                {threats.map((t) => (
                  <div key={t.id} className="rounded-md border border-phantix-700 bg-phantix-900/60 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-200">{t.title ?? "Untitled threat"}</p>
                        {t.impact && <p className="mt-1 text-xs leading-5 text-slate-400">{t.impact}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {t.category && <span className="chip border-phantix-700 text-phantix-300">{t.category}</span>}
                          <select
                            value={t.status ?? "open"}
                            onChange={(e) => void patchThreatField(t, { status: e.target.value })}
                            title="Disposition (PATCH /threats/{id})"
                            className="chip cursor-pointer border-phantix-700 bg-transparent capitalize text-slate-400 outline-none"
                          >
                            {["open", "accepted", "mitigated", "dismissed"].map((s) => (
                              <option key={s} value={s} className="bg-phantix-900 text-slate-300">{s}</option>
                            ))}
                          </select>
                          <select
                            value={t.owner_type ?? ""}
                            onChange={(e) => void patchThreatField(t, { owner_type: e.target.value || undefined })}
                            title="Owner type"
                            className="chip cursor-pointer border-phantix-700 bg-transparent text-slate-500 outline-none"
                          >
                            <option value="">owner: unassigned</option>
                            {["user", "team", "component", "external"].map((s) => (
                              <option key={s} value={s} className="bg-phantix-900 text-slate-300">{s}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            defaultValue={t.owner_ref ?? ""}
                            placeholder="ref"
                            title="Owner reference (e.g. user id)"
                            onBlur={(e) => {
                              const v = e.currentTarget.value.trim();
                              if (v && Number(v) !== t.owner_ref) void patchThreatField(t, { owner_ref: Number(v) });
                            }}
                            className="w-16 rounded-md border border-phantix-700 bg-transparent px-1.5 py-0.5 font-mono text-[10px] text-slate-500 outline-none focus:border-gold-400/40"
                          />
                        </div>
                      </div>
                      {t.grade && (
                        <span className={cx("chip shrink-0 capitalize", GRADE_TONE[t.grade] ?? "border-phantix-700 text-slate-400")}>
                          {t.grade}
                        </span>
                      )}
                    </div>
                    {t.verification_question && (
                      <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-5 text-slate-500">
                        <HelpCircle size={11} className="mt-0.5 shrink-0" />
                        {t.verification_question}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </Modal>
  );
}
