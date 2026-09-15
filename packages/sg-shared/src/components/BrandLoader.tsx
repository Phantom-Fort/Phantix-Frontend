import React from "react";
import { BrandLogo } from "./BrandLogo";

export interface BrandLoaderProps {
  /** Application name under the wordmark, e.g. "Attack", "Defend", "Core". */
  label?: string;
  /** Status line under the mark. Defaults to "Verifying access". */
  message?: string;
}

/**
 * Full-screen branded boot screen.
 *
 * Every application verifies the stored session (and the operator's access to
 * it) before rendering anything, so there is always a short gate. This is what
 * the operator sees during that window: the mark alive — a rotating gold arc, a
 * breathing halo and an indeterminate sweep — instead of a bare spinner on a
 * blank page. Theme-aware (white canvas + dark ink in light mode) and it honours
 * `prefers-reduced-motion`.
 */
export function BrandLoader({ label, message = "Verifying access" }: BrandLoaderProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-phantix-950 px-6">
      <style>{`
        @keyframes sg-loader-spin { to { transform: rotate(360deg); } }
        @keyframes sg-loader-sweep { 0% { transform: translateX(-130%); } 100% { transform: translateX(280%); } }
        @keyframes sg-loader-glow { 0%, 100% { opacity: .28; transform: scale(1); } 50% { opacity: .62; transform: scale(1.08); } }
        @keyframes sg-loader-dot { 0%, 80%, 100% { opacity: .25; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }
        @media (prefers-reduced-motion: reduce) {
          .sg-loader-anim { animation: none !important; }
        }
      `}</style>

      {/* Ambient brand field */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="sg-loader-anim absolute left-1/2 top-1/2 h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-400/[0.07] blur-[110px]"
          style={{ animation: "sg-loader-glow 3.2s ease-in-out infinite" }}
        />
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "linear-gradient(rgb(var(--border-subtle) / 0.5) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--border-subtle) / 0.5) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse 55% 45% at 50% 46%, black, transparent)",
            WebkitMaskImage: "radial-gradient(ellipse 55% 45% at 50% 46%, black, transparent)",
          }}
        />
      </div>

      <div role="status" aria-live="polite" className="relative flex flex-col items-center">
        {/* Brand mark + rotating arc */}
        <div className="relative flex h-28 w-28 items-center justify-center">
          <span className="absolute inset-0 rounded-full border border-phantix-700/60" />
          <span
            className="sg-loader-anim absolute inset-0 rounded-full"
            style={{
              animation: "sg-loader-spin 1.15s linear infinite",
              background:
                "conic-gradient(from 90deg, transparent 0deg, transparent 205deg, rgb(var(--gold-400) / 0.16) 275deg, rgb(var(--gold-400) / 0.95) 360deg)",
              WebkitMask:
                "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
              mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))",
            }}
          />
          <span
            className="sg-loader-anim absolute inset-[26px] rounded-full bg-gold-400/10 blur-md"
            style={{ animation: "sg-loader-glow 2.6s ease-in-out infinite" }}
          />
          <BrandLogo className="relative h-14 w-14" />
        </div>

        {/* Wordmark */}
        <div className="mt-7 text-center">
          <p className="font-display text-[15px] font-bold tracking-tight text-white">SecureGraph</p>
          {label ? (
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-gold-400">
              {label}
            </p>
          ) : null}
        </div>

        {/* Indeterminate sweep */}
        <div className="mt-6 h-px w-44 overflow-hidden rounded-full bg-phantix-800">
          <span
            className="sg-loader-anim block h-full w-1/2 rounded-full bg-gradient-to-r from-transparent via-gold-400 to-transparent"
            style={{ animation: "sg-loader-sweep 1.5s cubic-bezier(0.45, 0, 0.55, 1) infinite" }}
          />
        </div>

        {/* Status */}
        <p className="mt-4 inline-flex items-center gap-2 text-xs text-slate-500">
          {message}
          <span className="inline-flex gap-1" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="sg-loader-anim h-1 w-1 rounded-full bg-gold-400/80"
                style={{ animation: `sg-loader-dot 1.2s ease-in-out ${i * 0.15}s infinite` }}
              />
            ))}
          </span>
        </p>
      </div>
    </div>
  );
}

export default BrandLoader;
