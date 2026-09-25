import React, { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, CornerDownRight, EyeOff, Folder, Globe, Radar, FileJson, Boxes, Github, Smartphone, ShieldCheck, FileText } from "lucide-react";
import { TableSkeleton, EmptyState } from "../ui";
import { cx, titleCase } from "../utils";
import { chainLabel, loadAssetTree, type AssetTreeNode } from "../assetChain";
import type { Asset } from "../types";

const ICONS: Record<string, React.ReactNode> = {
  domain: <Globe size={15} />,
  subdomain: <Globe size={15} />,
  ip_address: <Radar size={15} />,
  web_app: <Globe size={15} />,
  api: <FileJson size={15} />,
  github_repo: <Github size={15} />,
  mobile_apk: <Smartphone size={15} />,
  port_service: <Radar size={15} />,
};

function nodeIcon(a: Asset, hasChildren: boolean): React.ReactNode {
  if (a.asset_type === "web_path") return hasChildren ? <Folder size={15} /> : <FileText size={15} />;
  return ICONS[a.asset_type] ?? <Boxes size={15} />;
}

interface Level {
  items: AssetTreeNode[];
  total: number;
  loading: boolean;
  error?: string;
}

const PAGE = 200;

export interface AssetTreeViewProps {
  onSelect: (asset: Asset) => void;
  /** Bump to reload every open level (after an add/delete/refresh). */
  refreshKey?: number;
  /** Called once after the first successful root load. */
  onFirstLoad?: () => void;
}

/**
 * The inventory as its chain: domains, the subdomains under them, and the
 * folders/paths under each host. Children load when a row is opened, so a
 * large estate costs one request per level actually viewed.
 */
export default function AssetTreeView({ onSelect, refreshKey = 0, onFirstLoad }: AssetTreeViewProps) {
  const [levels, setLevels] = useState<Record<string, Level>>({});
  const [open, setOpen] = useState<Set<number>>(new Set());
  const firstLoad = useRef(true);

  const load = useCallback(async (parentId: number | null, offset = 0) => {
    const key = parentId == null ? "root" : String(parentId);
    setLevels((l) => ({ ...l, [key]: { items: offset ? l[key]?.items ?? [] : [], total: l[key]?.total ?? 0, loading: true } }));
    try {
      const page = await loadAssetTree(parentId, { limit: PAGE, offset });
      setLevels((l) => ({
        ...l,
        [key]: { items: offset ? [...(l[key]?.items ?? []), ...page.items] : page.items, total: page.total, loading: false },
      }));
      return page;
    } catch (e) {
      setLevels((l) => ({ ...l, [key]: { items: l[key]?.items ?? [], total: l[key]?.total ?? 0, loading: false, error: e instanceof Error ? e.message : "Could not load" } }));
      return null;
    }
  }, []);

  // (Re)load roots and every open level whenever the inventory changes.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const roots = await load(null);
      if (!alive || !roots) return;
      if (firstLoad.current) {
        firstLoad.current = false;
        onFirstLoad?.();
        // Open the chains straight away when there are only a few of them.
        const withChildren = roots.items.filter((n) => n.child_count > 0);
        if (withChildren.length > 0 && withChildren.length <= 3) {
          const auto = withChildren.map((n) => n.asset.id);
          setOpen(new Set(auto));
          await Promise.all(auto.map((id) => load(id)));
        }
        return;
      }
      await Promise.all(Array.from(open).map((id) => load(id)));
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, load]);

  const toggle = (id: number) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        next.add(id);
        if (!levels[String(id)]) void load(id);
      }
      return next;
    });
  };

  const root = levels.root;
  if (!root || (root.loading && root.items.length === 0)) {
    return <div className="p-4"><TableSkeleton rows={6} /></div>;
  }
  if (root.error && root.items.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-slate-400">{root.error}</p>;
  }
  if (root.items.length === 0) {
    return <EmptyState icon={<Boxes size={22} />} title="No assets yet" body="Add a domain to start a chain — its subdomains and paths will appear under it." />;
  }

  const rows: React.ReactNode[] = [];
  const walk = (parentKey: string, depth: number) => {
    const level = levels[parentKey];
    if (!level) return;
    for (const node of level.items) {
      const a = node.asset;
      const isOpen = open.has(a.id);
      const hasChildren = node.child_count > 0;
      rows.push(
        <tr
          key={a.id}
          role="row"
          aria-level={depth + 1}
          aria-expanded={hasChildren ? isOpen : undefined}
          onClick={() => onSelect(a)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSelect(a);
            if (hasChildren && e.key === "ArrowRight" && !isOpen) toggle(a.id);
            if (hasChildren && e.key === "ArrowLeft" && isOpen) toggle(a.id);
          }}
          tabIndex={0}
          className="cursor-pointer border-b border-phantix-800/40 transition-colors hover:bg-phantix-800/35 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-gold-400/60"
        >
          <td className="td">
            <div className="flex min-w-0 items-center gap-2" style={{ paddingLeft: depth * 22 }}>
              {hasChildren ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(a.id);
                  }}
                  aria-label={`${isOpen ? "Collapse" : "Expand"} ${a.value}`}
                  aria-expanded={isOpen}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-phantix-800 hover:text-slate-100"
                >
                  <ChevronRight size={15} className={cx("transition-transform", isOpen && "rotate-90")} />
                </button>
              ) : (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center text-slate-600" aria-hidden>
                  {depth > 0 ? <CornerDownRight size={13} /> : null}
                </span>
              )}
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-phantix-800/70 text-phantix-300">
                {nodeIcon(a, hasChildren)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-200" title={a.value}>{chainLabel(a)}</p>
                <p className="truncate text-xs text-slate-500">
                  {a.name && a.name !== a.value && a.name !== chainLabel(a) ? a.name : titleCase(a.asset_type)}
                </p>
              </div>
            </div>
          </td>
          <td className="td whitespace-nowrap"><span className="text-xs text-slate-400">{titleCase(a.asset_type)}</span></td>
          <td className="td whitespace-nowrap">
            {node.descendant_count > 0 ? (
              <span className="text-xs text-slate-300">
                {node.child_count} <span className="text-slate-500">direct · {node.descendant_count} total</span>
              </span>
            ) : (
              <span className="text-xs text-slate-600">—</span>
            )}
          </td>
          <td className="td whitespace-nowrap">
            {node.open_findings > 0 ? (
              <span className="flex items-center gap-1.5 text-xs">
                {node.critical_findings > 0 && <span className="chip border-severity-critical/30 bg-severity-critical/10 text-severity-critical">{node.critical_findings} critical</span>}
                {node.high_findings > 0 && <span className="chip border-severity-high/30 bg-severity-high/10 text-severity-high">{node.high_findings} high</span>}
                <span className="text-slate-400">{node.open_findings} open</span>
              </span>
            ) : (
              <span className="text-xs text-slate-600">None</span>
            )}
          </td>
          <td className="td whitespace-nowrap">
            <span className="flex flex-wrap items-center gap-1.5">
              {a.is_verified ? (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                  <ShieldCheck size={13} /> {a.verification_method === "inherited" ? "Inherited" : "Verified"}
                </span>
              ) : (
                <span className="text-xs text-severity-medium">Unverified</span>
              )}
              {a.chain_scope_excluded && (
                <span className="chip border-slate-500/40 bg-slate-500/10 text-slate-300" title="Not included when its parent is scoped">
                  <EyeOff size={11} /> Out of parent scope
                </span>
              )}
            </span>
          </td>
        </tr>,
      );
      if (isOpen) {
        const child = levels[String(a.id)];
        if (!child || (child.loading && child.items.length === 0)) {
          rows.push(
            <tr key={`${a.id}-loading`}>
              <td colSpan={5} className="px-5 py-2" style={{ paddingLeft: 20 + (depth + 1) * 22 }}>
                <div className="skeleton h-4 w-56 rounded" />
              </td>
            </tr>,
          );
        } else {
          walk(String(a.id), depth + 1);
        }
      }
    }
    if (level.items.length < level.total) {
      const parentId = parentKey === "root" ? null : Number(parentKey);
      rows.push(
        <tr key={`${parentKey}-more`}>
          <td colSpan={5} className="px-5 py-2" style={{ paddingLeft: 20 + depth * 22 }}>
            <button className="btn-ghost !px-2 !py-1 text-xs" disabled={level.loading} onClick={() => void load(parentId, level.items.length)}>
              Show more ({level.total - level.items.length} remaining)
            </button>
          </td>
        </tr>,
      );
    }
  };
  walk("root", 0);

  return (
    <div className="overflow-x-auto">
      <table className="w-full" role="treegrid" aria-label="Asset chain">
        <thead>
          <tr className="border-b border-phantix-700/40">
            <th className="th">Asset</th>
            <th className="th">Type</th>
            <th className="th">Below it</th>
            <th className="th">Open findings</th>
            <th className="th">Verified</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}
