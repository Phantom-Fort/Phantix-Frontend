import React, { useState } from "react";
import { motion } from "framer-motion";
import { Database, KeyRound, Copy, RefreshCw, Sparkles, CreditCard, Building2, ShieldCheck, CheckCircle2, Plus } from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, Modal, Tabs } from "@/components/ui";
import { dbConnections, serviceKey, aiStatus, organization } from "@/lib/demo-data";
import { timeAgo, cx } from "@/lib/utils";
import { useStore } from "@/lib/store";

export default function Settings() {
  const { toast, org } = useStore();
  const [tab, setTab] = useState("connections");
  const [connOpen, setConnOpen] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Settings" description="Tenant identity, security database connections, service keys and AI governance." />

      <Tabs
        tabs={[
          { id: "connections", label: "Security database", count: dbConnections.length },
          { id: "identity", label: "Identity & keys" },
          { id: "ai", label: "AI" },
          { id: "billing", label: "Billing" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "connections" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/5 px-4 py-3">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-400" />
            <p className="text-xs leading-5 text-slate-400">
              <strong className="text-emerald-300">Bootstrap gate: ready.</strong> Scans, VAPT and findings are
              unblocked because the primary security_data_storage connection is bootstrapped to schema 1.4.2.
              Without this, every product module hard-fails.
            </p>
          </div>

          {dbConnections.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card hover>
                <div className="flex flex-wrap items-center gap-4">
                  <span className={cx("flex h-12 w-12 items-center justify-center rounded-xl", c.bootstrap_status === "ready" ? "bg-emerald-400/12 text-emerald-400" : "bg-phantix-800/70 text-phantix-300")}>
                    <Database size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-100">{c.name}</p>
                      {c.is_primary && <span className="chip border-gold-400/30 bg-gold-400/10 text-gold-300">primary</span>}
                      <StatusBadge status={c.bootstrap_status} />
                    </div>
                    <p className="mt-1 font-mono text-xs text-slate-500">
                      {c.db_type} · {c.host}:{c.port}/{c.database_name} · schema {c.target_schema}
                      {c.schema_version ? ` · v${c.schema_version}` : ""}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-600">
                      {c.connection_purpose === "security_data_storage"
                        ? "Full CRUD inside the phantix schema only — findings, assets, evidence"
                        : "Read-only: roles, privileges, policies, grants — never business rows"}
                      {" · "}last test {c.last_test_ok ? "passed" : "failed"} {timeAgo(c.last_test_at)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-secondary !py-2" onClick={() => toast("success", "Connectivity OK", `POST /db-connections/${c.id}/test — live probe via asyncpg.`)}>
                      Test
                    </button>
                    {c.bootstrap_status !== "ready" && c.connection_purpose === "security_data_storage" && (
                      <button className="btn-primary !py-2" onClick={() => toast("info", "Bootstrap started", `POST /db-connections/${c.id}/bootstrap — idempotent CREATE IF NOT EXISTS.`)}>
                        Bootstrap schema
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}

          <Card className="border-dashed">
            <button className="btn-ghost w-full text-slate-400" onClick={() => setConnOpen(true)}>
              <Plus size={15} /> Add connection
            </button>
          </Card>
        </motion.div>
      )}

      {tab === "identity" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Tenant identity" subtitle="Needed for support tickets and app invites" action={<Building2 size={16} className="text-slate-500" />} />
            <div className="space-y-2.5">
              {[
                ["Organization", org.name],
                ["Tenant ID", `#${org.id}`],
                ["Slug", org.slug],
                ["Creator user", `#${org.creator_user_id}`],
                ["Country", org.country],
                ["Plan", org.plan],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between rounded-xl border border-phantix-700/40 bg-phantix-950/50 px-4 py-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-500">{k}</span>
                  <span className="flex items-center gap-2 font-mono text-sm text-slate-200">
                    {v}
                    <button className="text-slate-600 hover:text-gold-400" onClick={() => { navigator.clipboard?.writeText(String(v)).catch(() => {}); toast("success", "Copied"); }}>
                      <Copy size={12} />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Service key" subtitle="One active pk_live key per company — full secret shown once on create/rotate" action={<KeyRound size={16} className="text-slate-500" />} />
            <div className="rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-slate-200">{serviceKey.prefix}</span>
                <StatusBadge status="active" />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Created {timeAgo(serviceKey.created_at)} · last used {timeAgo(serviceKey.last_used_at)}
              </p>
            </div>
            <div className="mt-4 flex gap-2.5">
              <button className="btn-primary flex-1" onClick={() => setKeyOpen(true)}>
                <RefreshCw size={14} /> Rotate key
              </button>
              <button className="btn-danger" onClick={() => toast("info", "Revocation", "DELETE /organizations/me/service-key/{id} with confirm.")}>Revoke</button>
            </div>
            <p className="mt-3 text-[11px] leading-4 text-slate-500">
              Rotating keeps the old key alive briefly (grace period) — per-user login links are unaffected.
              Payment, plan access and rate limits bind to the company (organization_id).
            </p>
          </Card>
        </motion.div>
      )}

      {tab === "ai" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="AI engine" subtitle="Narratives only — AI never determines security facts or scores" action={<Sparkles size={16} className="text-gold-400" />} />
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Status", aiStatus.enabled ? "Enabled" : "Disabled"],
                ["Default provider", aiStatus.default_provider],
                ["Mode", aiStatus.mode],
                ["Pentest AI", aiStatus.ai_pentest_ready ? "Ready (DeepSeek)" : "Gated"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-3.5">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">{k}</p>
                  <p className="mt-1 font-medium capitalize text-slate-200">{v}</p>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <p className="label">Providers</p>
              <div className="flex flex-wrap gap-2">
                {aiStatus.providers.map((p) => (
                  <span key={p.id} className={cx("chip", p.configured ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-phantix-700/50 bg-phantix-900/50 text-slate-500")}>
                    {p.configured && <CheckCircle2 size={11} />} {p.id}
                  </span>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Usage this month" subtitle="Cost visibility — every call audited with prompt version + model" />
            <div className="flex items-end gap-8">
              <div>
                <p className="font-display text-3xl font-bold text-white">{aiStatus.monthly_tokens.toLocaleString()}</p>
                <p className="text-xs text-slate-500">tokens</p>
              </div>
              <div>
                <p className="font-display text-3xl font-bold text-gold-300">${aiStatus.monthly_cost_usd.toFixed(2)}</p>
                <p className="text-xs text-slate-500">estimated cost</p>
              </div>
            </div>
            <div className="mt-5 space-y-2 text-xs leading-5 text-slate-400">
              <p>· PII is redacted before any provider call</p>
              <p>· Hallucination heuristics + cost/budget gates on every request</p>
              <p>· AI pentesting activates only when a DeepSeek key is configured</p>
              <p>· Finding explanations and executive summaries land in reports via the bus</p>
            </div>
          </Card>
        </motion.div>
      )}

      {tab === "billing" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Subscription" subtitle="Bound to the company — all users and keys share the org bucket" action={<CreditCard size={16} className="text-slate-500" />} />
            <div className="rounded-2xl border border-gold-400/25 bg-gradient-to-b from-gold-400/10 to-transparent p-5">
              <div className="flex items-center justify-between">
                <p className="font-display text-xl font-bold text-white">{organization.plan}</p>
                <StatusBadge status="active" />
              </div>
              <p className="mt-2 text-sm text-slate-400">Renews Aug 1, 2026 · monthly</p>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                {[
                  ["326", "API routes"],
                  ["∞", "Campaigns"],
                  ["11", "Engines"],
                ].map(([v, l]) => (
                  <div key={l} className="rounded-xl bg-phantix-950/60 p-3">
                    <p className="font-display text-lg font-bold text-gold-300">{v}</p>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">{l}</p>
                  </div>
                ))}
              </div>
            </div>
          </Card>
          <Card>
            <CardHeader title="Rate limits" subtitle="Organization-scoped buckets" />
            <div className="space-y-2.5">
              {[
                ["Company JWT", "org:11", "RATE_LIMIT_ORG"],
                ["Org users / app sessions", "org:11 (shared)", "same bucket"],
                ["Service key", "orgkey:sha256", "RATE_LIMIT_SERVICE_KEY"],
                ["App login (pre-token)", "ip:", "30/min"],
              ].map(([who, bucket, cfg]) => (
                <div key={who} className="flex items-center justify-between gap-3 rounded-xl border border-phantix-700/40 bg-phantix-950/50 px-4 py-3">
                  <span className="text-xs text-slate-300">{who}</span>
                  <span className="font-mono text-[11px] text-slate-500">{bucket}</span>
                  <span className="font-mono text-[10px] text-gold-400/80">{cfg}</span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Add connection modal */}
      <Modal open={connOpen} onClose={() => setConnOpen(false)} title="Add database connection" wide>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setConnOpen(false);
            toast("success", "Connection saved", "Credentials Fernet-encrypted. Next: test, then bootstrap the security schema.");
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Name</label>
              <input className="input" placeholder="Phantix Security Store" />
            </div>
            <div>
              <label className="label">Purpose</label>
              <select className="input">
                <option value="security_data_storage">security_data_storage (full CRUD, phantix schema)</option>
                <option value="config_inspection">config_inspection (read-only posture)</option>
              </select>
            </div>
            <div>
              <label className="label">Engine</label>
              <select className="input">
                <option>postgresql</option><option>mysql</option><option>mssql</option><option>mongodb</option>
              </select>
            </div>
            <div>
              <label className="label">Host</label>
              <input className="input font-mono" placeholder="10.20.0.14" />
            </div>
            <div>
              <label className="label">Port</label>
              <input className="input font-mono" placeholder="5432" />
            </div>
            <div>
              <label className="label">Database</label>
              <input className="input font-mono" placeholder="phantix_security" />
            </div>
            <div>
              <label className="label">Target schema</label>
              <input className="input font-mono" defaultValue="phantix" />
            </div>
            <div>
              <label className="label">Username</label>
              <input className="input font-mono" placeholder="phantix_writer" />
            </div>
            <div>
              <label className="label">Password</label>
              <input type="password" className="input" placeholder="••••••••" />
            </div>
          </div>
          <div className="rounded-xl border border-phantix-700/50 bg-phantix-950/50 p-3.5 text-xs leading-5 text-slate-500">
            Least privilege: the storage role needs CONNECT, CREATE (or schema ownership), USAGE and DML on the
            phantix schema only — never access to application tables. See GET /db-connections/connection-option-hints
            for engine-specific options.
          </div>
          <button className="btn-primary w-full">Save connection</button>
        </form>
      </Modal>

      {/* Rotate key modal */}
      <Modal open={keyOpen} onClose={() => setKeyOpen(false)} title="Service key rotated">
        <div className="space-y-4">
          <div className="rounded-xl border border-severity-medium/30 bg-severity-medium/8 p-3.5 text-xs leading-5 text-severity-medium">
            This is the only time the full secret is displayed. Store it in your secrets vault now — the backend
            keeps only the SHA-256.
          </div>
          <div className="rounded-xl border border-phantix-700/50 bg-phantix-950/70 p-4 font-mono text-sm text-gold-300 break-all">
            pk_live_7f3a9c2e5b8d4f1a6c0e3b9d7f2a5c8e
          </div>
          <button
            className="btn-primary w-full"
            onClick={() => {
              navigator.clipboard?.writeText("pk_live_7f3a9c2e5b8d4f1a6c0e3b9d7f2a5c8e").catch(() => {});
              toast("success", "Copied — old key enters grace period");
              setKeyOpen(false);
            }}
          >
            <Copy size={15} /> Copy & I stored it safely
          </button>
        </div>
      </Modal>
    </div>
  );
}
