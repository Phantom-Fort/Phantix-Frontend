import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Check, Loader2, Lock, Sparkles } from "lucide-react";
import { PageHeader, Card, CardHeader, PageSkeleton, ErrorState } from "@/components/ui";
import DocLink from "@/components/DocLink";
import { useStore } from "@/lib/store";
import { loadPricing, pricingFootnote, type PricingTier } from "@/lib/pricing";
import {
  UPSELL_FEATURES,
  gatesActive,
  isFreePlan,
  loadEntitlements,
  planLabel,
  startCheckout,
  upsellFor,
  type Entitlements,
} from "@/lib/entitlements";
import { cx } from "@/lib/utils";

// ── Plans & upgrade ──────────────────────────────────────────────────────────
// The app's half of one pricing catalog: the same tiers, features and footnote
// the landing page renders, read from the same GET /billing/plans. It adds what
// only the app can know — your current plan, how much Free headroom is left, and
// a checkout that actually charges.
//
// Every upsell link in the app lands here with ?feature=<key>, so the first thing
// on the page is *what you were trying to do*, not a generic pitch.

const PLAN_ORDER = ["free", "starter", "growth", "enterprise"];

export default function Plans() {
  const { toast } = useStore();
  const [params] = useSearchParams();
  const featureKey = params.get("feature");
  const reason = params.get("reason");
  const returned = params.get("checkout") === "return";

  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [busyPlan, setBusyPlan] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [t, e] = await Promise.all([
        loadPricing(),
        loadEntitlements().catch(() => null),
      ]);
      setTiers(Array.isArray(t) ? t : []);
      setEnt(e);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load plans");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (returned) {
      toast("info", "Checking your payment", "If the charge succeeded, your plan updates within a moment.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [returned]);

  const ordered = useMemo(() => {
    const byId = new Map(tiers.map((t) => [t.id, t]));
    return PLAN_ORDER.map((id) => byId.get(id)).filter((t): t is PricingTier => Boolean(t));
  }, [tiers]);

  const currentPlan = String(ent?.plan ?? "free").toLowerCase();
  const up = upsellFor(featureKey);
  const lockedFeatures = useMemo(() => Object.values(UPSELL_FEATURES), []);

  const checkout = async (planId: string) => {
    setBusyPlan(planId);
    try {
      const url = await startCheckout(cycle);
      window.location.href = url;
    } catch (e) {
      toast("error", "Could not start checkout", e instanceof Error ? e.message : undefined);
      setBusyPlan(null);
    }
  };

  if (loading && !tiers.length) return <PageSkeleton />;
  if (error) return <ErrorState title="Plans unavailable" body={error} onRetry={() => void load()} />;

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        title="Plans & billing"
        description="One catalog, shared with the website. Plan limits bind to the company — every user and key shares the same bucket."
        actions={
          <span className="flex items-center gap-2">
            <DocLink docId="hc-plans-billing" label="Plans & billing guide" />
            <span className="chip border-phantix-700 text-slate-300">
              Current plan: <span className="ml-1 font-semibold text-white">{planLabel(currentPlan)}</span>
            </span>
          </span>
        }
      />

      {/* What you tried to do — the reason this page opened. */}
      {(up || reason) && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-md border border-gold-400/30 bg-gold-400/[0.08] px-4 py-3">
          <Lock size={15} className="shrink-0 text-gold-300" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gold-200">
              {up ? `${up.label} needs ${planLabel(up.plan)}` : "Upgrade required"}
            </p>
            <p className="mt-0.5 text-[11px] leading-5 text-gold-100/85">
              {up?.blurb || reason || "This action needs a higher plan."}
            </p>
          </div>
        </div>
      )}

      {returned && (
        <p className="mb-5 rounded-md border border-emerald-400/25 bg-emerald-400/[0.07] px-4 py-2.5 text-[11px] text-emerald-200">
          Payment submitted. Refresh in a moment if the plan has not changed yet — the webhook confirms asynchronously.
        </p>
      )}

      {/* Free headroom, so the ask is concrete rather than abstract. */}
      {ent && gatesActive(ent) && (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Plan" value={planLabel(ent.plan)} tone={isFreePlan(ent) ? "warn" : "ok"} />
          <Stat
            label="Free assets left"
            value={ent.assets_remaining_free == null ? "—" : String(ent.assets_remaining_free)}
            tone={ent.assets_remaining_free === 0 ? "warn" : "plain"}
          />
          <Stat
            label="Free users left"
            value={ent.org_users_remaining_free == null ? "—" : String(ent.org_users_remaining_free)}
            tone={ent.org_users_remaining_free === 0 ? "warn" : "plain"}
          />
          <Stat
            label="Credits / month"
            value={String(ent.billing_enforcement?.premium_ai_quota_monthly ?? "—")}
            tone="plain"
          />
        </div>
      )}

      {/* Billing cycle */}
      <div className="mb-6 flex justify-center">
        <div className="inline-flex items-center gap-0.5 rounded-full border border-phantix-700/50 bg-phantix-900/60 p-1" role="tablist" aria-label="Billing cycle">
          {(["monthly", "yearly"] as const).map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={cycle === c}
              onClick={() => setCycle(c)}
              className={cx(
                "rounded-full px-5 py-2 text-sm font-semibold transition-colors",
                cycle === c ? "bg-phantix-800 text-white" : "text-slate-500 hover:text-slate-300",
              )}
            >
              {c === "monthly" ? "Monthly" : "Annual"}
            </button>
          ))}
          {cycle === "yearly" && (
            <span className="ml-1 rounded-full border border-gold-400/50 bg-gold-400/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-gold-300">
              2 months free
            </span>
          )}
        </div>
      </div>

      {/* Tiers — same catalog as the website */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {ordered.map((t, i) => {
          const isCurrent = t.id === currentPlan;
          const monthly = t.monthly_ngn;
          const price =
            monthly === null
              ? "Custom"
              : monthly === 0
                ? "NGN 0"
                : cycle === "yearly" && t.yearly_price_ngn
                  ? `NGN ${t.yearly_price_ngn.toLocaleString()}`
                  : `NGN ${monthly.toLocaleString()}`;
          const suffix = monthly === null || monthly === 0 ? "" : cycle === "yearly" ? "/yr" : "/mo";

          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cx(
                "card flex flex-col p-5",
                (t.highlighted || t.id === "growth") && "ring-1 ring-gold-400/40",
                isCurrent && "border-emerald-400/40",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-sm font-semibold text-white">{t.name}</p>
                {isCurrent ? (
                  <span className="chip border-emerald-400/30 bg-emerald-400/10 text-emerald-400">Current</span>
                ) : t.id === "growth" ? (
                  <span className="chip border-gold-400/30 bg-gold-400/10 text-gold-300">Most popular</span>
                ) : null}
              </div>
              <p className="font-display mt-3 text-2xl font-bold text-white">
                {price}
                <span className="ml-1 text-xs font-normal text-slate-500">{suffix}</span>
              </p>
              <p className="mt-1 text-[11px] leading-5 text-slate-500">{t.tagline}</p>
              {monthly !== null && monthly > 0 && t.first_month_ngn ? (
                <p className="mt-1 text-[11px] text-emerald-400/90">
                  First month NGN {t.first_month_ngn.toLocaleString()}
                </p>
              ) : null}

              <ul className="mt-4 flex-1 space-y-1.5">
                {t.features.slice(0, 7).map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-[11px] leading-5 text-slate-400">
                    <Check size={11} className="mt-1 shrink-0 text-emerald-400" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4">
                {isCurrent ? (
                  <button disabled className="btn-ghost w-full !py-2 text-xs opacity-60">
                    Your current plan
                  </button>
                ) : t.id === "free" ? (
                  <Link to="/dashboard" className="btn-ghost w-full !py-2 text-xs">
                    Continue on Free
                  </Link>
                ) : t.id === "starter" ? (
                  <button
                    onClick={() => void checkout(t.id)}
                    disabled={busyPlan === t.id}
                    className="btn-primary w-full !py-2 text-xs"
                  >
                    {busyPlan === t.id ? (
                      <Loader2 size={13} className="mr-1.5 inline animate-spin" />
                    ) : (
                      <Sparkles size={13} className="mr-1.5 inline" />
                    )}
                    Subscribe &amp; pay
                  </button>
                ) : (
                  <Link to="/support" className="btn-secondary w-full !py-2 text-center text-xs">
                    Talk to us <ArrowRight size={12} className="ml-1 inline" />
                  </Link>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-5 text-slate-500">{pricingFootnote}</p>

      {/* Strategic upsell — exactly what Free cannot do, and what unlocks it. */}
      <Card className="mt-8">
        <CardHeader title="What Free cannot do" subtitle="Each line names the plan that unlocks it" />
        <div className="divide-y divide-phantix-800/50">
          {lockedFeatures.map((f) => (
            <div key={f.key} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-200">{f.label}</p>
                <p className="text-[11px] leading-5 text-slate-500">{f.blurb}</p>
              </div>
              <span className="chip shrink-0 border-gold-400/30 text-gold-300">
                {f.plan === "engagement" ? "Engagement" : planLabel(f.plan)}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "plain",
}: {
  label: string;
  value: string;
  tone?: "plain" | "ok" | "warn";
}) {
  return (
    <div className="rounded-md border border-phantix-700/50 bg-phantix-900/40 px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p
        className={cx(
          "mt-1 font-display text-lg font-semibold",
          tone === "warn" ? "text-severity-medium" : tone === "ok" ? "text-emerald-400" : "text-white",
        )}
      >
        {value}
      </p>
    </div>
  );
}
