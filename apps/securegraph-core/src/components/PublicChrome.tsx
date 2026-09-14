import React from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { ArrowRight, BookOpen, LogIn } from "lucide-react";
import { useStore } from "@sg/store";
import { ThemeToggle } from "@sg/ThemeToggle";
import { PLATFORM_URL } from "@sg/links";
import { cx } from "@sg/utils";

/**
 * Chrome for the public pages that render outside the application shell.
 *
 * Documentation is readable without signing in, so it cannot use the operator
 * sidebar — but it still needs a way back, a theme toggle, and a way in. This
 * mirrors the home page header so the two do not feel like different products.
 */
export default function PublicChrome() {
  const { session } = useStore();

  const link = ({ isActive }: { isActive: boolean }) =>
    cx("transition-colors hover:text-white", isActive ? "text-white" : "text-slate-400");

  return (
    <div className="relative min-h-screen">
      <header className="sticky top-0 z-30 border-b border-phantix-700/60 bg-phantix-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-5 py-3.5 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <img src="/logo-white.png" alt="SecureGraph" className="h-8 w-8 object-contain" />
            <span className="leading-tight">
              <span className="block font-display text-[15px] font-bold text-white">
                SecureGraph
              </span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-gold-400">
                Documentation
              </span>
            </span>
          </Link>

          <nav className="ml-8 hidden items-center gap-6 text-sm md:flex">
            <NavLink to="/docs" end className={link}>
              Docs
            </NavLink>
            <Link to="/#pricing" className="text-slate-400 transition-colors hover:text-white">
              Pricing
            </Link>
            <Link to="/sandbox-apply" className="text-slate-400 transition-colors hover:text-white">
              Sandbox
            </Link>
            <a
              href={PLATFORM_URL}
              className="text-slate-400 transition-colors hover:text-white"
            >
              Platform
            </a>
          </nav>

          <div className="ml-auto flex items-center gap-2.5">
            <ThemeToggle />
            {session?.authenticated ? (
              <Link to="/choose-app" className="btn-primary !py-2">
                Open console <ArrowRight size={15} />
              </Link>
            ) : (
              <Link to="/login" className="btn-ghost !py-2">
                <LogIn size={15} /> Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="px-5 py-8 sm:px-6">
        <Outlet />
      </main>

      <footer className="border-t border-phantix-700/40 px-5 py-6 sm:px-6">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <BookOpen size={12} /> SecureGraph documentation
          </span>
          <Link to="/privacy" className="hover:text-slate-300">
            Privacy
          </Link>
          <Link to="/cookies" className="hover:text-slate-300">
            Cookies
          </Link>
        </div>
      </footer>
    </div>
  );
}
