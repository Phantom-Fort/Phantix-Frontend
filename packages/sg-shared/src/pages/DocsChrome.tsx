import React, { Suspense } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen } from "lucide-react";
import { BrandWordmark } from "../components/BrandLogo";
import { ThemeToggle } from "../ThemeToggle";
import { PageSkeleton } from "../ui";

/**
 * Chrome for the documentation pages across the SecureGraph applications.
 *
 * The docs render outside the operator shell (they must stay readable and,
 * on Core, public), so they need their own top bar. This provides a sticky
 * top bar with a back button plus a centred content measure so long-form
 * guides keep comfortable side margins on wide displays.
 */
export default function DocsChrome() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen">
      <header className="sticky top-0 z-30 border-b border-phantix-700/60 bg-phantix-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-5 py-3.5 sm:px-6">
          <button
            onClick={() => navigate(-1)}
            title="Back"
            aria-label="Back"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-phantix-700 bg-phantix-900 px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-phantix-600 hover:text-white"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Back</span>
          </button>

          <span className="h-6 w-px bg-phantix-700/60" aria-hidden="true" />

          <span className="flex items-center gap-3">
            <span className="flex flex-col">
              <BrandWordmark className="h-8 self-start" />
              <span className="mt-0.5 block pl-[2.25rem] text-[12px] font-semibold uppercase tracking-[0.22em] text-gold-400">Documentation</span>
            </span>
          </span>

          <div className="ml-auto flex items-center gap-2.5">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="px-5 py-8 sm:px-6">
        <div className="mx-auto w-full max-w-[1200px]">
          {/* Doc-to-doc navigation suspends here and shows a skeleton, rather
              than bubbling up to the app-level BrandLoader spinner. */}
          <Suspense fallback={<PageSkeleton variant="detail" />}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      <footer className="border-t border-phantix-700/40 px-5 py-6 sm:px-6">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <BookOpen size={12} /> SecureGraph documentation
          </span>
        </div>
      </footer>
    </div>
  );
}
