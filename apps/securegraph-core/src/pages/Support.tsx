import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Link, useSearchParams } from "react-router-dom";
import {
  LifeBuoy, Plus, MessageSquare, ArrowLeft, Loader2, Send, BookOpen, Mail, Clock,
  ShieldCheck, ExternalLink, RefreshCw, AlertTriangle,
} from "lucide-react";
import { PageHeader, Card, CardHeader, StatusBadge, Modal, EmptyState, Spinner, PageSkeleton, ErrorState } from "@/components/ui";
import DocLink from "@/components/DocLink";
import { useStore } from "@/lib/store";
import { timeAgo } from "@/lib/utils";
import { cx } from "@/lib/utils";
import {
  RESPONSE_TARGETS, TICKET_CATEGORIES, TICKET_PRIORITIES,
  createSupportTicket, getSupportTicket, loadSupportTickets, replySupportTicket, ticketAge,
  type SupportTicket, type TicketCategory, type TicketPriority,
} from "@/lib/support";

// ── Support ──────────────────────────────────────────────────────────────────
// Any operator can raise a ticket here; it is submitted **as the organization**,
// with the operator recorded as the submitter so support knows who to answer.
// The thread refreshes on its own while it is open, so a reply from the desk
// shows up without a manual reload — "real-time" for a support queue means you
// are not the one polling.

const THREAD_POLL_MS = 10_000;

const QUICK_LINKS: { label: string; to: string; hint: string }[] = [
  { label: "Documentation & Help Centre", to: "/docs", hint: "Setup, day-to-day use and integrations" },
  { label: "Support how-to", to: "/docs/howto-app-15", hint: "Raising and working a ticket" },
  { label: "Frequently asked questions", to: "/docs/faq", hint: "Answers for common questions" },
  { label: "Privacy & security", to: "/docs/privacy-trust", hint: "How your data is held" },
];

// Plan upgrades and billing are a company-admin action on the Platform —
// operators sign in here with a login link, not a company password, so this
// is a note, not a link they could actually complete.
const BILLING_NOTE = {
  label: "Plans, billing & credits",
  hint: "Ask your organization admin — upgrades and renewals are managed on the Platform",
};

export default function Support() {
  const { toast, session } = useStore();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // The floating assistant links here with ?new=1 so "open a ticket" lands on the
  // form, not a list the user then has to find the button in.
  const [params, setParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(() => params.get("new") === "1");

  const closeCreate = () => {
    setCreateOpen(false);
    if (params.get("new")) {
      const next = new URLSearchParams(params);
      next.delete("new");
      setParams(next, { replace: true });
    }
  };

  // Re-open when the assistant is used again while already on this page.
  useEffect(() => {
    if (params.get("new") === "1") setCreateOpen(true);
  }, [params]);

  // New-ticket form
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<TicketCategory>("technical");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [submitting, setSubmitting] = useState(false);

  // Reply
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      setTickets(await loadSupportTickets());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load support tickets.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Live thread: refresh the open ticket (and the list) while it is open, so a
  // desk reply appears without the operator reloading the page.
  const selectedId = selected?.id ?? null;
  const pollRef = useRef<number | null>(null);
  useEffect(() => {
    if (selectedId == null) return;
    const tick = async () => {
      try {
        const fresh = await getSupportTicket(selectedId);
        setSelected(fresh);
      } catch {
        /* keep the last good thread */
      }
    };
    pollRef.current = window.setInterval(() => void tick(), THREAD_POLL_MS);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [selectedId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subject.trim().length < 3 || body.trim().length < 1) {
      toast("warning", "Add a subject and details", "Both are needed before support can help.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await createSupportTicket({
        subject: subject.trim(),
        body: body.trim(),
        category,
        priority,
        submitter_name: session?.userName || undefined,
        submitter_email: session?.userEmail || undefined,
      });
      toast("success", "Ticket submitted", `${created.reference ?? "Your ticket"} is with the support desk — ${RESPONSE_TARGETS[priority]}.`);
      setCreateOpen(false);
      setSubject("");
      setBody("");
      await load(true);
      setSelected(created);
    } catch (err) {
      toast("error", "Could not submit the ticket", err instanceof Error ? err.message : undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      const updated = await replySupportTicket(selected.id, reply.trim());
      setSelected(updated);
      setReply("");
      void load(true);
    } catch (err) {
      toast("error", "Could not send the reply", err instanceof Error ? err.message : undefined);
    } finally {
      setSending(false);
    }
  };

  if (loading && !tickets.length) return <PageSkeleton variant="list" rows={5} actions />;
  if (error && !tickets.length) {
    return <ErrorState onRetry={() => void load()} body={error} />;
  }

  // ── Thread view ────────────────────────────────────────────────────────────
  if (selected) {
    const closed = ["resolved", "closed"].includes(selected.status);
    return (
      <div className="mx-auto max-w-[900px]">
        <PageHeader
          title={selected.subject}
          description={`${selected.reference ?? `#${selected.id}`} · ${selected.category ?? "general"} · opened ${timeAgo(selected.created_at)}`}
          actions={
            <div className="flex items-center gap-2">
              <button onClick={() => { void load(true); }} className="btn-ghost text-xs !py-2" title="Refresh thread">
                <RefreshCw size={13} className={cx("inline", refreshing && "animate-spin")} />
              </button>
              <button onClick={() => setSelected(null)} className="btn-secondary text-xs !py-2">
                <ArrowLeft size={13} className="mr-1.5 inline" /> All tickets
              </button>
            </div>
          }
        />

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <StatusBadge status={selected.status} />
          <span className="chip border-phantix-600/50 bg-phantix-800/60 capitalize text-slate-400">{selected.priority}</span>
          {selected.assigned_to && (
            <span className="chip border-phantix-600/50 bg-phantix-800/60 text-slate-400">
              <ShieldCheck size={11} className="mr-1 inline" /> {selected.assigned_to}
            </span>
          )}
          <span className="chip border-phantix-700 text-slate-500">
            <Clock size={11} className="mr-1 inline" /> updates automatically
          </span>
        </div>

        <Card>
          <CardHeader
            title="Conversation"
            subtitle={selected.submitter_name ? `Raised by ${selected.submitter_name} on behalf of your organization` : "Organization ticket"}
          />
          <div className="space-y-3">
            {(selected.messages ?? []).filter((m) => !m.is_internal).map((m, i) => {
              const mine = m.author_type === "customer";
              return (
                <div key={m.id ?? i} className={cx("flex", mine ? "justify-end" : "justify-start")}>
                  <div
                    className={cx(
                      "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-6",
                      mine
                        ? "rounded-br-sm border border-gold-400/25 bg-gold-400/10 text-gold-100"
                        : "rounded-bl-sm border border-phantix-700 bg-phantix-900/60 text-slate-300",
                    )}
                  >
                    <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">
                      {m.author_name || (mine ? "You" : "SecureGraph Support")} · {timeAgo(m.created_at)}
                    </p>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                  </div>
                </div>
              );
            })}
            {!(selected.messages ?? []).length && (
              <p className="py-4 text-center text-xs text-slate-500">No messages on this ticket yet.</p>
            )}
          </div>

          {closed ? (
            <p className="mt-4 rounded-md border border-phantix-700/50 bg-phantix-950/50 p-3 text-[11px] text-slate-500">
              This ticket is {selected.status}. Open a new ticket if the issue returns.
            </p>
          ) : (
            <div className="mt-4 flex gap-2">
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendReply(); } }}
                placeholder="Reply to support…"
                className="input flex-1 !py-2 !text-xs"
              />
              <button onClick={() => void sendReply()} disabled={sending || !reply.trim()} className="btn-primary text-xs !py-2 disabled:opacity-40">
                {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} className="mr-1.5 inline" />}
                Send
              </button>
            </div>
          )}
        </Card>
      </div>
    );
  }

  // ── List + real-time help ──────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Support"
        description="Reach the SecureGraph support desk. Tickets are raised on behalf of your organization and answered here and by email."
        actions={
          <span className="flex items-center gap-2">
            <DocLink docId="howto-app-15" label="Support how-to" />
            <button className="btn-primary" onClick={() => setCreateOpen(true)}>
              <Plus size={15} className="mr-1.5 inline" /> New ticket
            </button>
          </span>
        }
      />

      {/* Real-time help + documentation, side by side. */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Real-time help" subtitle="Fastest first, depending on what you need" />
          <div className="space-y-2.5">
            <button
              onClick={() => setCreateOpen(true)}
              className="flex w-full items-start gap-3 rounded-lg border border-gold-400/30 bg-gold-400/[0.07] px-3.5 py-3 text-left transition-colors hover:bg-gold-400/[0.12]"
            >
              <MessageSquare size={16} className="mt-0.5 shrink-0 text-gold-300" />
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-gold-200">Start a ticket now</span>
                <span className="block text-[11px] leading-5 text-gold-100/80">
                  Answered in-thread and by email. First response {RESPONSE_TARGETS[priority]} at {priority} priority.
                </span>
              </span>
            </button>
            <a href="mailto:support@phantixlabs.com" className="flex items-start gap-3 rounded-lg border border-phantix-700/50 px-3.5 py-3 transition-colors hover:bg-phantix-800/40">
              <Mail size={16} className="mt-0.5 shrink-0 text-slate-400" />
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-slate-200">Email support</span>
                <span className="block text-[11px] leading-5 text-slate-500">support@phantixlabs.com — include your org and any job/campaign IDs.</span>
              </span>
            </a>
            <div className="flex items-start gap-3 rounded-lg border border-severity-critical/25 bg-severity-critical/[0.06] px-3.5 py-3">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-severity-critical" />
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-severity-critical">Live security incident</span>
                <span className="block text-[11px] leading-5 text-red-200/85">
                  Raise a ticket with <strong>Critical</strong> priority and category “Security incident” — it is triaged first.
                </span>
              </span>
            </div>
          </div>

          <div className="mt-4 rounded-md border border-phantix-700/50 bg-phantix-950/40 p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">First-response targets</p>
            <div className="mt-2 space-y-1">
              {TICKET_PRIORITIES.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 text-[11px]">
                  <span className="text-slate-400">{p.label}</span>
                  <span className="text-slate-500">{RESPONSE_TARGETS[p.id]}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Documentation" subtitle="Most answers are already written down" />
          <div className="space-y-1.5">
            {QUICK_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="flex items-center gap-3 rounded-lg border border-phantix-700/40 px-3.5 py-2.5 transition-colors hover:border-gold-400/30 hover:bg-phantix-800/40"
              >
                <BookOpen size={14} className="shrink-0 text-gold-400" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-slate-200">{l.label}</span>
                  <span className="block text-[11px] text-slate-500">{l.hint}</span>
                </span>
                <ExternalLink size={12} className="shrink-0 text-slate-600" />
              </Link>
            ))}
            {/* Not a link — an operator has no company password to complete a
                billing redirect, so this names who can act instead. */}
            <div className="flex items-center gap-3 rounded-lg border border-phantix-700/40 px-3.5 py-2.5">
              <ShieldCheck size={14} className="shrink-0 text-gold-400" />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-slate-200">{BILLING_NOTE.label}</span>
                <span className="block text-[11px] text-slate-500">{BILLING_NOTE.hint}</span>
              </span>
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-5 text-slate-500">
            Support is available to every operator in your organization; tickets are owned by the organization, and
            the person who raised one is recorded so the desk knows who to answer.
          </p>
        </Card>
      </div>

      {/* Tickets */}
      <Card>
        <CardHeader
          title="Your tickets"
          subtitle={tickets.length ? `${tickets.length} ticket${tickets.length === 1 ? "" : "s"}` : "Nothing open"}
          action={
            <button onClick={() => { setRefreshing(true); void load(true); }} className="btn-ghost text-xs !py-1.5" title="Refresh">
              <RefreshCw size={12} className={cx("inline", refreshing && "animate-spin")} />
            </button>
          }
        />
        {!tickets.length ? (
          <EmptyState
            icon={<LifeBuoy size={22} />}
            title="No tickets yet"
            body="Raise one above — or use the Support switch in the assistant at the bottom-right of any page."
          />
        ) : (
          <div className="space-y-2">
            {tickets.map((t) => (
              <motion.button
                key={t.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setSelected(t)}
                className="flex w-full flex-wrap items-center gap-3 rounded-md border border-phantix-700 bg-phantix-900/60 p-3 text-left transition-colors hover:border-gold-400/30"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-phantix-800/70 text-gold-400">
                  <MessageSquare size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-slate-200">{t.subject}</span>
                  <span className="block text-[11px] text-slate-500">
                    {t.reference ?? `#${t.id}`}
                    {t.category ? ` · ${t.category.replace(/_/g, " ")}` : ""}
                    {` · ${t.message_count ?? t.messages?.length ?? 0} message${(t.message_count ?? t.messages?.length ?? 0) === 1 ? "" : "s"}`}
                    {` · updated ${timeAgo(ticketAge(t))}`}
                  </span>
                </span>
                <span className="chip shrink-0 border-phantix-600/50 bg-phantix-800/60 capitalize text-slate-400">{t.priority}</span>
                <StatusBadge status={t.status} />
              </motion.button>
            ))}
          </div>
        )}
      </Card>

      {/* New ticket */}
      <Modal open={createOpen} onClose={closeCreate} title="New support ticket" wide>
        <form className="space-y-4" onSubmit={submit}>
          <p className="rounded-md border border-phantix-700/50 bg-phantix-950/50 p-3 text-[11px] leading-5 text-slate-500">
            Submitting as <span className="font-semibold text-slate-300">{session?.userName || "your operator account"}</span> on behalf of
            your organization. The ticket is owned by the organization and shared with your teammates.
          </p>
          <div>
            <label className="label" htmlFor="sup-subject">Subject</label>
            <input id="sup-subject" className="input mt-1" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Short summary" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="sup-category">Category</label>
              <select id="sup-category" className="input mt-1" value={category} onChange={(e) => setCategory(e.target.value as TicketCategory)}>
                {TICKET_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="sup-priority">Priority</label>
              <select id="sup-priority" className="input mt-1" value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}>
                {TICKET_PRIORITIES.map((p) => <option key={p.id} value={p.id}>{p.label} — {p.hint}</option>)}
              </select>
              <p className="mt-1 text-[11px] text-slate-500">First response {RESPONSE_TARGETS[priority]}.</p>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="sup-body">Details</label>
            <textarea
              id="sup-body"
              className="input mt-1 min-h-[130px] resize-y"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What happened, what you expected, and any job / campaign / model IDs…"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="btn-ghost text-xs !py-2">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary text-xs !py-2">
              {submitting ? <Loader2 size={13} className="mr-1.5 inline animate-spin" /> : <Send size={13} className="mr-1.5 inline" />}
              Submit ticket
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
