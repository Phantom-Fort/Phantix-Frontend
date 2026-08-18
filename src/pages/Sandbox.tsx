import React, { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FlaskConical, Star, Megaphone, CheckCircle2, RefreshCw, AlertTriangle, ExternalLink } from "lucide-react";
import { PageHeader, Card, CardHeader, Modal, Spinner, EmptyState, StatusBadge } from "@/components/ui";
import { useStore } from "@/lib/store";
import { PLATFORM_URL } from "@/lib/links";
import { timeAgo, cx, titleCase } from "@/lib/utils";
import {
  loadSandboxMe,
  loadSandboxUpdates,
  ackSandboxUpdate,
  submitSandboxRating,
  loadMySandboxRatings,
  SANDBOX_AREAS,
  type SandboxMe,
  type SandboxUpdate,
  type SandboxRating,
} from "@/lib/sandbox";

function severityChip(sev: string) {
  const s = (sev || "info").toLowerCase();
  const cls =
    s === "breaking"
      ? "border-severity-critical/40 bg-severity-critical/10 text-severity-critical"
      : s === "fix"
        ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
        : "border-phantix-600/50 bg-phantix-800/50 text-slate-300";
  return <span className={cx("chip capitalize", cls)}>{s}</span>;
}

export default function Sandbox() {
  const { toast } = useStore();
  const [me, setMe] = useState<SandboxMe | null>(null);
  const [updates, setUpdates] = useState<SandboxUpdate[]>([]);
  const [ratings, setRatings] = useState<SandboxRating[]>([]);
  const [loading, setLoading] = useState(true);
  const [rateOpen, setRateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    score: 4,
    nps: 8,
    area: "overall",
    comment: "",
    what_broke: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const m = await loadSandboxMe();
      setMe(m);
      if (m?.enrolled) {
        const [u, r] = await Promise.all([loadSandboxUpdates(), loadMySandboxRatings()]);
        setUpdates(u);
        setRatings(r);
      } else {
        setUpdates([]);
        setRatings([]);
      }
    } catch (e) {
      toast("error", "Sandbox load failed", e instanceof Error ? e.message : "");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const ack = async (u: SandboxUpdate) => {
    try {
      await ackSandboxUpdate(u.id);
      setUpdates((list) => list.map((x) => (x.id === u.id ? { ...x, acked: true } : x)));
      setMe((m) =>
        m
          ? {
              ...m,
              unreadUpdates: Math.max(0, (m.unreadUpdates ?? 1) - 1),
            }
          : m,
      );
      toast("success", "Update acknowledged");
    } catch (e) {
      toast("error", "Ack failed", e instanceof Error ? e.message : "");
    }
  };

  const submitRate = async () => {
    if (form.score < 1 || form.score > 5) {
      toast("error", "Score must be 1–5");
      return;
    }
    setSaving(true);
    try {
      const row = await submitSandboxRating({
        score: form.score,
        nps: form.nps,
        area: form.area,
        comment: form.comment.trim() || undefined,
        what_broke: form.what_broke.trim() || undefined,
      });
      setRatings((prev) => [row, ...prev]);
      setRateOpen(false);
      toast("success", "Thanks — rating recorded");
    } catch (e) {
      toast("error", "Rating failed", e instanceof Error ? e.message : "");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-slate-400">
        <Spinner className="h-5 w-5" /> Loading sandbox…
      </div>
    );
  }

  if (!me?.enrolled) {
    return (
      <div className="mx-auto max-w-[900px]">
        <PageHeader title="BETA sandbox" description="Design-partner cohort feedback" />
        <EmptyState
          icon={<FlaskConical size={28} />}
          title="Not enrolled"
          body="Your organization is not in the launch sandbox cohort. Phantix staff enroll orgs from the staff portal (max 20 seats)."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="BETA sandbox"
        description={`${me.program?.name ?? "Launch cohort"} · Command Centre tools + Platform org admin`}
        actions={
          <div className="flex flex-wrap gap-2">
            <a href={`${PLATFORM_URL}/sandbox`} className="btn-secondary !text-xs" target="_blank" rel="noreferrer">
              <ExternalLink size={14} /> Platform sandbox
            </a>
            <button type="button" className="btn-ghost !text-xs" onClick={() => void load()}>
              <RefreshCw size={14} /> Refresh
            </button>
            <button type="button" className="btn-primary !text-xs" onClick={() => setRateOpen(true)}>
              <Star size={14} /> Rate this build
            </button>
          </div>
        }
      />

      <div className="mb-5 rounded-2xl border border-phantix-700/40 bg-phantix-900/40 px-4 py-3 text-xs leading-5 text-slate-400">
        Sandboxed orgs use the full product across <strong className="text-slate-200">Command Centre</strong> (this app)
        and <strong className="text-slate-200">Platform</strong> (org management). Staff portal is Phantix-internal only.
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="!p-4">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">Member status</p>
          <p className="mt-1 text-lg font-semibold text-slate-100">{titleCase(me.member?.status ?? "active")}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">Unread updates</p>
          <p className="mt-1 text-lg font-semibold text-gold-300">{me.unreadUpdates ?? 0}</p>
        </Card>
        <Card className="!p-4">
          <p className="text-[11px] uppercase tracking-wider text-slate-500">Seats</p>
          <p className="mt-1 text-lg font-semibold text-slate-100">≤ {me.program?.maxMembers ?? 20}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-3">
          <Card>
            <CardHeader title="Live updates" subtitle="Staff posts after deploys — ack when you've refreshed" action={<Megaphone size={15} className="text-gold-400" />} />
            {updates.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No updates yet.</p>
            ) : (
              <div className="space-y-3">
                {updates.map((u) => {
                  const body = u.body_md ?? u.bodyMd ?? "";
                  const ver = u.version_label ?? u.versionLabel;
                  const pub = u.published_at ?? u.publishedAt;
                  return (
                    <div
                      key={u.id}
                      className={cx(
                        "rounded-xl border p-4",
                        String(u.severity).toLowerCase() === "breaking"
                          ? "border-severity-critical/35 bg-severity-critical/5"
                          : "border-phantix-700/40 bg-phantix-950/40",
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        {severityChip(u.severity)}
                        {ver && <span className="chip font-mono text-[10px] text-slate-400">{ver}</span>}
                        {u.acked && (
                          <span className="chip border-emerald-400/30 bg-emerald-400/10 text-[10px] text-emerald-300">
                            <CheckCircle2 size={10} className="mr-1 inline" /> acked
                          </span>
                        )}
                        {pub && <span className="ml-auto text-[11px] text-slate-600">{timeAgo(pub)}</span>}
                      </div>
                      <p className="mt-2 text-sm font-semibold text-slate-100">{u.title}</p>
                      {body && <p className="mt-1.5 whitespace-pre-wrap text-xs leading-5 text-slate-400">{body}</p>}
                      {!u.acked && (
                        <button type="button" className="btn-secondary mt-3 !py-1.5 !text-xs" onClick={() => void ack(u)}>
                          Mark read
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="lg:col-span-2">
          <Card>
            <CardHeader title="Your ratings" subtitle="Help prioritize what we fix next" />
            {ratings.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No ratings yet — rate a build after you try it.</p>
            ) : (
              <div className="space-y-2">
                {ratings.map((r, i) => (
                  <div key={r.id ?? i} className="rounded-xl border border-phantix-700/40 bg-phantix-950/40 px-3.5 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-gold-300">{r.score}/5</span>
                      {r.nps != null && <span className="text-[11px] text-slate-500">NPS {r.nps}</span>}
                      {r.area && <StatusBadge status={r.area} />}
                    </div>
                    {r.comment && <p className="mt-1 text-xs text-slate-300">{r.comment}</p>}
                    {r.what_broke && (
                      <p className="mt-1 flex items-start gap-1 text-[11px] text-severity-high">
                        <AlertTriangle size={11} className="mt-0.5 shrink-0" /> {r.what_broke}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      <Modal open={rateOpen} onClose={() => setRateOpen(false)} title="Rate this build">
        <div className="space-y-3">
          <div>
            <label className="label">Score (1–5)</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, score: n }))}
                  className={cx(
                    "flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-bold",
                    form.score === n
                      ? "border-gold-400/50 bg-gold-400/15 text-gold-300"
                      : "border-phantix-700/50 bg-phantix-950/50 text-slate-400",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">NPS (0–10)</label>
            <input
              type="number"
              min={0}
              max={10}
              className="input"
              value={form.nps}
              onChange={(e) => setForm((f) => ({ ...f, nps: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="label">Area</label>
            <select className="input" value={form.area} onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}>
              {SANDBOX_AREAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Comment</label>
            <textarea className="input min-h-[72px]" value={form.comment} onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))} placeholder="What worked well?" />
          </div>
          <div>
            <label className="label">What broke?</label>
            <textarea className="input min-h-[72px]" value={form.what_broke} onChange={(e) => setForm((f) => ({ ...f, what_broke: e.target.value }))} placeholder="Optional failure notes" />
          </div>
          <button type="button" className="btn-primary w-full" disabled={saving} onClick={() => void submitRate()}>
            {saving ? <Spinner className="h-4 w-4" /> : <Star size={14} />} Submit rating
          </button>
        </div>
      </Modal>
    </div>
  );
}
