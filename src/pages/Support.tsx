import React, { useState } from "react";
import { motion } from "framer-motion";
import { LifeBuoy, Plus, MessageSquare } from "lucide-react";
import { PageHeader, Card, StatusBadge, Modal, EmptyState, Spinner, PageSkeleton, ErrorState } from "@/components/ui";
import DocLink from "@/components/DocLink";
import { loadSupportTickets } from "@/lib/data";
import { useResource } from "@/lib/useResource";
import { timeAgo } from "@/lib/utils";
import { useStore } from "@/lib/store";

export default function Support() {
  const { toast } = useStore();
  const { data: supportTickets, loading, error, reload } = useResource(loadSupportTickets, []);
  const [open, setOpen] = useState(false);

  if (loading) {
    return <PageSkeleton variant="list" rows={5} actions />;
  }

  if (error && supportTickets.length === 0) {
    return (
      <ErrorState
        onRetry={reload}
        body="We could not load support tickets. Check your connection and retry — your session stays signed in."
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1000px]">
      <PageHeader
        title="Support"
        description="Tickets route to the Phantix support desk. Staff reply from their console; you get email updates via alert SMTP."
        actions={<span className="flex items-center gap-2"><DocLink docId="howto-app-15" label="Support how-to" /><button className="btn-primary" onClick={() => setOpen(true)}><Plus size={15} /> New ticket</button></span>}
      />

      {supportTickets.length === 0 ? (
        <Card><EmptyState icon={<LifeBuoy size={22} />} title="No tickets yet" body="We're here when you need us." /></Card>
      ) : (
        <div className="space-y-3">
          {supportTickets.map((t, i) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card hover className="!p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-phantix-800/70 text-gold-400">
                    <MessageSquare size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-100">#{t.id} · {t.subject}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{(t.messages?.length ?? 0)} message{t.messages?.length !== 1 ? "s" : ""} · opened {timeAgo(t.created_at)}</p>
                  </div>
                  <span className="chip border-phantix-600/50 bg-phantix-800/60 text-slate-400 capitalize">{t.priority}</span>
                  <StatusBadge status={t.status} />
                </div>
                <div className="mt-3 rounded-xl border border-phantix-700/40 bg-phantix-950/50 p-3.5 text-xs leading-5 text-slate-400">
                  {t.messages?.[0] ? (
                    <>
                      <span className="font-semibold text-slate-300">{t.messages[0].from}:</span> {t.messages[0].body}
                    </>
                  ) : (
                    <span className="text-slate-500">No message preview available.</span>
                  )}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New support ticket">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setOpen(false);
            toast("success", "Ticket submitted", "POST /support/tickets --- the support team will reply shortly.");
          }}
        >
          <div>
            <label className="label">Subject</label>
            <input className="input" placeholder="Short summary" />
          </div>
          <div>
            <label className="label">Priority</label>
            <select className="input"><option>normal</option><option>high</option><option>low</option></select>
          </div>
          <div>
            <label className="label">Details</label>
            <textarea className="input min-h-[110px] resize-none" placeholder="What happened, what you expected, any job/campaign IDs..." />
          </div>
          <button className="btn-primary w-full">Submit ticket</button>
        </form>
      </Modal>
    </div>
  );
}
