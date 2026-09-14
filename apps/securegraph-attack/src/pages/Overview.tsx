import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, type Variants } from "framer-motion";
import { ArrowUpRight, Boxes, Code2, Crosshair, ShieldCheck } from "lucide-react";
import { PageHeader, Card, PageHeaderSkeleton, CardListSkeleton } from "@sg/ui";
import { cx } from "@sg/utils";
import { apiGet } from "@sg/shell/api";
import { useStore } from "@sg/store";
import { APPLICATION_LABEL, type ApplicationKey, type NavSection } from "@sg/shell/types";

/**
 * An application's landing page: what this application is, and every page it
 * owns, one click away.
 *
 * The hero text comes from the backend launcher card so the four applications
 * describe themselves consistently wherever they appear (picker, switcher,
 * here). The launchpad is built from this app's own nav, which is the source of
 * truth for routes and icons — a backend surface list can describe a page, but
 * only the router knows where it actually lives.
 */

interface LauncherCard {
  key: ApplicationKey;
  label: string;
  tagline: string;
  description: string;
  capabilities: string[];
  accessible: boolean;
}

interface Snapshot {
  applications: LauncherCard[];
}

const ICONS: Record<ApplicationKey, React.ReactNode> = {
  core: <Boxes size={22} />,
  attack: <Crosshair size={22} />,
  defend: <ShieldCheck size={22} />,
  code: <Code2 size={22} />,
};

// One brand accent across every application. Per-application colour is reserved
// for the sign-in ChooseApp picker.
const ACCENT: Record<ApplicationKey, string> = {
  core: "text-gold-300 border-gold-400/30",
  attack: "text-gold-300 border-gold-400/30",
  defend: "text-gold-300 border-gold-400/30",
  code: "text-gold-300 border-gold-400/30",
};

const grid: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

const tile: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 340, damping: 30 } },
};

export default function Overview({
  application,
  nav = [],
}: {
  application: ApplicationKey;
  nav?: NavSection[];
}) {
  const { toast } = useStore();
  const [card, setCard] = useState<LauncherCard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    apiGet<Snapshot>("/app/auth/applications")
      .then((s) => alive && setCard(s.applications.find((a) => a.key === application) ?? null))
      // The hero text is decoration here — the launchpad is built from this
      // app's own nav and needs nothing from the API. A backend message
      // (expired session, gateway error) belongs in a toast, not printed across
      // a page that is working.
      .catch((e: unknown) => {
        if (!alive) return;
        toast("error", "Could not load application details", e instanceof Error ? e.message : "");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [application]);

  // Every page this application owns, minus this one.
  const sections = nav
    .map((section) => ({
      label: section.label,
      items: section.items.filter((item) => item.to !== "/"),
    }))
    .filter((section) => section.items.length > 0);

  const pageCount = sections.reduce((n, s) => n + s.items.length, 0);

  if (loading) {
    return (
      <div>
        <PageHeaderSkeleton />
        <CardListSkeleton rows={3} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`${card?.label || APPLICATION_LABEL[application]}`}
        description={card?.description || undefined}
      />

      {/* Hero: what this application is for. */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <Card className="mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <span
              className={cx(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border bg-phantix-900/70",
                ACCENT[application],
              )}
            >
              {ICONS[application]}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cx("text-xs font-semibold", ACCENT[application].split(" ")[0])}>
                {card?.tagline || "Application"}
              </p>
              <p className="mt-0.5 text-sm text-slate-400">
                {pageCount > 0
                  ? `${pageCount} pages in this application`
                  : "This application has no pages yet."}
              </p>
            </div>
            {card?.capabilities?.length ? (
              <div className="flex flex-wrap gap-1.5">
                {card.capabilities.map((c) => (
                  <span
                    key={c}
                    className="chip border-phantix-700 bg-phantix-900 text-[13px] text-slate-300"
                  >
                    {c}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </Card>
      </motion.div>

      {/* Launchpad: every page, grouped the way the sidebar groups them. */}
      {sections.map((section) => (
        <div key={section.label} className="mb-6">
          <p className="mb-2.5 font-mono text-[13px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {section.label}
          </p>
          <motion.div
            variants={grid}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {section.items.map((item) => (
              <motion.div key={item.to} variants={tile}>
                <Link
                  to={item.to}
                  className="card group flex items-center gap-3 p-4 transition-colors hover:border-phantix-600"
                >
                  <span
                    className={cx(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-phantix-700/60 bg-phantix-900/70 transition-transform group-hover:scale-105",
                      ACCENT[application].split(" ")[0],
                    )}
                  >
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-200 group-hover:text-white">
                    {item.label}
                  </span>
                  <ArrowUpRight
                    size={15}
                    className="shrink-0 text-slate-600 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-slate-300"
                  />
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      ))}
    </div>
  );
}
