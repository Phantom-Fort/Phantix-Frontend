import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cx } from "../utils";

/** Dense tables fit 25 rows on a laptop screen without scrolling far. */
export const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;
export const DEFAULT_PAGE_SIZE = 25;

export interface PaginationProps {
  totalItems: number;
  /** 1-indexed current page. */
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  className?: string;
  /** Noun for the range line, e.g. "assets" → "Showing 21–40 of 124 assets". */
  itemLabel?: string;
  /** Page with ← / → when focus is not in a field. Enable on one list per page. */
  keyboard?: boolean;
  pageSizeOptions?: readonly number[];
}

/**
 * Page-number sequence: first, last, the current page and its neighbours, with
 * "ellipsis" for the gaps. When a gap would hide a single page, that page is
 * shown instead — "1 … 3" wastes a slot that "1 2 3" uses.
 *
 * Example for current=6, total=99: [1, "ellipsis", 5, 6, 7, "ellipsis", 99].
 */
export function buildPageItems(current: number, totalPages: number, siblings = 1): Array<number | "ellipsis"> {
  if (totalPages <= 1) return [1];
  const pages = new Set<number>([1, totalPages]);
  for (let p = current - siblings; p <= current + siblings; p += 1) {
    if (p >= 1 && p <= totalPages) pages.add(p);
  }
  const sorted = Array.from(pages).sort((a, b) => a - b);
  const out: Array<number | "ellipsis"> = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const n = sorted[i];
    const prev = sorted[i - 1];
    if (i > 0 && n - prev === 2) out.push(prev + 1);
    else if (i > 0 && n - prev > 2) out.push("ellipsis");
    out.push(n);
  }
  return out;
}

const fmt = (n: number) => n.toLocaleString();

/**
 * Pagination: a range line ("Showing 21–40 of 124"), rows-per-page, first /
 * previous / numbered / next / last buttons and, for long lists, a jump-to-page
 * box. On phones the numbered strip collapses to "3 / 12" between the arrows.
 *
 * Returns `null` only when `totalItems === 0`.
 */
export function Pagination({
  totalItems,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  className,
  itemLabel = "items",
  keyboard = false,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / Math.max(1, pageSize)));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const [jump, setJump] = useState("");

  function go(p: number) {
    const clamped = Math.min(Math.max(1, p), totalPages);
    if (clamped !== safePage) onPageChange(clamped);
  }

  useEffect(() => {
    if (!keyboard || totalPages <= 1) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (document.querySelector("[role=dialog]")) return;
      if (e.key === "ArrowRight" && safePage < totalPages) onPageChange(safePage + 1);
      if (e.key === "ArrowLeft" && safePage > 1) onPageChange(safePage - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keyboard, safePage, totalPages, onPageChange]);

  if (totalItems === 0) return null;

  const items = buildPageItems(safePage, totalPages);
  const first = (safePage - 1) * pageSize + 1;
  const last = Math.min(safePage * pageSize, totalItems);

  function changeSize(value: string) {
    const n = Number.parseInt(value, 10);
    if (Number.isFinite(n) && pageSizeOptions.includes(n)) {
      onPageSizeChange(n);
      // Keep the first visible row on screen instead of jumping back to page 1.
      onPageChange(Math.floor((first - 1) / n) + 1);
    }
  }

  const arrow = "inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-phantix-700 bg-phantix-900 px-2 text-slate-300 transition-colors hover:border-phantix-600 hover:text-white disabled:pointer-events-none disabled:opacity-40";

  return (
    <nav
      aria-label="Pagination"
      className={cx(
        "flex flex-col gap-2 border-t border-phantix-800/40 px-3 py-2 md:flex-row md:items-center md:justify-between",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-slate-400">
        <span aria-live="polite">
          Showing <span className="font-mono text-slate-200">{fmt(first)}–{fmt(last)}</span> of{" "}
          <span className="font-mono text-slate-200">{fmt(totalItems)}</span> {itemLabel}
        </span>
        <label className="flex items-center gap-2">
          <span>Rows</span>
          <select
            className="input !w-auto !py-1 !pr-8 text-[13px]"
            value={String(pageSize)}
            onChange={(e) => changeSize(e.target.value)}
            aria-label="Rows per page"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" className={cx(arrow, "hidden sm:inline-flex")} disabled={safePage <= 1} onClick={() => go(1)} aria-label="First page" title="First page">
            <ChevronsLeft size={15} />
          </button>
          <button type="button" className={arrow} disabled={safePage <= 1} onClick={() => go(safePage - 1)} aria-label="Previous page" title="Previous page (←)">
            <ChevronLeft size={15} />
          </button>

          <span className="px-2 font-mono text-[13px] text-slate-300 sm:hidden">
            {safePage} / {totalPages}
          </span>
          <ul className="hidden items-center gap-1 sm:flex">
            {items.map((item, i) =>
              item === "ellipsis" ? (
                <li key={`gap-${i}`} className="px-1.5 text-slate-500" aria-hidden="true">
                  …
                </li>
              ) : (
                <li key={item}>
                  <button
                    type="button"
                    onClick={() => go(item)}
                    aria-current={item === safePage ? "page" : undefined}
                    aria-label={`Page ${item}`}
                    className={cx(
                      "inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 font-mono text-[13px] transition-colors",
                      item === safePage
                        ? "border-gold-400/60 bg-gold-400/10 font-semibold text-gold-300"
                        : "border-transparent text-slate-300 hover:border-phantix-600 hover:bg-phantix-900",
                    )}
                  >
                    {item}
                  </button>
                </li>
              ),
            )}
          </ul>

          <button type="button" className={arrow} disabled={safePage >= totalPages} onClick={() => go(safePage + 1)} aria-label="Next page" title="Next page (→)">
            <ChevronRight size={15} />
          </button>
          <button type="button" className={cx(arrow, "hidden sm:inline-flex")} disabled={safePage >= totalPages} onClick={() => go(totalPages)} aria-label="Last page" title="Last page">
            <ChevronsRight size={15} />
          </button>

          {totalPages > 7 && (
            <form
              className="ml-1 hidden items-center gap-1.5 text-[13px] text-slate-400 lg:flex"
              onSubmit={(e) => {
                e.preventDefault();
                const n = Number.parseInt(jump, 10);
                if (Number.isFinite(n)) go(n);
                setJump("");
              }}
            >
              <label htmlFor="pagination-jump">Go to</label>
              <input
                id="pagination-jump"
                inputMode="numeric"
                className="input !w-16 !py-1 text-center font-mono text-[13px]"
                placeholder={String(safePage)}
                value={jump}
                onChange={(e) => setJump(e.target.value.replace(/\D/g, ""))}
                aria-label={`Go to page (1–${totalPages})`}
              />
            </form>
          )}
        </div>
      )}
    </nav>
  );
}

export default Pagination;

/**
 * Client-side paging for a list already in memory. The page size is remembered
 * per list (`storageKey`), and the page resets to 1 when `resetKey` changes
 * (pass the search/filter state), so a filtered list never opens on an empty
 * page. Spread `pagination` straight into <Pagination />.
 */
export function usePaged<T>(items: readonly T[], storageKey: string, resetKey: unknown = null) {
  const [pageSize, setPageSizeState] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(`sg_page_size:${storageKey}`));
      if ((PAGE_SIZE_OPTIONS as readonly number[]).includes(saved)) return saved;
    } catch { /* storage unavailable */ }
    return DEFAULT_PAGE_SIZE;
  });
  const [page, setPage] = useState(1);
  const resetSig = JSON.stringify(resetKey ?? null);
  useEffect(() => setPage(1), [resetSig]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = items.slice((safePage - 1) * pageSize, safePage * pageSize);
  const setPageSize = (n: number) => {
    setPageSizeState(n);
    try { localStorage.setItem(`sg_page_size:${storageKey}`, String(n)); } catch { /* storage unavailable */ }
  };
  return {
    pageItems,
    pagination: { totalItems: items.length, page: safePage, pageSize, onPageChange: setPage, onPageSizeChange: setPageSize },
  };
}
