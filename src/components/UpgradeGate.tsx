import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, Sparkle } from "lucide-react";
import { Card } from "@/components/ui";
import { upsellFor, isFreePlan } from "@/lib/entitlements";
import { useEntitlements } from "@/lib/useEntitlements";
import { cx } from "@/lib/utils";

// ── Upgrade surfaces ─────────────────────────────────────────────────────────
// Two shapes, used deliberately:
//
//  • <UpgradeGate>   replaces a page a plan cannot use at all. It explains what
//                    was blocked and routes to payment — never a dead end.
//  • <UpsellBanner>  sits at the top of a page that still works, when only part
//                    of it needs a higher plan.
//
// Both link to /plans with the feature key, so the pricing page can say "this is
// what you were trying to do" instead of a generic pitch.

export function UpgradeGate({
  feature,
  title,
  body,
  className,
}: {
  feature?: string;
  title?: string;
  body?: string;
  className?: string;
}) {
  const up = upsellFor(feature);
  const heading = title ?? up?.label ?? "This surface needs a paid plan";
  const detail =
    body ??
    up?.blurb ??
    "Your current plan does not include this. Upgrading unlocks it immediately — nothing you have already configured is lost.";
  const to = feature ? `/plans?feature=${encodeURIComponent(feature)}` : "/plans";

  return (
    <Card className={cx("mx-auto max-w-2xl text-center", className)}>
      <div className="flex flex-col items-center gap-3 py-6">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-400/10 text-gold-400">
          <Sparkles size={22} />
        </span>
        <h2 className="font-display text-lg font-semibold text-white">{heading}</h2>
        <p className="max-w-md text-sm leading-6 text-slate-400">{detail}</p>
        <Link to={to} className="btn-primary mt-2 !px-5 !py-2 text-sm">
          See plans &amp; upgrade <ArrowRight size={15} className="ml-1.5 inline" />
        </Link>
        <p className="text-[11px] text-slate-500">
          Cards are charged per company; AI work is metered as credits. Viewing and exporting is never billed.
        </p>
      </div>
    </Card>
  );
}

export function UpsellBanner({
  feature,
  title,
  body,
  className,
  force = false,
}: {
  feature: string;
  title?: string;
  body?: string;
  className?: string;
  /** Show even on a paid plan (default: only while the org is on Free). */
  force?: boolean;
}) {
  const { ent, loading } = useEntitlements();
  const up = upsellFor(feature);
  // Don't flash an upsell at a paying customer while the snapshot loads.
  if (!force && (loading || !isFreePlan(ent))) return null;
  if (!up && !title) return null;
  const label = title ?? up?.label ?? "Unlock with an upgrade";
  const detail = body ?? up?.blurb ?? "";
  const to = `/plans?feature=${encodeURIComponent(feature)}`;

  return (
    <div
      className={cx(
        "mb-4 flex flex-wrap items-center gap-3 rounded-md border border-gold-400/30 bg-gold-400/[0.07] px-3.5 py-2.5",
        className,
      )}
    >
      <Sparkle size={14} className="shrink-0 text-gold-300" />
      <p className="min-w-0 flex-1 text-[11px] leading-5 text-gold-100/90">
        <span className="font-semibold text-gold-200">{label}.</span> {detail}
      </p>
      <Link to={to} className="btn-secondary shrink-0 !px-3 !py-1.5 !text-xs">
        Upgrade <ArrowRight size={12} className="ml-1 inline" />
      </Link>
    </div>
  );
}

export default UpgradeGate;
