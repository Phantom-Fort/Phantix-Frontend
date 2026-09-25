import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ShieldCheck, ArrowRight, PlayCircle, LogIn, CheckCircle2, Sparkles,
  Building2, Eye, Repeat2, BookOpen,
} from "lucide-react";
import { useStore } from "@sg/store";
import { loadPricing, pricingFootnote, yearlySavePercent } from "@sg/pricing";
import type { PricingTier } from "@sg/pricing";
import { LANDING_URL, PLATFORM_URL } from "@sg/links";
import { cx } from "@sg/utils";
import { ThemeToggle } from "@sg/ThemeToggle";
import { BrandMark, BrandWordmark } from "@sg/components/BrandLogo";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as const },
});

export default function Home() {
  const { session, enterDemo, demoActive } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");

  // A signed-in operator belongs at the application picker, not in Core's
  // dashboard: Core is one of four applications, not the default destination.
  // The demo is the exception — it has one application and no choice to make.
  useEffect(() => {
    if (session?.authenticated || demoActive) {
      navigate("/choose-app", { replace: true });
    }
  }, [session, demoActive, navigate]);

  // Load real pricing from API
  useEffect(() => { loadPricing().then(setPricingTiers); }, []);

  // Landing-page deep link: app.phantixlabs.com/?demo=1 → straight into the demo
  useEffect(() => {
    if (params.get("demo") === "1") { enterDemo(); navigate("/choose-app", { replace: true }); }
  }, [params, enterDemo, navigate]);

  const goDemo = () => {
    // The demo walks the whole product, not just Core, so it starts at the
    // picker like any other operator.
    enterDemo();
    navigate("/choose-app");
  };

  // The pricing table matches the landing page: three paid cards carry the grid
  // (Starter / Growth / Enterprise) and Free is promoted below it.
  const freeTier = pricingTiers.find((t) => t.id === "free");
  const paidTiers = (["starter", "growth", "enterprise"] as const)
    .map((id) => pricingTiers.find((t) => t.id === id))
    .filter((t): t is PricingTier => Boolean(t));

  return (
    <div className="relative min-h-screen overflow-x-clip">
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-grid-faint bg-grid [mask-image:radial-gradient(ellipse_75%_60%_at_50%_0%,black,transparent)]" />
        <div className="absolute -top-32 left-1/2 h-[480px] w-[820px] -translate-x-1/2 rounded-full bg-phantix-600/20 blur-[130px]" />
      </div>

      {/* Nav */}
      <header className="relative z-10 border-b border-white/5">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
          <div className="flex flex-col">
            <BrandWordmark className="h-8 self-start" />
            <p className="mt-0.5 pl-[2.25rem] text-[12px] font-semibold uppercase tracking-[0.22em] text-gold-400">Command Centre</p>
          </div>
          <nav className="ml-10 hidden items-center gap-6 text-sm text-slate-400 md:flex">
            <a href="#pricing" className="transition-colors hover:text-white">Pricing</a>
            <Link to="/docs" className="transition-colors hover:text-white">Docs</Link>
            <Link to="/sandbox-apply" className="transition-colors hover:text-white">Sandbox</Link>
            <a href={PLATFORM_URL} className="transition-colors hover:text-white">Platform</a>
          </nav>
          <div className="ml-auto flex items-center gap-2.5">
            <ThemeToggle />
            {session?.authenticated ? (
              <Link to="/choose-app" className="btn-primary !py-2">Open console <ArrowRight size={15} /></Link>
            ) : (
              <>
                <Link to="/login" className="btn-ghost !py-2"><LogIn size={15} /> Sign in</Link>
                <button onClick={goDemo} className="btn-primary !py-2"><PlayCircle size={15} /> Live demo</button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-16 pt-20 text-center">
        <motion.div {...fadeUp(0)} className="mx-auto inline-flex items-center gap-2 rounded-full border border-gold-400/25 bg-gold-400/8 px-4 py-1.5 text-xs font-medium text-gold-300">
          <ShieldCheck size={13} /> app.phantixlabs.com --- the operator console
        </motion.div>

        <motion.h1 {...fadeUp(0.08)} className="mx-auto mt-6 max-w-3xl font-display text-[42px] font-bold leading-[1.06] tracking-tight text-white sm:text-[56px]">
          Your security operations,{" "}
          <span className="bg-gradient-to-r from-gold-300 via-gold-400 to-gold-600 bg-clip-text text-transparent">
            in one command centre
          </span>
        </motion.h1>

        <motion.p {...fadeUp(0.16)} className="mx-auto mt-5 max-w-xl text-[16px] leading-7 text-slate-400">
          Assets, scans, VAPT campaigns, risks, compliance and verified-only reports --- running against a
          privacy-first platform where your data never leaves your database.
        </motion.p>

        <motion.div {...fadeUp(0.24)} className="mt-9 flex flex-wrap items-center justify-center gap-3.5">
          <button onClick={goDemo} className="btn-primary !px-7 !py-3.5 !text-[15px]">
            <PlayCircle size={17} /> Explore the live demo
          </button>
          <Link to="/login" className="btn-secondary !px-7 !py-3.5 !text-[15px]">
            <LogIn size={16} /> Sign in with your organization
          </Link>
        </motion.div>

        <motion.p {...fadeUp(0.3)} className="mt-4 text-xs text-slate-600">
          {demoActive ? "Demo mode is active in this browser --- jump back in above." : "No account needed for the demo --- full product, simulated tenant."}
        </motion.p>
      </section>

      {/* How the demo works */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20">
        <motion.div {...fadeUp(0.1)} className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              icon: <Eye size={18} />,
              step: "01",
              title: "Explore the demo tenant",
              body: "A fully simulated organization --- Acme Financial Group --- with assets, an active campaign, risks, compliance scores and reports.",
            },
            {
              icon: <CheckCircle2 size={18} />,
              step: "02",
              title: "Check every module",
              body: "Run the scan lock UX, inspect the verification gate, walk the P1---P5 priority queue, download report formats.",
            },
            {
              icon: <Repeat2 size={18} />,
              step: "03",
              title: "Switch to your organization",
              body: "One click from the demo banner swaps you to the live sign-in --- your real tenant, your real data, same console.",
            },
          ].map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.15 + i * 0.08 }}
              className="card relative overflow-hidden p-6"
            >
              <span className="absolute right-4 top-4 font-display text-4xl font-bold text-phantix-700/50">{s.step}</span>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-400/15 text-gold-400">{s.icon}</span>
              <h3 className="mt-4 font-display text-base font-semibold text-white">{s.title}</h3>
              <p className="mt-2 text-[13px] leading-6 text-slate-400">{s.body}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative z-10 mx-auto max-w-6xl scroll-mt-20 px-6 pb-24">
        <motion.div {...fadeUp(0)} className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-400">Pricing</p>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-white">Simple, per-company pricing</h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-7 text-slate-400">
            Every tier includes the privacy-first architecture, dual control and the immutable audit trail.
            Plan and rate limits bind to the company --- all its users and keys share the bucket.
          </p>
        </motion.div>

        {/* Monthly / annual toggle — annual is 10× monthly ("pay 10, get 12"). */}
        <motion.div {...fadeUp(0.05)} className="mt-8 flex justify-center">
          <div
            role="tablist"
            aria-label="Billing cycle"
            className="inline-flex items-center gap-0.5 rounded-full border border-phantix-700/50 bg-phantix-900/60 p-1"
          >
            {(["monthly", "yearly"] as const).map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={cycle === c}
                onClick={() => setCycle(c)}
                className={cx(
                  "rounded-full px-5 py-2 text-sm font-semibold transition-colors duration-200",
                  cycle === c ? "bg-phantix-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300",
                )}
              >
                {c === "monthly" ? "Monthly" : "Annual"}
              </button>
            ))}
            {cycle === "yearly" && (
              <span className="ml-1 inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-gold-400/50 bg-gold-400/15 px-3 py-1 text-[12px] font-bold uppercase tracking-wider text-gold-300">
                Save ~{yearlySavePercent()}% · 2 months free
              </span>
            )}
          </div>
        </motion.div>

        {/* Paid plan cards */}
        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3 lg:gap-8">
          {paidTiers.map((t, i) => {
            const monthly = t.monthly_ngn;
            const yearly = cycle === "yearly" && t.yearly_price_ngn != null && t.yearly_price_ngn > 0;
            const elevated = Boolean(t.highlighted) || t.id === "growth";
            const custom = monthly === null;
            const priceBig = custom
              ? "Custom"
              : monthly === 0
                ? "NGN 0"
                : yearly
                  ? `₦${(t.yearly_price_ngn ?? 0).toLocaleString()}`
                  : `₦${monthly.toLocaleString()}`;
            const priceSuffix = custom || monthly === 0 ? "" : yearly ? "/yr" : "/mo";

            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.55, delay: i * 0.09 }}
                className={cx(
                  "card relative flex flex-col p-7",
                  elevated
                    ? "z-10 border-gold-400/60 bg-gradient-to-b from-phantix-850 to-phantix-900 shadow-glow lg:-translate-y-4"
                    : "bg-gradient-to-b from-phantix-900/80 to-phantix-900/40",
                )}
              >
                {elevated && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-gold-400 to-gold-600 px-4 py-1 text-[12px] font-bold uppercase tracking-wider text-phantix-950 shadow-glow">
                    {t.badge ?? "Most popular"}
                  </span>
                )}

                <h3 className="font-display text-xl font-bold tracking-tight text-white">{t.name}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-400">{t.tagline}</p>

                <div className="mt-5 border-t border-phantix-700/40 pt-5">
                  <div className="flex items-baseline gap-1.5">
                    <span className={cx("font-display font-bold tracking-tight tabular-nums text-white", custom ? "text-3xl" : "text-4xl")}>
                      {priceBig}
                    </span>
                    {priceSuffix && <span className="text-sm font-medium text-slate-500">{priceSuffix}</span>}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {custom ? (
                      <>{t.heroUnit || "Custom AI credits & volume"} — scoped and quoted per organization</>
                    ) : yearly ? (
                      <>Billed once a year — that&rsquo;s ≈₦{Math.round((t.yearly_price_ngn ?? 0) / 12).toLocaleString()}/mo</>
                    ) : (
                      <>
                        {t.heroMetric} AI credits / month
                        {t.first_month_ngn != null && t.first_month_ngn > 0 && (
                          <>
                            {" · "}
                            <span className="text-emerald-400/90">first month ₦{t.first_month_ngn.toLocaleString()}</span>
                          </>
                        )}
                      </>
                    )}
                  </p>
                </div>

                <ul className="mt-6 flex-1 space-y-3">
                  {t.features.slice(0, 5).map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[13px] leading-5 text-slate-300">
                      <CheckCircle2 size={15} className={cx("mt-0.5 shrink-0", elevated ? "text-gold-400" : "text-emerald-400")} />
                      {f}
                    </li>
                  ))}
                </ul>

                <a
                  href={`${PLATFORM_URL}/register`}
                  className={cx("mt-8 w-full", elevated ? "btn-primary" : "btn-secondary")}
                >
                  {t.cta} <ArrowRight size={14} />
                </a>
              </motion.div>
            );
          })}
        </div>

        {/* Free is a promo below the grid, not a card. */}
        <motion.div {...fadeUp(0.1)} className="mt-10 flex justify-center">
          <a href={`${PLATFORM_URL}/register`} className="btn-secondary !px-6">
            <Sparkles size={15} className="text-gold-400" />
            {freeTier?.cta ?? "Start free"} — no card required
          </a>
        </motion.div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-5 text-slate-600">{pricingFootnote}</p>
      </section>

      {/* Surfaces band */}
      <section className="relative z-10 border-t border-phantix-700/30 py-14">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-6 md:grid-cols-3">
          {[
            { host: "phantixlabs.com", name: "Landing", desc: "Product story and company", url: LANDING_URL, icon: <Sparkles size={16} /> },
            { host: "platform.phantixlabs.com", name: "Platform", desc: "Onboarding, keys, people, billing", url: PLATFORM_URL, icon: <Building2 size={16} /> },
            { host: "app.phantixlabs.com", name: "Command Centre", desc: "The operator console --- you are here", url: null, icon: <ShieldCheck size={16} /> },
          ].map((s) => (
            <div key={s.host} className={cx("card flex items-center gap-4 p-5", !s.url && "border-gold-400/30")}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-phantix-800/70 text-gold-400">{s.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[13px] font-semibold text-slate-100">{s.host}</p>
                <p className="text-xs text-slate-500">{s.desc}</p>
              </div>
              {s.url && (
                <a href={s.url} className="text-gold-400 hover:text-gold-300"><ArrowRight size={16} /></a>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-phantix-700/30 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 text-xs text-slate-600">
          <div className="flex items-center gap-2.5">
            <BrandMark alt="" className="h-6 w-6" />
            <span>© 2026 Phantix Security Solutions</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/docs" className="flex items-center gap-1.5 hover:text-slate-300"><BookOpen size={12} /> Documentation</Link>
            <a href={LANDING_URL} className="hover:text-slate-300">phantixlabs.com</a>
            <a href={PLATFORM_URL} className="hover:text-slate-300">platform.phantixlabs.com</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
