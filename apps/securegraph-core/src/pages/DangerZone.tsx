// Danger zone — asset removal, done deliberately.
//
// Deleting an asset severs the link between everything the platform derived
// from it (findings, risk, reports) and the thing itself, so it is not a row
// action on the inventory table. It lives here, behind a typed confirmation,
// with the two removal modes stated plainly:
//
//   • Remove        — soft-delete: the asset is deactivated and stops being
//                     scanned/reported; support can restore it.
//   • Remove forever — hard-delete: the row is gone; not reversible.
//
// Every removal goes through DELETE /assets/{id} and is written to the audit
// trail by the backend, so "who removed what, and when" is answerable.
import React, { useMemo, useState } from "react";
import { AlertTriangle, Boxes, RefreshCw, Search, ShieldAlert, Trash2 } from "lucide-react";
import { PageHeader, Card, EmptyState, ErrorState, PageSkeleton, Spinner } from "@sg/ui";
import { loadAssetsBundle } from "@sg/data";
import { useResource } from "@sg/useResource";
import { cx, titleCase } from "@sg/utils";
import { useStore } from "@sg/store";
import { api } from "@sg/api";
import type { Asset } from "@sg/types";

/** The operator must type this before anything is removed. */
const CONFIRM_PHRASE = "REMOVE";

export default function DangerZone() {
  const { toast } = useStore();
  const { data, loading, error, reload } = useResource(
    loadAssetsBundle,
    { assets: [] as Asset[], assetTags: [], discoveryJobs: [], securityDbBlocked: false, error: null },
    "assets",
  );
  const assets = (data.assets ?? []) as Asset[];

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [permanent, setPermanent] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ id: number; value: string; ok: boolean; error?: string }[]>([]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter(
      (a) =>
        String(a.value || "").toLowerCase().includes(q) ||
        String(a.name || "").toLowerCase().includes(q) ||
        String(a.asset_type || "").toLowerCase().includes(q),
    );
  }, [assets, query]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((a) => selected.has(a.id));

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        filtered.forEach((a) => next.delete(a.id));
      } else {
        filtered.forEach((a) => next.add(a.id));
      }
      return next;
    });
  };

  const canRemove = selected.size > 0 && confirmText.trim().toUpperCase() === CONFIRM_PHRASE && !busy;

  const removeSelected = async () => {
    if (!canRemove) return;
    const targets = assets.filter((a) => selected.has(a.id));
    setBusy(true);
    setResults([]);
    const out: { id: number; value: string; ok: boolean; error?: string }[] = [];
    for (const asset of targets) {
      try {
        await api.delete<void>(`/assets/${asset.id}${permanent ? "?hard=true" : ""}`);
        out.push({ id: asset.id, value: asset.value || asset.name, ok: true });
      } catch (err) {
        out.push({
          id: asset.id,
          value: asset.value || asset.name,
          ok: false,
          error: err instanceof Error ? err.message : "removal failed",
        });
      }
    }
    setResults(out);
    setBusy(false);
    setSelected(new Set());
    setConfirmText("");
    const ok = out.filter((r) => r.ok).length;
    const failed = out.length - ok;
    toast(
      failed === 0 ? "success" : "error",
      failed === 0 ? "Assets removed" : "Some assets could not be removed",
      `${ok} removed${failed ? `, ${failed} failed` : ""}${permanent ? " permanently" : ""}.`,
    );
    reload();
  };

  if (loading && !assets.length) return <PageSkeleton variant="cards" />;
  if (error) return <ErrorState title="Could not load assets" body={error} onRetry={reload} />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Danger zone"
        description="Remove assets from this organization's inventory. This is deliberate, logged, and — by default — reversible."
      />

      {/* Why this page exists, in the operator's terms. */}
      <Card className="border-severity-critical/30 bg-severity-critical/5">
        <div className="flex gap-3 p-4">
          <ShieldAlert size={20} className="mt-0.5 shrink-0 text-severity-critical" />
          <div className="text-sm text-slate-300">
            <p className="font-semibold text-slate-100">Removal is not an inventory edit.</p>
            <p className="mt-1 text-slate-400">
              Findings, risk scores and reports reference the asset. Use <b>Edit</b> on the Assets page to
              correct details, and only remove an asset here when it is genuinely out of scope, retired, or was
              created in error.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-phantix-800/70 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by value, name or type"
              className="w-full rounded-md border border-phantix-700 bg-phantix-900 py-2 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-600 focus:border-gold-400 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={toggleAllVisible}
            className="rounded-md border border-phantix-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-gold-400/50 hover:text-gold-300"
          >
            {allVisibleSelected ? "Clear selection" : `Select all (${filtered.length})`}
          </button>
          <button
            type="button"
            onClick={reload}
            className="inline-flex items-center gap-1.5 rounded-md border border-phantix-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-gold-400/50 hover:text-gold-300"
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <span className="text-xs text-slate-500">{selected.size} selected</span>
        </div>

        {filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<Boxes size={20} />}
              title={assets.length === 0 ? "No active assets" : "No assets match the filter"}
              body={
                assets.length === 0
                  ? "There is nothing to remove. Assets discovered or added appear here."
                  : "Adjust the filter to find the asset you want to remove."
              }
            />
          </div>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-phantix-950 text-[12px] uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="w-10 px-4 py-2">
                    <input
                      type="checkbox"
                      aria-label="Select all visible assets"
                      checked={allVisibleSelected}
                      onChange={toggleAllVisible}
                      className="h-4 w-4 accent-[rgb(var(--severity-critical))]"
                    />
                  </th>
                  <th className="px-3 py-2">Asset</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Criticality</th>
                  <th className="px-3 py-2">Verified</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr
                    key={a.id}
                    className={cx(
                      "border-t border-phantix-800/50 hover:bg-phantix-900/50",
                      selected.has(a.id) && "bg-severity-critical/5",
                    )}
                  >
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Select ${a.value || a.name}`}
                        checked={selected.has(a.id)}
                        onChange={() => toggle(a.id)}
                        className="h-4 w-4 accent-[rgb(var(--severity-critical))]"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-200">{a.value || a.name}</div>
                      {a.name && a.name !== a.value ? (
                        <div className="text-xs text-slate-500">{a.name}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{titleCase(a.asset_type)}</td>
                    <td className="px-3 py-2 text-slate-400">{titleCase(a.criticality)}</td>
                    <td className="px-3 py-2 text-slate-400">{a.is_verified ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected.size > 0 && (
        <Card className="border-severity-critical/40">
          <div className="space-y-4 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-severity-critical" />
              <div className="text-sm">
                <p className="font-semibold text-slate-100">
                  Remove {selected.size} asset{selected.size === 1 ? "" : "s"}?
                </p>
                <p className="mt-1 text-slate-400">
                  {permanent
                    ? "Permanent removal deletes the asset row and cannot be undone."
                    : "Removal deactivates the asset: it stops being scanned and reported, and support can restore it."}
                </p>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={permanent}
                onChange={(e) => setPermanent(e.target.checked)}
                className="h-4 w-4 accent-[rgb(var(--severity-critical))]"
              />
              Remove permanently (cannot be undone)
            </label>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Type <span className="font-mono text-severity-critical">{CONFIRM_PHRASE}</span> to confirm
              </label>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                className="w-full max-w-xs rounded-md border border-phantix-700 bg-phantix-900 px-3 py-2 font-mono text-sm uppercase tracking-widest text-slate-200 placeholder:text-slate-600 focus:border-severity-critical focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={!canRemove}
                onClick={removeSelected}
                className={cx(
                  "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition",
                  canRemove
                    ? "bg-severity-critical text-white hover:brightness-110"
                    : "cursor-not-allowed bg-phantix-800 text-slate-500",
                )}
              >
                {busy ? <Spinner className="h-4 w-4" /> : <Trash2 size={15} />}
                {busy ? "Removing…" : permanent ? "Remove forever" : "Remove assets"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelected(new Set());
                  setConfirmText("");
                }}
                className="text-sm font-semibold text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
            </div>

            {results.length > 0 && (
              <ul className="space-y-1 border-t border-phantix-800/70 pt-3 text-xs">
                {results.map((r) => (
                  <li key={r.id} className={r.ok ? "text-severity-low" : "text-severity-critical"}>
                    {r.ok ? "Removed" : "Failed"}: {r.value}
                    {r.error ? ` — ${r.error}` : ""}
                  </li>
                ))}
              </ul>
            )}

            <p className="text-[12px] text-slate-600">
              Every removal is recorded in the audit trail with the acting user and timestamp.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
