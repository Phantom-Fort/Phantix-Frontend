import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Layers, ShieldCheck, Lock } from "lucide-react";
import { Modal } from "@/components/ui";
import { cx } from "@/lib/utils";
import type { AgentScopeCard, AgentScopeGroup, AgentScopeOption } from "@/lib/types";

export type AgentScopeSelection = { asset_ids: number[]; resource_ids: number[] };

function optionKey(o: AgentScopeOption): string {
  if (o.resource_id != null) return `r:${o.resource_id}`;
  if (o.asset_id != null) return `a:${o.asset_id}`;
  return `v:${o.value ?? o.name ?? ""}`;
}

function optionSelectedId(o: AgentScopeOption): number | null {
  return o.resource_id ?? o.asset_id ?? null;
}

/**
 * Org-data scope confirmation (securegraph.agent.scope_card.v1).
 *
 * The backend never sends tenant inventory to the model until the operator
 * confirms which resources a run may read. Agent chat/run streams answer with
 * HTTP 409 + this card; the UI collects a selection, `POST /ai/agent/scope/confirm`
 * mints a scope grant, and the stream is retried with it.
 */
export default function AgentScopeGate({
  card,
  busy,
  onConfirm,
  onCancel,
}: {
  card: AgentScopeCard;
  busy?: boolean;
  onConfirm: (selection: AgentScopeSelection) => void;
  onCancel: () => void;
}) {
  const groups: AgentScopeGroup[] = Array.isArray(card.groups) ? card.groups : [];
  const suggested = useMemo(() => new Set((card.suggested_ids ?? []).map((n) => String(n))), [card.suggested_ids]);

  const [selected, setSelected] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const g of groups) {
      for (const o of g.options ?? []) {
        const id = optionSelectedId(o);
        if (id != null && suggested.has(String(id))) initial.add(optionKey(o));
      }
    }
    return initial;
  });

  const toggle = (o: AgentScopeOption) => {
    const key = optionKey(o);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const groupSelectedCount = (g: AgentScopeGroup) =>
    (g.options ?? []).reduce((n, o) => n + (selected.has(optionKey(o)) ? 1 : 0), 0);

  const toggleGroup = (g: AgentScopeGroup) => {
    const options = g.options ?? [];
    const allSelected = options.length > 0 && groupSelectedCount(g) === options.length;
    setSelected((prev) => {
      const next = new Set(prev);
      for (const o of options) {
        const key = optionKey(o);
        if (allSelected) next.delete(key);
        else next.add(key);
      }
      return next;
    });
  };

  const selectAll = () => {
    const next = new Set<string>();
    for (const g of groups) for (const o of g.options ?? []) next.add(optionKey(o));
    setSelected(next);
  };

  const clearAll = () => setSelected(new Set());

  const totalOptions = groups.reduce((n, g) => n + (g.options?.length ?? 0), 0);
  const selectionCount = selected.size;

  const confirm = () => {
    const assetIds = new Set<number>();
    const resourceIds = new Set<number>();
    for (const g of groups) {
      for (const o of g.options ?? []) {
        if (!selected.has(optionKey(o))) continue;
        if (o.asset_id != null) assetIds.add(o.asset_id);
        if (o.resource_id != null) resourceIds.add(o.resource_id);
      }
    }
    onConfirm({ asset_ids: [...assetIds], resource_ids: [...resourceIds] });
  };

  const agentName = card.agent?.display_name ?? "SecureGraph Agent";
  const actionLabel = card.intent?.label ?? card.purpose ?? "this request";

  return createPortal(
    <Modal open onClose={onCancel} title={`${agentName} — confirm data scope`} wide>
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-gold-400/25 bg-gold-400/[0.06] p-3.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold-400/15 text-gold-300">
            <ShieldCheck size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-slate-200">
              {card.prompt ?? `Select which organization data ${agentName} may read for ${actionLabel}.`}
            </p>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              Tenant inventory is never sent to the model until you confirm. {card.total ?? totalOptions} resource
              {(card.total ?? totalOptions) === 1 ? "" : "s"} available
              {card.selection_ttl_seconds ? ` · selection expires in ${Math.round(card.selection_ttl_seconds / 60)} min` : ""}.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] uppercase tracking-wider text-slate-500">
            <Layers size={11} className="mr-1 inline" /> {selectionCount} of {totalOptions} selected
          </span>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={selectAll} className="btn-ghost !px-2.5 !py-1 !text-[11px]">Select all</button>
            <button type="button" onClick={clearAll} className="btn-ghost !px-2.5 !py-1 !text-[11px]">Clear</button>
          </div>
        </div>

        <div className="max-h-[46vh] space-y-4 overflow-y-auto pr-1">
          {groups.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">No selectable resources were returned for this request.</p>
          )}
          {groups.map((g) => {
            const options = g.options ?? [];
            const allSelected = options.length > 0 && groupSelectedCount(g) === options.length;
            return (
              <div key={g.key} className="rounded-xl border border-phantix-700/40 bg-phantix-950/40">
                <button
                  type="button"
                  onClick={() => toggleGroup(g)}
                  className="flex w-full items-center gap-2 border-b border-phantix-700/30 px-3.5 py-2.5 text-left"
                >
                  <span className={cx("flex h-4 w-4 shrink-0 items-center justify-center rounded border", allSelected ? "border-gold-400 bg-gold-400 text-phantix-950" : "border-phantix-600 bg-phantix-900")}>
                    {allSelected && <Check size={11} strokeWidth={3} />}
                  </span>
                  <span className="truncate text-xs font-semibold text-slate-200">{g.label ?? g.key}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-slate-500">
                    {groupSelectedCount(g)}/{options.length}
                    {g.truncated ? " · truncated" : ""}
                  </span>
                </button>
                <div className="divide-y divide-phantix-800/50">
                  {options.map((o, idx) => {
                    const key = optionKey(o);
                    const isSelected = selected.has(key);
                    return (
                      <label
                        key={`${key}-${idx}`}
                        className={cx("flex cursor-pointer items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-phantix-800/40", isSelected && "bg-gold-400/[0.05]")}
                      >
                        <input type="checkbox" className="sr-only" checked={isSelected} onChange={() => toggle(o)} />
                        <span className={cx("flex h-4 w-4 shrink-0 items-center justify-center rounded border", isSelected ? "border-gold-400 bg-gold-400 text-phantix-950" : "border-phantix-600 bg-phantix-900")}>
                          {isSelected && <Check size={11} strokeWidth={3} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs text-slate-200">{o.value ?? o.name ?? `#${optionSelectedId(o)}`}</span>
                          {o.name && o.name !== o.value && (
                            <span className="block truncate text-[10px] text-slate-500">{o.name}</span>
                          )}
                        </span>
                        <span className="flex shrink-0 items-center gap-1">
                          {o.asset_type && <span className="chip border-phantix-600/40 bg-phantix-800/50 text-[10px] text-slate-400">{o.asset_type}</span>}
                          {o.environment && <span className="chip border-phantix-600/40 bg-phantix-800/50 text-[10px] text-slate-500">{o.environment}</span>}
                          {o.criticality && (
                            <span className={cx("chip text-[10px] capitalize",
                              o.criticality === "critical" ? "border-severity-critical/40 bg-severity-critical/10 text-severity-critical"
                                : o.criticality === "high" ? "border-severity-high/40 bg-severity-high/10 text-severity-high"
                                  : "border-phantix-600/40 bg-phantix-800/50 text-slate-400")}>
                              {o.criticality}
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-phantix-700/40 pt-4">
          <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <Lock size={10} /> Only the resources you select are shared with the agent.
          </span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onCancel} className="btn-ghost !px-3.5 !py-2 !text-xs" disabled={busy}>Cancel</button>
            <button
              type="button"
              onClick={confirm}
              className="btn-primary !px-3.5 !py-2 !text-xs"
              disabled={busy || selectionCount === 0}
            >
              {busy ? "Confirming…" : `Confirm ${selectionCount || ""} resource${selectionCount === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      </div>
    </Modal>,
    document.body,
  );
}
