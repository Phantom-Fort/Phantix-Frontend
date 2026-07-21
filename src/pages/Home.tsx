import React, { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ShieldCheck, ArrowRight, PlayCircle, LogIn, CheckCircle2, Sparkles,
  Building2, Eye, Repeat2, BookOpen,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { pricingTiers, pricingFootnote } from "@/lib/pricing";
import { LANDING_URL, PLATFORM_URL } from "@/lib/links";
import { cx } from "@/lib/utils";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as const },
});

export default function Home() {
  const { session, enterDemo, demoActive } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // Landing-page deep link: app.phantix.site/?demo=1 → straight into the demo
  useEffect(() => {
    if (params.get("demo") === "1") {
      enterDemo();
      navigate("/dashboard", { replace: true });
    }
  }, [params, enterDemo, navigate]);

  const goDemo = () => {
    enterDemo();
    navigate("/dashboard");
  };

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
          <img src="/logo-transparent.png" alt="Phantix" className="h-9 w-9 object-contain" />
          <div className="leading-tight">
            <p className="font-display text-[15px] font-bold text-white">Phantix</p>
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-gold-400">Command Centre</p>
          </div>
          <nav className="ml-10 hidden items-center gap-6 text-sm text-slate-400 md:flex">
            <a href="#pricing" className="transition-colors hover:text-white">Pricing</a>
            <Link to="/docs" className="transition-colors hover:text-white">Docs</Link>
            <a href={PLATFORM_URL} className="transition-colors hover:text-white">Platform</a>
          </nav>
          <div className="ml-auto flex items-center gap-2.5">
            {session?.authenticated ? (
              <Link to="/dashboard" className="btn-primary !py-2">Open console <ArrowRight size={15} /></Link>
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
          <ShieldCheck size={13} /> app.phantix.site — the operator console
        </motion.div>

        <motion.h1 {...fadeUp(0.08)} className="mx-auto mt-6 max-w-3xl font-display text-[42px] font-bold leading-[1.06] tracking-tight text-white sm:text-[56px]">
          Your security operations,{" "}
          <span className="bg-gradient-to-r from-gold-300 via-gold-400 to-gold-600 bg-clip-text text-transparent">
            in one command centre
          </span>
        </motion.h1>

        <motion.p {...fadeUp(0.16)} className="mx-auto mt-5 max-w-xl text-[16px] leading-7 text-slate-400">
          Assets, scans, VAPT campaigns, risks, compliance and verified-only reports — running against a
          privacy-first backend where your data never leaves your database.
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
          {demoActive ? "Demo mode is active in this browser — jump back in above." : "No account needed for the demo — full product, simulated tenant."}
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
              body: "A fully simulated organization — Acme Financial Group — with assets, an active campaign, risks, compliance scores and reports.",
            },
            {
              icon: <CheckCircle2 size={18} />,
              step: "02",
              title: "Check every module",
              body: "Run the scan lock UX, inspect the verification gate, walk the P1–P5 priority queue, download report formats.",
            },
            {
              icon: <Repeat2 size={18} />,
              step: "03",
              title: "Switch to your organization",
              body: "One click from the demo banner swaps you to the live sign-in — your real tenant, your real data, same console.",
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
            Plan and rate limits bind to the company — all its users and keys share the bucket.
          </p>
        </motion.div>

        <div className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {pricingTiers.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.55, delay: i * 0.09 }}
              className={cx(
                "card relative flex flex-col p-7",
                t.highlighted && "border-gold-400/50 shadow-glow lg:-my-3 lg:py-10",
              )}
            >
              {t.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-gold-400 to-gold-600 px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-phantix-950">
                  Most popular
                </span>
              )}
              <h3 className="font-display text-xl font-bold text-white">{t.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{t.tagline}</p>
              <div className="mt-5">
                {t.monthly_ngn !== null ? (
                  <>
                    <span className="font-display text-4xl font-bold text-white">₦{t.monthly_ngn.toLocaleString()}</span>
                    <span className="text-sm text-slate-500">/month</span>
                    {t.first_month_ngn != null && (
                      <p className="mt-1 text-xs text-emerald-400">First month ₦{t.first_month_ngn.toLocaleString()} — 50% off</p>
                    )}
                    {t.yearly_note && <p className="mt-0.5 text-[11px] text-slate-600">{t.yearly_note}</p>}
                  </>
                ) : (
                  <span className="font-display text-4xl font-bold text-white">Custom</span>
                )}
              </div>
              <ul className="mt-6 flex-1 space-y-2.5">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13px] leading-5 text-slate-300">
                    <CheckCircle2 size={14} className={cx("mt-0.5 shrink-0", t.highlighted ? "text-gold-400" : "text-emerald-400")} />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={`${PLATFORM_URL}/register`}
                className={cx("mt-7 w-full", t.highlighted ? "btn-primary" : "btn-secondary")}
              >
                {t.cta} <ArrowRight size={14} />
              </a>
            </motion.div>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-5 text-slate-600">{pricingFootnote}</p>
      </section>

      {/* Surfaces band */}
      <section className="relative z-10 border-t border-phantix-700/30 py-14">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-6 md:grid-cols-3">
          {[
            { host: "phantix.site", name: "Landing", desc: "Product story and company", url: LANDING_URL, icon: <Sparkles size={16} /> },
            { host: "platform.phantix.site", name: "Platform", desc: "Onboarding, keys, people, billing", url: PLATFORM_URL, icon: <Building2 size={16} /> },
            { host: "app.phantix.site", name: "Command Centre", desc: "The operator console — you are here", url: null, icon: <ShieldCheck size={16} /> },
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
            <img src="/logo-transparent.png" alt="" className="h-6 w-6 object-contain" />
            <span>© 2026 Phantix Security Solutions</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/docs" className="flex items-center gap-1.5 hover:text-slate-300"><BookOpen size={12} /> Documentation</Link>
            <a href={LANDING_URL} className="hover:text-slate-300">phantix.site</a>
            <a href={PLATFORM_URL} className="hover:text-slate-300">platform.phantix.site</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
