import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Search, BookOpen, ArrowRight, FileText } from "lucide-react";
import { docs, docCategories } from "@/lib/docs";
import { cx } from "@/lib/utils";

export default function Docs() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");

  const results = useMemo(() => {
    const needle = q.toLowerCase().trim();
    return docs.filter((d) => {
      const inCat = cat === "all" || d.category === cat;
      if (!inCat) return false;
      if (!needle) return true;
      return (
        d.title.toLowerCase().includes(needle) ||
        d.description.toLowerCase().includes(needle) ||
        d.content.toLowerCase().includes(needle)
      );
    });
  }, [q, cat]);

  const featured = docs.filter((d) => d.badge);

  return (
    <div className="mx-auto max-w-[1200px]">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative mb-10 overflow-hidden rounded-3xl border border-phantix-700/40 bg-gradient-to-b from-phantix-800/60 to-phantix-900/60 px-8 py-12">
        <div className="pointer-events-none absolute inset-0 bg-grid-faint bg-grid opacity-30 [mask-image:radial-gradient(ellipse_60%_80%_at_50%_0%,black,transparent)]" />
        <div className="relative max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold-400">Phantix documentation</p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-white">
            Every guide, in one place
          </h1>
          <p className="mt-3 text-[15px] leading-7 text-slate-400">
            The complete implementation canon — auth realms, surface contracts, module deep-dives and the
            326-route API catalog — rendered from the engineering repository.
          </p>
          <div className="relative mt-6 max-w-lg">
            <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              className="input !py-3.5 !pl-11 !text-[15px]"
              placeholder="Search the docs — try 'dual control' or 'verification gate'…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
      </motion.div>

      {/* Category filter */}
      <div className="mb-8 flex flex-wrap gap-2">
        {[{ id: "all", label: "All guides" }, ...docCategories].map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            className={cx(
              "rounded-xl border px-4 py-2 text-sm font-medium transition-all",
              cat === c.id
                ? "border-gold-400/50 bg-gold-400/12 text-gold-300 shadow-glow"
                : "border-phantix-700/50 text-slate-400 hover:border-phantix-500/50 hover:text-slate-200",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Featured (only when unfiltered) */}
      {!q && cat === "all" && (
        <div className="mb-10">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Start with these</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {featured.map((d, i) => (
              <motion.div key={d.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                <Link to={`/docs/${d.id}`} className="card group block h-full border-gold-400/20 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-gold-400/50 hover:shadow-glow">
                  <span className="chip border-gold-400/30 bg-gold-400/10 text-gold-300">{d.badge}</span>
                  <h3 className="mt-3 font-display text-base font-semibold text-white group-hover:text-gold-300">{d.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-5 text-slate-400">{d.description}</p>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-gold-400">
                    Read <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Results by category */}
      {docCategories
        .filter((c) => cat === "all" || c.id === cat)
        .map((c) => {
          const list = results.filter((d) => d.category === c.id);
          if (list.length === 0) return null;
          return (
            <div key={c.id} className="mb-10">
              <div className="mb-4 flex items-baseline gap-3">
                <h2 className="font-display text-lg font-semibold text-white">{c.label}</h2>
                <span className="text-xs text-slate-500">{c.blurb}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {list.map((d) => (
                  <Link
                    key={d.id}
                    to={`/docs/${d.id}`}
                    className="group flex items-start gap-3.5 rounded-2xl border border-phantix-700/40 bg-phantix-900/50 p-5 transition-all duration-200 hover:border-phantix-500/60 hover:bg-phantix-800/50"
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-phantix-800/70 text-phantix-300 transition-colors group-hover:bg-gold-400/15 group-hover:text-gold-400">
                      <FileText size={15} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-100 group-hover:text-gold-300">{d.title}</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500 line-clamp-2">{d.description}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}

      {results.length === 0 && (
        <div className="py-16 text-center">
          <BookOpen size={28} className="mx-auto text-slate-600" />
          <p className="mt-4 text-slate-400">No guides match “{q}”.</p>
          <p className="mt-1 text-sm text-slate-600">Try an endpoint path, an engine name, or an auth term.</p>
        </div>
      )}
    </div>
  );
}
