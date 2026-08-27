import { ChevronLeft, ChevronRight } from "lucide-react";
import { cx } from "@/lib/utils";

export const PAGE_SIZE_OPTIONS = [20, 50, 100, 200] as const;
export const DEFAULT_PAGE_SIZE = 20;

export interface PaginationProps {
  totalItems: number;
  /** 1-indexed current page. */
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  className?: string;
}

/**
 * Build the page-number sequence to render. Includes 1, the last page, the
 * current page, and its neighbors. Distant gaps are represented by the
 * literal string "ellipsis".
 *
 * Example for current=6, total=99: [1, "ellipsis", 5, 6, 7, "ellipsis", 99].
 */
export function buildPageItems(
  current: number,
  totalPages: number,
): Array<number | "ellipsis"> {
  if (totalPages <= 1) return [1];
  const pages = new Set<number>();
  pages.add(1);
  pages.add(totalPages);
  for (let p = current - 1; p <= current + 1; p += 1) {
    if (p >= 1 && p <= totalPages) pages.add(p);
  }
  const sorted = Array.from(pages).sort((a, b) => a - b);
  const out: Array<number | "ellipsis"> = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const n = sorted[i];
    if (i > 0 && n - sorted[i - 1] > 1) out.push("ellipsis");
    out.push(n);
  }
  return out;
}

/**
 * Pagination control with Prev / 1 2 … N / Next buttons and a page-size
 * selector. Mirrors the Xalgorix webui Pagination: the page-number strip is
 * hidden when there is only a single page, changing page size resets to page 1,
 * and the current page is highlighted with a border (not a filled color) to
 * stay consistent with the border-first card treatment.
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
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / Math.max(1, pageSize)));
  const safePage = Math.min(Math.max(1, page), totalPages);

  if (totalItems === 0) return null;

  const items = buildPageItems(safePage, totalPages);
  const showPageStrip = totalPages > 1;

  function go(p: number) {
    const clamped = Math.min(Math.max(1, p), totalPages);
    if (clamped !== safePage) onPageChange(clamped);
  }

  function changeSize(value: string) {
    const n = Number.parseInt(value, 10);
    if (
      Number.isFinite(n) &&
      (PAGE_SIZE_OPTIONS as readonly number[]).includes(n)
    ) {
      onPageSizeChange(n);
      // Reset to first page so the user does not end up past the new last page.
      onPageChange(1);
    }
  }

  return (
    <div
      className={cx(
        "flex flex-col gap-3 border-t border-phantix-800/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span>Rows per page</span>
        <select
          className="input !w-auto !py-1.5 text-xs"
          value={String(pageSize)}
          onChange={(e) => changeSize(e.target.value)}
          aria-label="Rows per page"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <span className="ml-2 font-mono">
          Page {safePage} of {totalPages} · {totalItems} items
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {showPageStrip ? (
          <>
            <button
              type="button"
              className="btn-secondary !px-2.5 !py-1.5"
              disabled={safePage <= 1}
              onClick={() => go(safePage - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
              Prev
            </button>
            {items.map((item, i) =>
              item === "ellipsis" ? (
                <span
                  key={`ellipsis-${i}`}
                  className="px-2 text-xs text-slate-500"
                  aria-hidden="true"
                >
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => go(item)}
                  aria-current={item === safePage ? "page" : undefined}
                  aria-label={`Page ${item}`}
                  className={cx(
                    "!px-2.5 !py-1.5",
                    item === safePage
                      ? "btn-secondary border-gold-400/60 text-gold-300"
                      : "btn-secondary",
                  )}
                >
                  {item}
                </button>
              ),
            )}
            <button
              type="button"
              className="btn-secondary !px-2.5 !py-1.5"
              disabled={safePage >= totalPages}
              onClick={() => go(safePage + 1)}
              aria-label="Next page"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default Pagination;
