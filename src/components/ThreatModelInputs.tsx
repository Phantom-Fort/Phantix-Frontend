import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, Info, Loader2, Plus, Upload, XCircle } from "lucide-react";
import { Card, CardHeader, Modal } from "@/components/ui";
import { useStore } from "@/lib/store";
import { ApiError } from "@/lib/api";
import {
  PRODUCT_INFORMATION_FIELDS,
  PRODUCT_INFORMATION_KIND,
  PROJECT_STAGES,
  buildProductInformationDocument,
  createProject,
  getContextSummary,
  ingestDocument,
  updateProject,
  uploadDiagram,
  type ProductContextSummary,
  type ProductInformationFields,
  type ProductProject,
  type ProjectStage,
} from "@/lib/productContext";
import { cx } from "@/lib/utils";

// ── Threat-model inputs ──────────────────────────────────────────────────────
// A threat model is only as good as the product information behind it. This is
// the editor for that information, reachable from the Threat models page: the
// structured product-information form, the architecture diagram, and free-text
// requirements — plus a link to the full Product Context editor for the graph.
//
// The readiness checklist is the point: it names the input that is still missing
// rather than letting a generation run against an empty context pack and come
// back with nothing.

function stageLabel(stage: string): string {
  return stage === "in_build" ? "In build" : stage.charAt(0).toUpperCase() + stage.slice(1);
}

function contextErrorMessage(e: unknown, fallback = "Unexpected error."): string {
  if (e instanceof ApiError && e.status === 409) {
    return "Your security storage is not activated yet. Product information is stored there — connect it on the Platform under Connections.";
  }
  return e instanceof Error ? e.message : fallback;
}

export function CreateProductModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (project: ProductProject) => void;
}) {
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
      const project = await createProject(name.trim(), stage);
      toast("success", "Product created", "Add its information so a threat model has something to reason over.");
      onCreated(project as ProductProject);
    } catch (e) {
      toast("error", "Could not create the product", contextErrorMessage(e, "Unexpected error."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="New product">
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="tm-prod-name">Product / project name</label>
          <input
            id="tm-prod-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Payments API"
            className="input mt-1"
            autoFocus
          />
        </div>
        <div>
          <p className="label">Stage</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {PROJECT_STAGES.map((s) => (
              <button
                key={s}
                onClick={() => setStage(s)}
                className={cx(
                  "chip transition-colors",
                  stage === s ? "border-gold-400/40 bg-gold-400/10 text-gold-200" : "border-phantix-700 text-slate-400 hover:text-slate-200",
                )}
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
            Create product
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function ProjectInputsModal({
  project,
  onClose,
  onChanged,
}: {
  project: ProductProject;
  onClose: () => void;
  onChanged?: (project: ProductProject) => void;
}) {
  const { toast } = useStore();
  const [stage, setStage] = useState<string>(project.stage);
  const [summary, setSummary] = useState<ProductContextSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [fields, setFields] = useState<ProductInformationFields>({});
  const [savingInfo, setSavingInfo] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docText, setDocText] = useState("");
  const [savingDoc, setSavingDoc] = useState(false);
  const [savingStage, setSavingStage] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      setSummary(await getContextSummary(project.id, project));
    } catch (e) {
      toast("error", "Could not read the project context", contextErrorMessage(e, undefined));
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }, [project, toast]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const setStageValue = async (next: ProjectStage) => {
    if (next === stage || savingStage) return;
    const previous = stage;
    setStage(next);
    setSavingStage(true);
    try {
      await updateProject(project.id, { stage: next });
      onChanged?.({ ...project, stage: next });
      toast("success", "Stage updated", "Future regeneration uses the new stage.");
    } catch (e) {
      setStage(previous);
      toast("error", "Could not update the stage", contextErrorMessage(e, undefined));
    } finally {
      setSavingStage(false);
    }
  };

  const saveProductInformation = async () => {
    const text = buildProductInformationDocument(fields);
    if (!text) {
      toast("warning", "Nothing to save", "Fill in at least one field describing the product.");
      return;
    }
    setSavingInfo(true);
    try {
      const res = await ingestDocument(project.id, {
        text,
        title: `${project.name} — product information`,
        kind: PRODUCT_INFORMATION_KIND,
      });
      toast(
        "success",
        "Product information saved",
        res.execution === "inline" ? "Stored immediately — the model can cite it now." : "Chunking in the background — the model can cite it shortly.",
      );
      setFields({});
      await loadSummary();
    } catch (e) {
      toast("error", "Could not save the product information", contextErrorMessage(e, undefined));
    } finally {
      setSavingInfo(false);
    }
  };

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
      await loadSummary();
    } catch (err) {
      // A parse failure is a 400 with the reason — the uploader is the only one
      // who can fix the diagram, so show it verbatim.
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
      const res = await ingestDocument(project.id, {
        text: docText,
        title: docTitle.trim() || "Requirements",
        kind: "requirements",
      });
      toast(
        "success",
        "Document accepted",
        res.execution === "inline" ? "Chunked immediately." : "Chunking in the background.",
      );
      setDocOpen(false);
      setDocText("");
      setDocTitle("");
      await loadSummary();
    } catch (e) {
      toast("error", "Could not ingest the document", contextErrorMessage(e, undefined));
    } finally {
      setSavingDoc(false);
    }
  };

  const inputs = summary?.inputs ?? [];
  const missingRequired = (summary?.missing ?? []).filter((k) => k === "architecture" || k === "requirements" || k === PRODUCT_INFORMATION_KIND);

  return (
    <Modal open onClose={onClose} title={`Inputs — ${project.name}`} wide>
      <div className="space-y-5">
        {/* Readiness — the whole point of this modal. */}
        <Card>
          <CardHeader
            title="Threat-modelling inputs"
            subtitle="What the model reasons over, and what is still missing"
            action={
              loadingSummary ? (
                <Loader2 size={14} className="animate-spin text-slate-500" />
              ) : summary?.ready ? (
                <span className="chip border-emerald-400/30 bg-emerald-400/10 text-emerald-400">
                  <CheckCircle2 size={11} className="mr-1 inline" /> Ready to generate
                </span>
              ) : (
                <span className="chip border-severity-medium/30 bg-severity-medium/10 text-severity-medium">
                  <AlertTriangle size={11} className="mr-1 inline" /> Needs an input
                </span>
              )
            }
          />
          {loadingSummary ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => <div key={i} className="skeleton h-6 w-full rounded" />)}
            </div>
          ) : (
            <div className="space-y-2">
              {inputs.map((item) => (
                <div key={item.key} className="flex items-start gap-2.5">
                  {item.met ? (
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-400" />
                  ) : (
                    <XCircle size={14} className="mt-0.5 shrink-0 text-slate-600" />
                  )}
                  <div className="min-w-0">
                    <p className={cx("text-xs", item.met ? "text-slate-300" : "text-slate-400")}>{item.label}</p>
                    <p className="text-[11px] leading-5 text-slate-600">{item.hint}</p>
                  </div>
                </div>
              ))}
              {!summary?.ready && (
                <p className="mt-1 flex items-start gap-1.5 text-[11px] leading-5 text-severity-medium">
                  <Info size={11} className="mt-0.5 shrink-0" />
                  A model needs at least one of product information, a parsed diagram or a requirements document before generation will produce anything.
                </p>
              )}
              {summary && (
                <p className="pt-1 text-[11px] text-slate-500">
                  {summary.components} components · {summary.boundaries} boundaries · {summary.flows} flows ·{" "}
                  {summary.documents} document{summary.documents === 1 ? "" : "s"}
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Product information — the structured form. */}
        <Card>
          <CardHeader
            title="Product information"
            subtitle="The parts a diagram cannot express: purpose, data, compliance, assumptions"
            action={
              <div className="flex items-center gap-1.5">
                <label className={cx("btn-secondary cursor-pointer text-xs !py-1.5", uploading && "pointer-events-none opacity-60")}>
                  {uploading ? <Loader2 size={12} className="mr-1.5 inline animate-spin" /> : <Upload size={12} className="mr-1.5 inline" />}
                  Diagram
                  <input type="file" accept=".drawio,.xml" onChange={(e) => void onFile(e)} className="hidden" />
                </label>
                <button onClick={() => setDocOpen(true)} className="btn-ghost text-xs !py-1.5">
                  <FileText size={12} className="mr-1.5 inline" /> Requirements
                </button>
              </div>
            }
          />
          <div className="space-y-3">
            {(showAdvanced ? PRODUCT_INFORMATION_FIELDS : PRODUCT_INFORMATION_FIELDS.slice(0, 6)).map((field) => (
              <div key={field.key}>
                <label className="label" htmlFor={`pi-${field.key}`}>
                  {field.label}
                  <span className="ml-2 font-normal text-slate-600">{field.hint}</span>
                </label>
                <textarea
                  id={`pi-${field.key}`}
                  value={fields[field.key] ?? ""}
                  onChange={(e) => setFields((f) => ({ ...f, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  rows={2}
                  className="input mt-1 resize-y !text-xs"
                />
              </div>
            ))}
            <button onClick={() => setShowAdvanced((v) => !v)} className="text-[11px] text-gold-300 hover:text-gold-200">
              {showAdvanced ? "Show fewer fields" : `Show all ${PRODUCT_INFORMATION_FIELDS.length} fields`}
            </button>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-phantix-800 pt-3">
              <p className="text-[11px] text-slate-500">Saved as one product-information document the model can cite.</p>
              <button onClick={() => void saveProductInformation()} disabled={savingInfo} className="btn-primary text-xs !py-2">
                {savingInfo ? <Loader2 size={13} className="mr-1.5 inline animate-spin" /> : <Plus size={13} className="mr-1.5 inline" />}
                Save product information
              </button>
            </div>
          </div>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-phantix-800 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-500">Stage</span>
            {PROJECT_STAGES.map((s) => (
              <button
                key={s}
                onClick={() => void setStageValue(s)}
                disabled={savingStage}
                className={cx(
                  "chip transition-colors disabled:opacity-60",
                  stage === s ? "border-gold-400/40 bg-gold-400/10 text-gold-200" : "border-phantix-700 text-slate-400 hover:text-slate-200",
                )}
              >
                {stageLabel(s)}
              </button>
            ))}
          </div>
          <Link to="/context" className="btn-ghost text-xs !py-2">
            <ExternalLink size={12} className="mr-1.5 inline" /> Full product context
          </Link>
        </div>
      </div>

      <Modal open={docOpen} onClose={() => setDocOpen(false)} title="Add requirements document" wide>
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="tm-doc-title">Title</label>
            <input id="tm-doc-title" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="Payments API requirements" className="input mt-1" />
          </div>
          <div>
            <label className="label" htmlFor="tm-doc-text">Text</label>
            <textarea
              id="tm-doc-text"
              value={docText}
              onChange={(e) => setDocText(e.target.value)}
              placeholder="Paste the requirements, design notes or user stories..."
              className="input mt-1 min-h-[200px] resize-y"
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
