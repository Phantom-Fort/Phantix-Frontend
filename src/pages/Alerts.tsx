import React, { useState } from "react";
import { motion } from "framer-motion";
import { BellRing, Mail, MessageSquare, Send, FlaskConical, Info } from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, SeverityBadge, Tabs, Spinner } from "@/components/ui";
import { loadAlertsBundle } from "@/lib/data";
import { useResource } from "@/lib/useResource";
import { timeAgo, cx } from "@/lib/utils";
import { useStore } from "@/lib/store";
import type { AlertSettings } from "@/lib/types";

const emptySettings: AlertSettings = {
  alerts_enabled: false,
  smtp: { enabled: false, host: "", port: 587, from_email: "", from_name: "", use_tls: true },
  email_recipients: [],
  whatsapp: { enabled: false, provider: "", recipients: [] },
  telegram: { enabled: false, provider: "", recipients: [] },
  notify: {},
};

export default function Alerts() {
  const { toast, requireDualControl } = useStore();
  const { data, loading } = useResource(loadAlertsBundle, { events: [], settings: emptySettings });
  const alertEvents = data.events;
  const s = data.settings;
  const [tab, setTab] = useState("events");

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-slate-400">
        <Spinner className="h-5 w-5" /> Loading alerts…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Alerts"
        description="Severity-routed client notifications. Critical → email + WhatsApp + Telegram; everything else → email only. Routing is enforced server-side, not just configured."
        actions={
          <button
            className="btn-primary"
            onClick={() =>
              void (async () => {
                if (!(await requireDualControl("Sending a test alert requires a dual-control operate session."))) return;
                toast("success", "Test alert queued", "POST /alerts/test");
              })()
            }
          >
            <FlaskConical size={15} /> Send test alert
          </button>
        }
      />

      <Tabs
        tabs={[
          { id: "events", label: "Delivery log", count: alertEvents.length },
          { id: "settings", label: "Channels & SMTP" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "events" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-2.5">
          {alertEvents.map((a, i) => (
            <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card hover className="!p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={cx("flex h-9 w-9 items-center justify-center rounded-lg", a.severity === "critical" ? "bg-severity-critical/15 text-severity-critical" : "bg-phantix-800/70 text-phantix-300")}>
                    <BellRing size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-200">{a.title}</p>
                    <p className="mt-0.5 font-mono text-xs text-slate-500">{a.event_type} · {timeAgo(a.created_at)}</p>
                  </div>
                  <div className="flex gap-1.5">
                    {a.channels.map((c) => (
                      <span key={c} className="rounded-md bg-phantix-800/80 px-2 py-0.5 text-[10px] font-medium text-slate-400">{c}</span>
                    ))}
                  </div>
                  <SeverityBadge severity={a.severity} />
                  <StatusBadge status={a.status} />
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {tab === "settings" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Client alert SMTP" subtitle="Separate from the Phantix OTP SMTP — this delivers security alerts + VAPT completion mail" action={<Mail size={16} className="text-slate-500" />} />
            <div className="space-y-3">
              {[
                ["Host", `${s.smtp.host}:${s.smtp.port}`],
                ["From", `${s.smtp.from_name} <${s.smtp.from_email}>`],
                ["TLS", s.smtp.use_tls ? "Enabled" : "Disabled"],
                ["Recipients", s.email_recipients.join(", ")],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-4 rounded-xl border border-phantix-700/40 bg-phantix-950/50 px-4 py-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-500">{k}</span>
                  <span className="text-right font-mono text-xs text-slate-200">{v}</span>
                </div>
              ))}
              <p className="text-[11px] leading-4 text-slate-500">
                Passwords are Fernet-encrypted on the platform DB and never re-displayed.
              </p>
              <button
                className="btn-secondary w-full"
                onClick={() =>
                  void (async () => {
                    if (!(await requireDualControl("Updating alert settings requires a dual-control operate session."))) return;
                    toast("info", "SMTP settings", "PUT /alerts/settings");
                  })()
                }
              >
                Update SMTP
              </button>
            </div>
          </Card>

          <div className="space-y-5">
            <Card>
              <CardHeader title="Critical-only channels" subtitle="Never fire for non-critical severities" />
              <div className="space-y-2.5">
                {[
                  { icon: <MessageSquare size={15} />, name: "WhatsApp", cfg: s.whatsapp, note: "provider=log (stub until real API)" },
                  { icon: <Send size={15} />, name: "Telegram", cfg: s.telegram, note: "provider=log (stub until real API)" },
                ].map((c) => (
                  <div key={c.name} className="flex items-center gap-3 rounded-xl border border-phantix-700/40 bg-phantix-950/50 px-4 py-3">
                    <span className={cx("flex h-9 w-9 items-center justify-center rounded-lg", c.cfg.enabled ? "bg-emerald-400/12 text-emerald-400" : "bg-phantix-800/70 text-slate-500")}>
                      {c.icon}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-200">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.note}</p>
                    </div>
                    <StatusBadge status={c.cfg.enabled ? "ready" : "draft"} />
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHeader title="Notify on" subtitle="Event toggles" />
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(s.notify).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between rounded-xl border border-phantix-700/40 bg-phantix-950/50 px-3.5 py-2.5">
                    <span className="font-mono text-xs text-slate-300">{k}</span>
                    <span className={cx("h-2 w-2 rounded-full", v ? "bg-emerald-400" : "bg-slate-600")} />
                  </div>
                ))}
              </div>
            </Card>

            <div className="flex items-start gap-3 rounded-2xl border border-phantix-700/50 bg-phantix-900/50 px-4 py-3">
              <Info size={15} className="mt-0.5 shrink-0 text-gold-400" />
              <p className="text-xs leading-5 text-slate-400">
                Delivery runs via the alert daemon (python -m app.workers.alert_daemon), Celery beat every 30s,
                or per-event processing. VAPT completion mail requires alerts_enabled + SMTP recipients (or org
                primary email fallback).
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
