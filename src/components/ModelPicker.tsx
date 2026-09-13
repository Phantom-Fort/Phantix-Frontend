import React, { useEffect, useMemo, useRef, useState } from "react";
import { Cpu, Check, ChevronDown, Loader2, Info, Eye, Brain } from "lucide-react";
import { useStore } from "@/lib/store";
import { cx } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import { loadModels, selectModel, modelLabel, shortModelId, tierRank, capabilityLabel, type AiModel, type AiSurface } from "@/lib/models";

// ── Model picker (staging-rollout §6) ─────────────────────────────────────────
// Lists the models valid for the current surface (pentest | general), grouped by
// tier, showing `label` (not id) with `notes` in a tooltip. Selecting one
// persists server-side via PUT /ai/settings. Degrades to a plain chip when the
// catalog cannot be loaded so the chat surface never breaks.

type Props = {
  surface: AiSurface;
  /** Current model id (e.g. from the agent status payload). */
  value?: string | null;
  /** Called after a selection persists — e.g. to refresh agent status. */
  onChange?: (modelId: string) => void;
  className?: string;
};

export default function ModelPicker({ surface, value, onChange, className }: Props) {
  const { toast } = useStore();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [models, setModels] = useState<AiModel[]>([]);
  const [selected, setSelected] = useState<string | null>(value ?? null);
  const [settingsField, setSettingsField] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState<string | null>(null);
  const [capFilter, setCapFilter] = useState<"all" | "vision" | "reasoning">("all");
  const [freePlan, setFreePlan] = useState<boolean | undefined>(undefined);
  const [freeModelsEnabled, setFreeModelsEnabled] = useState<boolean | undefined>(undefined);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const view = await loadModels(surface);
      if (cancelled) return;
      setModels(view.models);
      setSelected((prev) => prev ?? view.selected ?? view.default ?? value ?? null);
      setSettingsField(view.settingsField);
      setFreePlan(view.freePlan);
      setFreeModelsEnabled(view.freeModelsEnabled);
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surface]);

  // Click-outside to close.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Free models only appear when an org admin has enabled them; a free-plan org
  // that has not opted in gets a hint rather than a per-user agreement prompt.
  const pick = async (m: AiModel) => {
    if (saving) return;
    setOpen(false);
    setSaving(true);
    setSelected(m.id);
    try {
      await selectModel(surface, m.id, settingsField);
      onChange?.(m.id);
      toast("success", "Model updated", `${modelLabel(m)} will be used for this ${surface} surface.`);
    } catch (err) {
      const gated = err instanceof ApiError && (err.status === 403 || err.status === 422);
      toast(
        "error",
        "Could not save model",
        gated
          ? "An administrator can enable free open-source models for your organization in the platform portal."
          : err instanceof Error
            ? err.message
            : "Try again",
      );
    } finally {
      setSaving(false);
    }
  };

  const currentLabel = selected ? shortModelId(selected) : value ? shortModelId(value) : null;

  const selectedModel = useMemo(() => models.find((m) => m.id === selected) ?? null, [models, selected]);
  const selectedHasVision = !!selectedModel?.capabilities?.includes("vision");

  const visible = useMemo(
    () => (capFilter === "all" ? models : models.filter((m) => m.capabilities?.includes(capFilter))),
    [models, capFilter],
  );

  // Catalog unavailable (offline / not configured) — keep a read-only chip.
  if (!loading && models.length === 0) {
    return currentLabel ? (
      <span className={cx("chip border-phantix-600/50 bg-phantix-800/60 font-mono text-slate-300", className)} title="Model catalog unavailable">
        <Cpu size={11} className="mr-1 inline" /> {currentLabel}
      </span>
    ) : null;
  }

  const tiers: { tier: string; models: AiModel[] }[] = [];
  for (const m of visible) {
    const tier = (m.tier ?? "other").toLowerCase();
    let group = tiers.find((g) => g.tier === tier);
    if (!group) { group = { tier, models: [] }; tiers.push(group); }
    group.models.push(m);
  }
  tiers.sort((a, b) => tierRank(a.tier) - tierRank(b.tier));

  return (
    <div ref={rootRef} className={cx("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cx(
          "chip border-phantix-600/50 bg-phantix-800/60 font-mono text-slate-300 transition-colors hover:border-gold-400/40 hover:text-slate-200",
          open && "border-gold-400/40",
        )}
        disabled={saving}
      >
        {saving ? <Loader2 size={11} className="mr-1 inline animate-spin" /> : <Cpu size={11} className="mr-1 inline" />}
        {currentLabel ?? "Model"}
        {selectedHasVision && (
          <span className="ml-1 inline-flex align-middle text-sky-400" title="Multimodal (image input)">
            <Eye size={11} />
          </span>
        )}
        <ChevronDown size={11} className="ml-1 inline text-slate-500" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border border-phantix-700/50 bg-phantix-900 shadow-2xl shadow-black/40">
          <div className="border-b border-phantix-700/40 px-3.5 py-2.5">
            <p className="text-xs font-semibold capitalize text-slate-200">{surface} models</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Selecting persists for your organisation</p>
          </div>
          <div className="flex items-center gap-1 border-b border-phantix-700/40 px-3.5 py-2">
            {(["all", "vision", "reasoning"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setCapFilter(f)}
                className={cx(
                  "chip !px-2 !py-0.5 text-[10px]",
                  capFilter === f
                    ? "border-gold-400/40 bg-gold-400/10 text-gold-200"
                    : "border-phantix-600/40 text-slate-400 hover:text-slate-200",
                )}
              >
                {f === "all" ? "All" : capabilityLabel(f)}
              </button>
            ))}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {visible.length === 0 && (
              <p className="px-3.5 py-4 text-center text-[11px] text-slate-500">
                No {capFilter === "all" ? "" : `${capabilityLabel(capFilter).toLowerCase()} `}models for this surface.
              </p>
            )}
            {tiers.map((group) => (
              <div key={group.tier}>
                <p className="sticky top-0 bg-phantix-900/95 px-3.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {group.tier}
                </p>
                {group.models.map((m) => {
                  const isSelected = m.id === selected;
                  const disabledModel = m.available === false;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={disabledModel || saving}
                      onClick={() => void pick(m)}
                      className={cx(
                        "group flex w-full items-start gap-2 px-3.5 py-2.5 text-left transition-colors",
                        disabledModel ? "cursor-not-allowed opacity-45" : "hover:bg-phantix-800/60",
                        isSelected && "bg-gold-400/5",
                      )}
                    >
                      <span className={cx("mt-0.5 shrink-0", isSelected ? "text-gold-400" : "text-phantix-600")}>
                        {isSelected ? <Check size={13} /> : <span className="block h-3 w-3 rounded-full border border-phantix-600" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-slate-200">{modelLabel(m)}</span>
                        <span className="block truncate font-mono text-[10px] text-slate-500">{shortModelId(m.id)}</span>
                        {m.free && (
                          <span className="mt-1 inline-block rounded bg-emerald-400/10 px-1 py-[1px] text-[9px] font-semibold uppercase tracking-wide text-emerald-300">
                            Free
                          </span>
                        )}
                        {m.capabilities?.filter((c) => c !== "text").length ? (
                          <span className="mt-1 flex flex-wrap gap-1">
                            {m.capabilities.filter((c) => c !== "text").map((c) => (
                              <span
                                key={c}
                                className={cx(
                                  "inline-flex items-center gap-0.5 rounded px-1 py-[1px] text-[9px] uppercase tracking-wide",
                                  c === "vision"
                                    ? "bg-sky-400/10 text-sky-300"
                                    : c === "reasoning"
                                      ? "bg-violet-400/10 text-violet-300"
                                      : "bg-phantix-800/80 text-slate-400",
                                )}
                              >
                                {c === "vision" && <Eye size={8} />}
                                {c === "reasoning" && <Brain size={8} />}
                                {capabilityLabel(c)}
                              </span>
                            ))}
                          </span>
                        ) : null}
                        {disabledModel && m.unavailable_reason && (
                          <span className="mt-0.5 block text-[10px] leading-4 text-severity-medium">{m.unavailable_reason}</span>
                        )}
                      </span>
                      {m.notes && (
                        <span
                          className="mt-0.5 shrink-0 text-slate-500 hover:text-gold-400"
                          onMouseEnter={() => setNotes(m.notes ?? null)}
                          onMouseLeave={() => setNotes(null)}
                          title={m.notes}
                        >
                          <Info size={11} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          {freePlan && freeModelsEnabled === false && (
            <div className="border-t border-phantix-700/40 bg-phantix-900/60 px-3.5 py-2 text-[10px] leading-4 text-slate-500">
              Free open-source models aren't enabled for your organization. An administrator can enable them in the platform portal.
            </div>
          )}
          {notes && (
            <div className="border-t border-phantix-700/40 bg-phantix-800/60 px-3.5 py-2 text-[11px] leading-4 text-slate-400">
              {notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
