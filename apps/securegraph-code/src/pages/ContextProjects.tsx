import React, { useCallback, useEffect, useState } from "react";
import {
  Boxes, FileText, GitFork, Loader2, Plus, RefreshCw, Search, Share2, Upload,
} from "lucide-react";
import { Card, CardHeader, EmptyState, ErrorState, Modal, PageHeader, Spinner, StatCard, PageBodySkeleton } from "@/components/ui";
import { useStore } from "@/lib/store";
import { ApiError } from "@/lib/api";
import {
  createProject, ingestDocument, listProjects, projectGraph, PROJECT_STAGES,
  searchProjectDocuments, uploadDiagram,
  type DocumentHit, type ProductProject, type ProjectGraph, type ProjectStage,
} from "@/lib/productContext";
import { cx } from "@/lib/utils";

// ── Product context projects ─────────────────────────────────────────────────
// The system model a threat model is generated from: components, trust
// boundaries and data flows parsed out of a .drawio diagram, plus requirements
// documents that get chunked for retrieval.

const STAGE_TONE: Record<string, string> = {
  planned: "border-phantix-700 text-slate-400",
  in_build: "border-severity-medium/30 bg-severity-medium/10 text-severity-medium",
  live: "border-emerald-400/30 bg-emerald-400/10 text-emerald-400",
};

function stageLabel(stage: string): string {
  return stage === "in_build" ? "In build" : stage.charAt(0).toUpperCase() + stage.slice(1);
}

function securityDbMessage(e: unknown, fallback: string): string {
  return e instanceof ApiError && e.status === 409
    ? "Your security storage is not activated yet. Product context is stored there — connect it on the Platform under Connections."
    : e instanceof Error ? e.message : fallback;
}

export default function ContextProjects() {
  const [projects, setProjects] = useState<ProductProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<ProductProject | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listProjects(true);
      setProjects(Array.isArray(res.items) ? res.items : []);
    } catch (e) {
      setError(securityDbMessage(e, "Failed to load product projects."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Product context"
        description="The system model behind your threat models — components, trust boundaries and data flows from your architecture diagram, plus the requirements that describe them."
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => setCreating(true)} className="btn-primary text-xs !py-2">
              <Plus size={13} className="mr-1.5 inline" /> New project
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
        <ErrorState title="Product context unavailable" body={error} onRetry={() => void load()} />
      ) : !projects.length ? (
        <Card>
          <EmptyState
            icon={<Boxes size={22} />}
            title="No projects yet"
            body="Create a project, upload its .drawio architecture diagram, and the engine can model threats against the real system."
            action={<button onClick={() => setCreating(true)} className="btn-primary text-xs !py-2"><Plus size={13} className="mr-1.5 inline" /> New project</button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Card key={p.id} hover onClick={() => setSelected(p)} className="cursor-pointer">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-100">{p.name}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-500">#{p.id}</p>
                </div>
                <span className={cx("chip shrink-0", STAGE_TONE[p.stage] ?? STAGE_TONE.planned)}>{stageLabel(p.stage)}</span>
              </div>
              <p className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-500">
                <Share2 size={11} /> Open to upload a diagram, add requirements or search documents
              </p>
            </Card>
          ))}
        </div>
      )}

      {creating && (
        <CreateProjectModal onClose={() => setCreating(false)} onCreated={() => { setCreating(false); void load(); }} />
      )}

      {selected && <ProjectDrawer project={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function CreateProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { toast } = useStore();
  const [name, setName] = useState("");
  const [stage, setStage] = useState<ProjectStage>("planned");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      toast("warning", "Name is required");
      return;
    }
    setSaving(true);
    try {
      await createProject(name.trim(), stage);
      toast("success", "Project created");
      onCreated();
    } catch (e) {
      toast("error", "Could not create the project", securityDbMessage(e, "Unexpected error."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="New product project">
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="proj-name">Project name</label>
          <input id="proj-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Payments API" className="input mt-1" />
        </div>
        <div>
          <p className="label">Stage</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {PROJECT_STAGES.map((s) => (
              <button
                key={s}
                onClick={() => setStage(s)}
                className={cx("chip transition-colors", stage === s ? "border-gold-400/40 bg-gold-400/10 text-gold-200" : "border-phantix-700 text-slate-400 hover:text-slate-200")}
              >
                {stageLabel(s)}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Stage shapes which threats the engine considers realistic.</p>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost text-xs !py-2">Cancel</button>
          <button onClick={() => void submit()} disabled={saving} className="btn-primary text-xs !py-2">
            {saving ? <Loader2 size={13} className="mr-1.5 inline animate-spin" /> : <Plus size={13} className="mr-1.5 inline" />}
            Create project
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ProjectDrawer({ project, onClose }: { project: ProductProject; onClose: () => void }) {
  const { toast } = useStore();
  const [graph, setGraph] = useState<ProjectGraph | null>(null);
  const [loadingGraph, setLoadingGraph] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docText, setDocText] = useState("");
  const [savingDoc, setSavingDoc] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<DocumentHit[] | null>(null);
  const [searching, setSearching] = useState(false);

  const loadGraph = useCallback(async () => {
    setLoadingGraph(true);
    try {
      setGraph(await projectGraph(project.id));
    } catch {
      setGraph(null);
    } finally {
      setLoadingGraph(false);
    }
  }, [project.id]);

  useEffect(() => {
    void loadGraph();
  }, [loadGraph]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadDiagram(project.id, file, true);
      const count = (k: string) => Number(res[k] ?? 0) || 0;
      toast(
        "success",
        "Diagram parsed",
        `${count("components")} components · ${count("boundaries")} boundaries · ${count("flows")} flows`,
      );
      await loadGraph();
    } catch (err) {
      // A parse failure comes back as a 400 with the reason — surface it verbatim,
      // because the uploader is the only person who can fix the diagram.
      toast("error", "Diagram not parsed", err instanceof Error ? err.message : undefined);
    } finally {
      setUploading(false);
    }
  };

  const saveDoc = async () => {
    if (docText.trim().length < 1) {
      toast("warning", "Paste the requirements text first");
      return;
    }
    setSavingDoc(true);
    try {
      const res = await ingestDocument(project.id, { text: docText, title: docTitle.trim() || "Requirements" });
      toast(
        "success",
        "Document accepted",
        res.execution === "inline" ? "Chunked immediately." : "Chunking in the background.",
      );
      setDocOpen(false);
      setDocText("");
      setDocTitle("");
    } catch (e) {
      toast("error", "Could not ingest the document", e instanceof Error ? e.message : undefined);
    } finally {
      setSavingDoc(false);
    }
  };

  const runSearch = async () => {
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      const res = await searchProjectDocuments(project.id, query.trim());
      setHits(Array.isArray(res.items) ? res.items : []);
    } catch (e) {
      toast("error", "Search failed", e instanceof Error ? e.message : undefined);
    } finally {
      setSearching(false);
    }
  };

  const components = graph?.components ?? [];
  const flows = graph?.flows ?? [];

  return (
    <Modal open onClose={onClose} title={project.name} wide>
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Components" value={String(components.length)} />
          <StatCard label="Flows" value={String(flows.length)} />
          <StatCard label="Crossing boundaries" value={String(flows.filter((f) => f.crosses_boundary).length)} />
        </div>

        <div className="flex flex-wrap gap-2">
          <label className={cx("btn-secondary cursor-pointer text-xs !py-2", uploading && "pointer-events-none opacity-60")}>
            {uploading ? <Loader2 size={13} className="mr-1.5 inline animate-spin" /> : <Upload size={13} className="mr-1.5 inline" />}
            Upload .drawio
            <input type="file" accept=".drawio,.xml" onChange={(e) => void onFile(e)} className="hidden" />
          </label>
          <button onClick={() => setDocOpen(true)} className="btn-ghost text-xs !py-2">
            <FileText size={13} className="mr-1.5 inline" /> Add requirements
          </button>
        </div>

        <Card>
          <CardHeader title="Parsed model" subtitle="Components and the flows between them" />
          {loadingGraph ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {[68, 92, 54, 110, 76, 88, 60, 96].map((w, i) => (
                  <div key={i} className="skeleton h-6 rounded-full" style={{ width: w }} />
                ))}
              </div>
              <div className="skeleton h-3 w-40 rounded" />
            </div>
          ) : !components.length ? (
            <EmptyState icon={<Boxes size={20} />} title="Nothing parsed yet" body="Upload the project's .drawio diagram to build the component and flow model." />
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {components.slice(0, 40).map((c) => (
                  <span
                    key={c.id}
                    className={cx("chip", c.external ? "border-severity-medium/30 text-severity-medium" : c.trusted ? "border-emerald-400/30 text-emerald-400" : "border-phantix-700 text-slate-400")}
                    title={c.external ? "External" : c.trusted ? "Trusted" : "Internal"}
                  >
                    {c.name}
                  </span>
                ))}
              </div>
              {flows.length > 0 && (
                <div className="space-y-1">
                  {flows.slice(0, 25).map((f) => (
                    <div key={f.id} className="flex items-center gap-2 rounded-md border border-phantix-700 bg-phantix-900/60 px-3 py-2 text-xs">
                      <span className="truncate text-slate-300">{f.source_name ?? f.source_component_id}</span>
                      <GitFork size={11} className="shrink-0 rotate-90 text-slate-600" />
                      <span className="truncate text-slate-300">{f.target_name ?? f.target_component_id}</span>
                      {f.crosses_boundary && <span className="chip ml-auto shrink-0 border-severity-medium/30 text-severity-medium">crosses boundary</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Search requirements" subtitle="Full-text over this project's ingested documents" />
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void runSearch(); }}
                placeholder="At least 2 characters"
                className="input w-full !py-1.5 !pl-8 !text-xs"
                aria-label="Search project documents"
              />
            </div>
            <button onClick={() => void runSearch()} disabled={searching} className="btn-secondary text-xs !py-1.5">
              {searching ? <Loader2 size={13} className="animate-spin" /> : "Search"}
            </button>
          </div>
          {hits && (
            hits.length ? (
              <div className="mt-3 space-y-2">
                {hits.map((h, i) => (
                  <div key={h.id ?? i} className="rounded-md border border-phantix-700 bg-phantix-900/60 p-3">
                    {h.title && <p className="text-xs font-medium text-slate-300">{String(h.title)}</p>}
                    <p className="mt-1 text-xs leading-5 text-slate-400">{String(h.chunk ?? h.text ?? "")}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500">No matching passages.</p>
            )
          )}
        </Card>
      </div>

      <Modal open={docOpen} onClose={() => setDocOpen(false)} title="Add requirements document" wide>
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="doc-title">Title</label>
            <input id="doc-title" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="Payments API requirements" className="input mt-1" />
          </div>
          <div>
            <label className="label" htmlFor="doc-text">Text</label>
            <textarea
              id="doc-text"
              value={docText}
              onChange={(e) => setDocText(e.target.value)}
              placeholder="Paste the requirements, design notes or user stories..."
              className="input mt-1 min-h-[220px] resize-y"
            />
            <p className="mt-1 text-[11px] text-slate-500">Chunked for retrieval so the threat engine can cite it.</p>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDocOpen(false)} className="btn-ghost text-xs !py-2">Cancel</button>
            <button onClick={() => void saveDoc()} disabled={savingDoc} className="btn-primary text-xs !py-2">
              {savingDoc ? <Loader2 size={13} className="mr-1.5 inline animate-spin" /> : <FileText size={13} className="mr-1.5 inline" />}
              Ingest document
            </button>
          </div>
        </div>
      </Modal>
    </Modal>
  );
}
