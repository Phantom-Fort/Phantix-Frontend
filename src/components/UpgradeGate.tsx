import React from "react";
import { Sparkles, Sparkle, UserCog } from "lucide-react";
import { Card } from "@/components/ui";
import { upsellFor, isFreePlan } from "@/lib/entitlements";
import { useEntitlements } from "@/lib/useEntitlements";
import { cx } from "@/lib/utils";

// ── Upgrade surfaces ─────────────────────────────────────────────────────────
// Two shapes, used deliberately:
//
//  • <UpgradeGate>   replaces a page a plan cannot use at all. It explains what
//                    was blocked and never a dead end.
//  • <UpsellBanner>  sits at the top of a page that still works, when only part
//                    of it needs a higher plan.
//
// Operators sign in here with a login link, not a company password, so they
// have no way to reach the Platform's billing page even if we sent them there.
// Plan purchase is a company-admin action — both surfaces point at the admin,
// not at a redirect an operator can't complete.

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
  return (
    <Card className={cx("mx-auto max-w-2xl text-center", className)}>
      <div className="flex flex-col items-center gap-3 py-6">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-400/10 text-gold-400">
          <Sparkles size={22} />
        </span>
        <h2 className="font-display text-lg font-semibold text-white">{heading}</h2>
        <p className="max-w-md text-sm leading-6 text-slate-400">{detail}</p>
        <p className="mt-2 flex items-center gap-2 rounded-md border border-gold-400/30 bg-gold-400/[0.08] px-4 py-2.5 text-sm font-medium text-gold-200">
          <UserCog size={16} className="shrink-0 text-gold-300" />
          Ask your organization admin to upgrade the plan
        </p>
        <p className="text-[11px] text-slate-500">
          Plan changes and billing are managed on the Platform by your company admin. Cards are charged per company —
          nothing you have already configured is lost while you wait.
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
      <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-gold-300">
        <UserCog size={13} /> Ask your admin to upgrade
      </span>
    </div>
  );
}

export default UpgradeGate;
