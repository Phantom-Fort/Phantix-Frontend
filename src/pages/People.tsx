import React, { useState } from "react";
import { motion } from "framer-motion";
import { Users, Plus, ShieldCheck, Link2, KeyRound, UserPlus, AlertTriangle } from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, Modal } from "@/components/ui";
import { orgUsers, dualControl } from "@/lib/demo-data";
import { timeAgo, cx } from "@/lib/utils";
import { useStore } from "@/lib/store";

export default function People() {
  const { toast, operate } = useStore();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [linkFor, setLinkFor] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="People & dual control"
        description="Named org users with domain-email OTP identity. Writes require the initiator or authorizer slot plus a 3-minute idle operate session — roles alone grant no writes."
        actions={
          <button className="btn-primary" onClick={() => (operate.unlocked || !dualControl.configured ? setInviteOpen(true) : toast("warning", "Operate mode required", "Creating users post-bootstrap needs an initiator/authorizer session."))}>
            <UserPlus size={15} /> Add user
          </button>
        }
      />

      {/* Dual-control assignment */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
        <Card className="border-gold-400/25">
          <CardHeader
            title="Dual-control assignment"
            subtitle="Two different people — one proposes, one approves"
            action={<ShieldCheck size={17} className="text-gold-400" />}
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[
              { slot: "Initiator", user: dualControl.initiator, desc: "Proposes and executes mutations with an operate session" },
              { slot: "Authorizer", user: dualControl.authorizer, desc: "Approves pending actions and risk treatments" },
            ].map((s) => (
              <div key={s.slot} className="flex items-center gap-4 rounded-2xl border border-phantix-700/40 bg-phantix-950/50 p-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 font-display text-base font-bold text-phantix-950">
                  {s.user?.full_name.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-100">{s.user?.full_name}</p>
                    <span className="chip border-gold-400/30 bg-gold-400/10 text-gold-300">{s.slot}</span>
                  </div>
                  <p className="text-xs text-slate-500">{s.user?.title} · {s.user?.email}</p>
                  <p className="mt-1 text-[11px] text-slate-600">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-phantix-700/40 bg-phantix-950/50 px-4 py-3">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-gold-400" />
            <p className="text-[11px] leading-4 text-slate-500">
              Changing the assignment requires an operate session (PUT /org-users/dual-control). After reassignment,
              previous operate sessions are revoked — both users must re-login with purpose=dual_control.
            </p>
          </div>
        </Card>
      </motion.div>

      {/* Users table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        <Card className="!p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-phantix-700/40">
                <th className="th">User</th>
                <th className="th">Role</th>
                <th className="th">Slot</th>
                <th className="th">Auth</th>
                <th className="th">Last login</th>
                <th className="th">Status</th>
                <th className="th"></th>
              </tr>
            </thead>
            <tbody>
              {orgUsers.map((u) => (
                <tr key={u.id} className="border-b border-phantix-800/40 hover:bg-phantix-800/35">
                  <td className="td">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-phantix-800/70 font-display text-xs font-bold text-phantix-200">
                        {u.full_name.split(" ").map((n) => n[0]).join("")}
                      </span>
                      <div>
                        <p className="font-medium text-slate-200">{u.full_name}</p>
                        <p className="text-xs text-slate-500">{u.email} · {u.title}</p>
                      </div>
                    </div>
                  </td>
                  <td className="td"><span className="font-mono text-xs text-slate-400">{u.role}</span></td>
                  <td className="td">
                    {u.is_initiator ? (
                      <span className="chip border-gold-400/30 bg-gold-400/10 text-gold-300">Initiator</span>
                    ) : u.is_authorizer ? (
                      <span className="chip border-gold-400/30 bg-gold-400/10 text-gold-300">Authorizer</span>
                    ) : (
                      <span className="text-xs text-slate-600">—</span>
                    )}
                  </td>
                  <td className="td">
                    {u.otp_only ? (
                      <span className="chip border-emerald-400/30 bg-emerald-400/10 text-emerald-300"><KeyRound size={11} /> OTP only</span>
                    ) : (
                      <span className="text-xs text-slate-500">password</span>
                    )}
                  </td>
                  <td className="td text-xs text-slate-500">{timeAgo(u.last_login_at)}</td>
                  <td className="td"><StatusBadge status={u.is_active ? "active" : "cancelled"} /></td>
                  <td className="td">
                    <button
                      className="btn-ghost !px-2.5 !py-1.5 !text-xs"
                      onClick={() => setLinkFor(u.full_name)}
                    >
                      <Link2 size={13} /> Login link
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </motion.div>

      {/* Login link modal */}
      <Modal open={!!linkFor} onClose={() => setLinkFor(null)} title="Application login link">
        <div className="space-y-4">
          <p className="text-sm leading-6 text-slate-300">
            Issue a one-time sign-in URL for <strong>{linkFor}</strong> to the operator app
            (app.phantix.site). The link is shown <strong className="text-gold-300">once</strong> — rotating the
            service key does not invalidate it.
          </p>
          <div className="rounded-xl border border-phantix-700/50 bg-phantix-950/70 p-3.5 font-mono text-xs leading-6 text-gold-300/90 break-all">
            https://app.phantix.site/login?org=acme-financial&u=3&t=ll_9f4c…e21a
          </div>
          <div className="flex gap-2.5">
            <button
              className="btn-primary flex-1"
              onClick={() => {
                navigator.clipboard?.writeText("https://app.phantix.site/login?org=acme-financial&u=3&t=ll_9f4c…e21a").catch(() => {});
                toast("success", "Link copied", "POST /organizations/me/users/{id}/login-link — shown once.");
                setLinkFor(null);
              }}
            >
              Copy link
            </button>
            <button className="btn-secondary" onClick={() => { setLinkFor(null); toast("info", "Device bind cleared", "DELETE /organizations/me/users/{id}/device"); }}>
              Clear device bind
            </button>
          </div>
        </div>
      </Modal>

      {/* Invite modal */}
      <Modal open={inviteOpen} onClose={() => setInviteOpen(false)} title="Add organization user">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setInviteOpen(false);
            toast("success", "User created", "OTP-only by default — day-to-day login is domain-email OTP via /org-users/auth/login.");
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Full name</label>
              <input className="input" placeholder="Ada Okonkwo" />
            </div>
            <div>
              <label className="label">Title (shows on audit)</label>
              <input className="input" placeholder="SOC Analyst" />
            </div>
          </div>
          <div>
            <label className="label">Work email</label>
            <input className="input" placeholder="name@acme.ng" />
            <p className="mt-1.5 text-[11px] text-slate-500">
              Prefer the work domain — free-mail only if it matches a registration contact (domain-exempt).
            </p>
          </div>
          <div>
            <label className="label">Role (view/report scope only)</label>
            <select className="input">
              <option value="viewer">viewer</option>
              <option value="operator">operator</option>
              <option value="org_admin">org_admin</option>
              <option value="security_admin">security_admin</option>
            </select>
          </div>
          <label className="flex items-center gap-2.5 text-sm text-slate-300">
            <input type="checkbox" defaultChecked className="h-4 w-4 accent-gold-400" /> OTP-only (recommended — no password)
          </label>
          <button className="btn-primary w-full"><Plus size={15} /> Create user</button>
        </form>
      </Modal>
    </div>
  );
}
