import React, { useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowDown, ArrowUp, ArrowUpDown, Boxes, EyeOff, Radar, ShieldAlert, ShieldCheck, X,
} from "lucide-react";
import { EmptyState, SeverityBadge, StatusBadge } from "../ui";
import { Pagination, DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS as LIST_PAGE_SIZES } from "./Pagination";
import { cx, timeAgo, titleCase } from "../utils";
import type { Asset } from "../types";

export type ListAsset = Asset & { discoveryStatus?: string; discoveryJobId?: number };

type SortKey = "asset" | "type" | "risk" | "criticality" | "verified" | "last_seen";
type SortDir = "asc" | "desc";

const CRIT_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
const DISCOVERABLE = new Set(["domain", "subdomain", "web_app", "api", "ip_address"]);

function verificationOf(a: Asset): "verified" | "inherited" | "unverified" {
  if (!a.is_verified) return "unverified";
  return a.verification_method === "inherited" ? "inherited" : "verified";
}

function riskRank(a: Asset): number {
  return (CRIT_RANK[String(a.risk_level ?? "").toLowerCase()] ?? -1) * 10_000 + Number(a.open_findings ?? 0);
}

const SORTERS: Record<SortKey, (a: Asset, b: Asset) => number> = {
  asset: (a, b) => a.value.localeCompare(b.value, undefined, { numeric: true, sensitivity: "base" }),
  type: (a, b) => a.asset_type.localeCompare(b.asset_type) || a.value.localeCompare(b.value),
  risk: (a, b) => riskRank(a) - riskRank(b),
  criticality: (a, b) => (CRIT_RANK[a.criticality] ?? 0) - (CRIT_RANK[b.criticality] ?? 0),
  verified: (a, b) => ["unverified", "inherited", "verified"].indexOf(verificationOf(a)) - ["unverified", "inherited", "verified"].indexOf(verificationOf(b)),
  last_seen: (a, b) => new Date(a.last_seen_at || 0).getTime() - new Date(b.last_seen_at || 0).getTime(),
};

type Column = { key: SortKey | "parent" | "tags" | "source"; label: string; className?: string; sortable?: boolean };
const COLUMNS: Column[] = [
  { key: "asset", label: "Asset", sortable: true },
  { key: "type", label: "Type", sortable: true },
  { key: "parent", label: "Parent", className: "hidden 2xl:table-cell" },
  { key: "risk", label: "Risk", sortable: true },
  { key: "criticality", label: "Criticality", className: "hidden lg:table-cell", sortable: true },
  { key: "verified", label: "Ownership", sortable: true },
  { key: "tags", label: "Tags", className: "hidden 2xl:table-cell" },
  { key: "source", label: "Source", className: "hidden 2xl:table-cell" },
  { key: "last_seen", label: "Last seen", className: "hidden lg:table-cell", sortable: true },
];

/**
 * Splits a value into the part that identifies it and the context it lives in,
 * so a dense list reads like a DNS console: `app` bright, `.example.com` dim;
 * for a path, `/robots.txt` bright and the host dim.
 */
function splitValue(value: string): [dim: string, bright: string, dimAfter: string] {
  const m = value.match(/^([a-z][a-z0-9+.-]*:\/\/)?([^/\s]+)(\/.*)?$/i);
  if (!m) return ["", value, ""];
  const [, scheme = "", host, path = ""] = m;
  if (path && path !== "/") return [scheme + host, path, ""];
  const isIp = /^[\d.:]+$/.test(host);
  const labels = host.split(".");
  if (!isIp && labels.length >= 3) return [scheme, labels[0], "." + labels.slice(1).join(".") + path];
  return [scheme, host, path];
}

function AssetValue({ value, term }: { value: string; term: string }) {
  const [before, main, after] = splitValue(value);
  return (
    <>
      {before && <span className="text-slate-500"><Highlight text={before} term={term} /></span>}
      <span className="font-medium text-slate-100"><Highlight text={main} term={term} /></span>
      {after && <span className="text-slate-500"><Highlight text={after} term={term} /></span>}
    </>
  );
}

const Dash = () => <span className="text-slate-600" aria-label="none">—</span>;

/** Wraps each case-insensitive occurrence of ``term`` in a <mark>. */
function Highlight({ text, term }: { text: string; term: string }) {
  const t = term.trim();
  if (!t) return <>{text}</>;
  const lower = text.toLowerCase();
  const needle = t.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  let hit = lower.indexOf(needle);
  while (hit !== -1 && parts.length < 20) {
    if (hit > i) parts.push(text.slice(i, hit));
    parts.push(
      <mark key={hit} className="rounded-sm bg-gold-400/25 px-0.5 text-inherit">
        {text.slice(hit, hit + t.length)}
      </mark>,
    );
    i = hit + t.length;
    hit = lower.indexOf(needle, i);
  }
  parts.push(text.slice(i));
  return <>{parts}</>;
}

function RiskCell({ a }: { a: Asset }) {
  const level = String(a.risk_level ?? "").toLowerCase();
  const open = Number(a.open_findings ?? 0);
  if (!level && !open) return <span className="text-[13px] text-slate-500">Not assessed</span>;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      {level ? <SeverityBadge severity={level as never} /> : null}
      <span className={cx("font-mono text-xs", open ? "text-slate-300" : "text-slate-500")}>
        {open} open
      </span>
    </span>
  );
}

function OwnershipCell({ a }: { a: Asset }) {
  const v = verificationOf(a);
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {v === "unverified" ? (
        <span className="inline-flex items-center gap-1 text-[13px] text-severity-medium">
          <ShieldAlert size={13} /> Unverified
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-[13px] text-emerald-400">
          <ShieldCheck size={13} /> {v === "inherited" ? "Inherited" : "Verified"}
        </span>
      )}
      {a.chain_scope_excluded && (
        <span className="inline-flex items-center gap-1 text-[13px] text-slate-400" title="Not included when its parent is scoped">
          <EyeOff size={12} /> Excluded
        </span>
      )}
    </span>
  );
}

function DiscoveryDot({ status }: { status?: string }) {
  if (!status) return null;
  return <StatusBadge status={status} />;
}

export interface AssetListViewProps {
  assets: ListAsset[];
  typeIcon: Record<string, React.ReactNode>;
  q: string;
  typeFilter: string;
  onClearSearch: () => void;
  onClearType: () => void;
  onSelect: (a: Asset) => void;
  checked: Set<number>;
  onCheckedChange: (next: Set<number>) => void;
  onRunDiscovery: (assets: Asset[]) => void;
  breadcrumb: (a: Asset) => string;
  /** Rendered above the table (e.g. the "matches in the chain" note). */
  notice?: React.ReactNode;
}

/**
 * The inventory as a sortable, filterable, paginated list. Page, page size,
 * sort and the extra filters live in the URL, so a view can be shared,
 * reloaded, or returned to with the back button.
 */
export default function AssetListView({
  assets,
  typeIcon,
  q,
  typeFilter,
  onClearSearch,
  onClearType,
  onSelect,
  checked,
  onCheckedChange,
  onRunDiscovery,
  breadcrumb,
  notice,
}: AssetListViewProps) {
  const [params, setParams] = useSearchParams();
  const top = useRef<HTMLDivElement>(null);

  const sortParam = params.get("sort") ?? "last_seen:desc";
  const [sortKey, sortDir] = (() => {
    const [k, d] = sortParam.split(":");
    return [(k in SORTERS ? k : "last_seen") as SortKey, (d === "asc" ? "asc" : "desc") as SortDir];
  })();
  const pageSize = (() => {
    const n = Number(params.get("size"));
    if ((LIST_PAGE_SIZES as readonly number[]).includes(n)) return n;
    try {
      const saved = Number(localStorage.getItem("sg_asset_page_size"));
      if ((LIST_PAGE_SIZES as readonly number[]).includes(saved)) return saved;
    } catch { /* storage unavailable */ }
    return DEFAULT_PAGE_SIZE;
  })();
  const crit = params.get("crit") ?? "all";
  const owner = params.get("owner") ?? "all";
  const source = params.get("source") ?? "all";

  // Functional form: page-size changes issue two updates back to back.
  const update = (patch: Record<string, string | null>, resetPage = true) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v == null || v === "" || v === "all") next.delete(k);
          else next.set(k, v);
        }
        if (resetPage) next.delete("page");
        return next;
      },
      { replace: true },
    );
  };

  // Search and type filters live in the parent; a change there starts from page 1.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (params.get("page")) update({}, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, typeFilter]);

  const bySearchAndType = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return assets.filter(
      (a) =>
        (typeFilter === "all" || a.asset_type === typeFilter) &&
        (!needle || a.value.toLowerCase().includes(needle) || (a.name || "").toLowerCase().includes(needle) || (a.tags ?? []).some((t) => t.name.toLowerCase().includes(needle))),
    );
  }, [assets, q, typeFilter]);

  const facetCount = (pred: (a: Asset) => boolean) => bySearchAndType.filter(pred).length;
  const sources = useMemo(() => Array.from(new Set(assets.map((a) => a.source).filter(Boolean))).sort(), [assets]);

  const filtered = useMemo(() => {
    const rows = bySearchAndType.filter(
      (a) =>
        (crit === "all" || a.criticality === crit) &&
        (owner === "all" || verificationOf(a) === owner) &&
        (source === "all" || a.source === source),
    );
    const sorter = SORTERS[sortKey];
    rows.sort((a, b) => (sortDir === "asc" ? sorter(a, b) : sorter(b, a)) || a.id - b.id);
    return rows;
  }, [bySearchAndType, crit, owner, source, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(Math.max(1, Number(params.get("page")) || 1), totalPages);
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  const goToPage = (p: number) => {
    update({ page: p > 1 ? String(p) : null }, false);
    // Bring the top of the list back into view when paging from the bottom.
    const el = top.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const setPageSize = (n: number) => {
    try {
      localStorage.setItem("sg_asset_page_size", String(n));
    } catch { /* storage unavailable */ }
    update({ size: n === DEFAULT_PAGE_SIZE ? null : String(n) }, false);
  };

  const toggleSort = (key: SortKey) => {
    const dir: SortDir = sortKey === key ? (sortDir === "asc" ? "desc" : "asc") : key === "asset" || key === "type" ? "asc" : "desc";
    update({ sort: key === "last_seen" && dir === "desc" ? null : `${key}:${dir}` }, true);
  };

  // Selection: the page, or everything that matches.
  const pageIds = pageItems.map((a) => a.id);
  const pageAllChecked = pageIds.length > 0 && pageIds.every((id) => checked.has(id));
  const allMatchingChecked = filtered.length > 0 && filtered.every((a) => checked.has(a.id));
  const togglePage = () => {
    const s = new Set(checked);
    if (pageAllChecked) pageIds.forEach((id) => s.delete(id));
    else pageIds.forEach((id) => s.add(id));
    onCheckedChange(s);
  };
  const toggleOne = (id: number) => {
    const s = new Set(checked);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    onCheckedChange(s);
  };

  const activeChips: { key: string; label: string; clear: () => void }[] = [];
  if (q.trim()) activeChips.push({ key: "q", label: `Search: “${q.trim()}”`, clear: onClearSearch });
  if (typeFilter !== "all") activeChips.push({ key: "type", label: `Type: ${titleCase(typeFilter)}`, clear: onClearType });
  if (crit !== "all") activeChips.push({ key: "crit", label: `Criticality: ${titleCase(crit)}`, clear: () => update({ crit: null }) });
  if (owner !== "all") activeChips.push({ key: "owner", label: `Ownership: ${titleCase(owner)}`, clear: () => update({ owner: null }) });
  if (source !== "all") activeChips.push({ key: "source", label: `Source: ${titleCase(source)}`, clear: () => update({ source: null }) });
  const clearAll = () => {
    onClearSearch();
    onClearType();
    update({ crit: null, owner: null, source: null });
  };

  const stats = {
    verified: filtered.filter((a) => a.is_verified).length,
    critical: filtered.filter((a) => a.criticality === "critical" || String(a.risk_level ?? "") === "critical").length,
    findings: filtered.reduce((n, a) => n + Number(a.open_findings ?? 0), 0),
  };

  const selectCls = "input !w-auto !py-1 !pr-8 text-[13px]";

  return (
    <div ref={top} className="scroll-mt-24">
      {/* Facets */}
      <div className="flex flex-wrap items-center gap-2 border-b border-phantix-700/40 px-3 py-2">
        <label className="sr-only" htmlFor="asset-crit">Criticality</label>
        <select id="asset-crit" className={selectCls} value={crit} onChange={(e) => update({ crit: e.target.value })}>
          <option value="all">Any criticality</option>
          {(["critical", "high", "medium", "low"] as const).map((c) => (
            <option key={c} value={c}>
              {titleCase(c)} ({facetCount((a) => a.criticality === c)})
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="asset-owner">Ownership</label>
        <select id="asset-owner" className={selectCls} value={owner} onChange={(e) => update({ owner: e.target.value })}>
          <option value="all">Any ownership</option>
          {(["verified", "inherited", "unverified"] as const).map((v) => (
            <option key={v} value={v}>
              {titleCase(v)} ({facetCount((a) => verificationOf(a) === v)})
            </option>
          ))}
        </select>
        {sources.length > 1 && (
          <>
            <label className="sr-only" htmlFor="asset-source">Source</label>
            <select id="asset-source" className={selectCls} value={source} onChange={(e) => update({ source: e.target.value })}>
              <option value="all">Any source</option>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {titleCase(s)} ({facetCount((a) => a.source === s)})
                </option>
              ))}
            </select>
          </>
        )}
        <p className="ml-auto text-[13px] text-slate-400">
          <span className="font-mono text-slate-200">{filtered.length.toLocaleString()}</span> assets
          <span className="mx-1.5 text-slate-600">·</span>
          <span className="font-mono text-slate-200">{stats.verified}</span> verified
          {stats.critical > 0 && (
            <>
              <span className="mx-1.5 text-slate-600">·</span>
              <span className="font-mono text-severity-critical">{stats.critical}</span> critical
            </>
          )}
          {stats.findings > 0 && (
            <>
              <span className="mx-1.5 text-slate-600">·</span>
              <span className="font-mono text-slate-200">{stats.findings}</span> open findings
            </>
          )}
        </p>
      </div>

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-phantix-700/40 bg-phantix-950/40 px-4 py-2.5">
          {activeChips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={c.clear}
              className="inline-flex items-center gap-1.5 rounded-full border border-gold-400/30 bg-gold-400/10 py-1 pl-3 pr-2 text-xs font-medium text-gold-200 hover:bg-gold-400/15"
              aria-label={`Remove filter ${c.label}`}
            >
              {c.label} <X size={12} />
            </button>
          ))}
          {activeChips.length > 1 && (
            <button type="button" onClick={clearAll} className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-phantix-800 hover:text-slate-200">
              Clear all
            </button>
          )}
        </div>
      )}

      {notice}

      {/* Bulk actions */}
      {checked.size > 0 && (
        <div className="sticky top-[57px] z-10 flex flex-wrap items-center gap-3 border-b border-gold-400/20 bg-phantix-900/95 px-4 py-2.5 backdrop-blur">
          <span className="text-[13px] font-medium text-slate-200">{checked.size} selected</span>
          {pageAllChecked && !allMatchingChecked && filtered.length > pageItems.length && (
            <button
              type="button"
              className="text-[13px] text-gold-300 underline-offset-2 hover:underline"
              onClick={() => onCheckedChange(new Set([...checked, ...filtered.map((a) => a.id)]))}
            >
              Select all {filtered.length} matching
            </button>
          )}
          <span className="ml-auto flex items-center gap-2">
            <button onClick={() => onRunDiscovery(assets.filter((a) => checked.has(a.id)))} className="btn-primary !py-1.5 !text-xs">
              <Radar size={13} /> Run discovery
            </button>
            <button onClick={() => onCheckedChange(new Set())} className="btn-ghost !py-1.5 !text-xs">
              Clear selection
            </button>
          </span>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="py-4">
          <EmptyState
            icon={<Boxes size={22} />}
            title={activeChips.length ? "No assets match these filters" : "No assets yet"}
            body={activeChips.length ? "Try removing a filter to widen the list." : "Add your first in-scope host to start the inventory."}
            action={activeChips.length ? <button className="btn-secondary" onClick={clearAll}>Clear filters</button> : undefined}
          />
        </div>
      ) : (
        <>
          {/* Phones: one card per asset */}
          <ul className="divide-y divide-phantix-800/50 md:hidden">
            {pageItems.map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={checked.has(a.id)}
                  onChange={() => toggleOne(a.id)}
                  className="mt-1 accent-gold-400"
                  aria-label={`Select ${a.value}`}
                />
                <button type="button" onClick={() => onSelect(a)} className="min-w-0 flex-1 text-left">
                  <span className="flex items-center gap-2">
                    <span className="text-phantix-300">{typeIcon[a.asset_type] ?? <Boxes size={15} />}</span>
                    <span className="truncate"><AssetValue value={a.value} term={q} /></span>
                  </span>
                  {a.parent_asset_id != null && breadcrumb(a) && (
                    <span className="mt-0.5 block truncate text-[12px] text-slate-500">in {breadcrumb(a)}</span>
                  )}
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="text-xs text-slate-400">{titleCase(a.asset_type)}</span>
                    <RiskCell a={a} />
                    <OwnershipCell a={a} />
                    <span className="text-xs text-slate-500">{timeAgo(a.last_seen_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {/* Tablet and up: sortable table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full">
              <thead className="sticky top-0 z-[1] bg-[rgb(var(--surface-card))]">
                <tr className="border-b border-phantix-700/40">
                  <th className="th w-10">
                    <input
                      type="checkbox"
                      checked={pageAllChecked}
                      onChange={togglePage}
                      className="accent-gold-400"
                      aria-label="Select all assets on this page"
                    />
                  </th>
                  {COLUMNS.map((c) => {
                    if (!c.sortable) {
                      return <th key={c.key} className={cx("th whitespace-nowrap", c.className)}>{c.label}</th>;
                    }
                    const key = c.key as SortKey;
                    const active = sortKey === key;
                    return (
                      <th
                        key={c.key}
                        className={cx("th whitespace-nowrap", c.className)}
                        aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                      >
                        <button
                          type="button"
                          onClick={() => toggleSort(key)}
                          className={cx(
                            "-mx-1.5 inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors hover:text-slate-100",
                            active && "text-gold-300",
                          )}
                        >
                          {c.label}
                          {active ? (sortDir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} className="opacity-40" />}
                        </button>
                      </th>
                    );
                  })}
                  <th className="th w-28 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => onSelect(a)}
                    className={cx(
                      "group h-10 cursor-pointer border-b border-phantix-800/40 transition-colors hover:bg-phantix-800/35",
                      checked.has(a.id) && "bg-gold-400/[0.04]",
                    )}
                  >
                    <td className="td w-10" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={checked.has(a.id)}
                        onChange={() => toggleOne(a.id)}
                        className="accent-gold-400"
                        aria-label={`Select ${a.value}`}
                      />
                    </td>
                    <td className="td max-w-[26rem]">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="shrink-0 text-phantix-300 [&>svg]:h-[15px] [&>svg]:w-[15px]" aria-hidden="true">
                          {typeIcon[a.asset_type] ?? <Boxes size={15} />}
                        </span>
                        <span className="truncate" title={a.name && a.name !== a.value ? `${a.value} — ${a.name}` : a.value}>
                          <AssetValue value={a.value} term={q} />
                        </span>
                        <DiscoveryDot status={a.discoveryStatus} />
                      </div>
                    </td>
                    <td className="td whitespace-nowrap text-slate-400">{titleCase(a.asset_type)}</td>
                    <td className="td hidden max-w-[14rem] 2xl:table-cell">
                      {a.parent_asset_id != null && breadcrumb(a) ? (
                        <span className="block truncate text-[13px] text-slate-400" title={breadcrumb(a)}>{breadcrumb(a)}</span>
                      ) : <Dash />}
                    </td>
                    <td className="td whitespace-nowrap"><RiskCell a={a} /></td>
                    <td className="td hidden whitespace-nowrap lg:table-cell">
                      <span className={cx("text-[13px] font-medium capitalize", a.criticality === "critical" ? "text-severity-critical" : a.criticality === "high" ? "text-severity-high" : a.criticality === "medium" ? "text-severity-medium" : "text-slate-400")}>
                        {a.criticality}
                      </span>
                    </td>
                    <td className="td whitespace-nowrap"><OwnershipCell a={a} /></td>
                    <td className="td hidden whitespace-nowrap 2xl:table-cell">
                      {(a.tags?.length ?? 0) > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="max-w-[8rem] truncate rounded px-1.5 py-0.5 text-[12px] font-medium" style={{ background: `${a.tags![0].color}22`, color: a.tags![0].color }}>
                            {a.tags![0].name}
                          </span>
                          {a.tags!.length > 1 && <span className="text-[12px] text-slate-500" title={a.tags!.slice(1).map((t) => t.name).join(", ")}>+{a.tags!.length - 1}</span>}
                        </span>
                      ) : <Dash />}
                    </td>
                    <td className="td hidden whitespace-nowrap text-slate-400 2xl:table-cell">{a.source ? titleCase(a.source) : <Dash />}</td>
                    <td className="td hidden whitespace-nowrap lg:table-cell">
                      <span className="text-[13px] text-slate-400" title={a.last_seen_at}>{timeAgo(a.last_seen_at)}</span>
                    </td>
                    <td className="td w-28 text-right" onClick={(e) => e.stopPropagation()}>
                      <span className="inline-flex items-center justify-end gap-0.5">
                        {DISCOVERABLE.has(a.asset_type) && (
                          <button
                            type="button"
                            onClick={() => onRunDiscovery([a])}
                            className="rounded p-0.5 text-slate-500 opacity-0 transition-opacity hover:bg-phantix-800 hover:text-gold-300 focus-visible:opacity-100 group-hover:opacity-100"
                            aria-label={`Run discovery on ${a.value}`}
                            title="Run discovery"
                          >
                            <Radar size={14} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onSelect(a)}
                          className="rounded px-2 py-0 text-[13px] font-medium leading-5 text-slate-300 hover:bg-phantix-800 hover:text-white"
                          aria-label={`Open ${a.value}`}
                        >
                          Open
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            totalItems={filtered.length}
            page={page}
            pageSize={pageSize}
            onPageChange={goToPage}
            onPageSizeChange={setPageSize}
            itemLabel="assets"
            keyboard
            pageSizeOptions={LIST_PAGE_SIZES}
          />
        </>
      )}
    </div>
  );
}
