import React, { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Download, Send, Loader2, FileText } from "lucide-react";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { PageHeader, Card, CardHeader, EmptyState, Spinner } from "@/components/ui";
import { cx } from "@/lib/utils";

// ── Settings → Privacy: NDPA §34–37 data-subject requests (staging-rollout §2) ──
// POST/GET /api/v1/organizations/me/data-subject-request, beside the privacy
// notice copy from GET /api/v1/organizations/privacy.

type RequestType = "access" | "rectification" | "erasure" | "portability" | "restriction" | "objection";

const REQUEST_TYPES: { id: RequestType; label: string; helper: string }[] = [
  { id: "access", label: "Access my data", helper: "See what personal data we hold about you and how it is used." },
  { id: "rectification", label: "Correct my data", helper: "Fix inaccurate or incomplete personal data." },
  { id: "erasure", label: "Delete my data", helper: "Ask us to erase your personal data (\"right to be forgotten\")." },
  { id: "portability", label: "Take my data elsewhere", helper: "Receive a machine-readable copy you can move to another provider." },
  { id: "restriction", label: "Restrict processing", helper: "Limit how your data is processed while we review your request." },
  { id: "objection", label: "Object to processing", helper: "Object to a specific use of your personal data." },
];

interface DsrRequest {
  id: number;
  reference: string;
  request_type: RequestType;
  details?: string | null;
  contact_email?: string | null;
  status: string;
  resolved_at?: string | null;
  created_at?: string;
}

interface PrivacyNotice {
  version?: string;
  title?: string;
  summary?: string;
  highlights?: string[];
  [k: string]: unknown;
}

const STATUS_COLORS: Record<string, string> = {
  received: "border-gold-400/30 bg-gold-400/10 text-gold-300",
  in_progress: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  completed: "border-emerald-400/30 bg-emerald-400/10 text-emerald-400",
  rejected: "border-severity-critical/30 bg-severity-critical/10 text-severity-critical",
};

function typeLabel(t: RequestType): string {
  return REQUEST_TYPES.find((r) => r.id === t)?.label ?? t;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function Privacy() {
  const { toast } = useStore();
  const [notice, setNotice] = useState<PrivacyNotice | null>(null);
  const [requests, setRequests] = useState<DsrRequest[] | null>(null);
  const [loadingNotice, setLoadingNotice] = useState(true);
  const [type, setType] = useState<RequestType | null>(null);
  const [details, setDetails] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const refreshList = useCallback(() => {
    api.get<DsrRequest[]>("/organizations/me/data-subject-request").then(setRequests).catch(() => setRequests([]));
  }, []);

  useEffect(() => {
    api
      .get<PrivacyNotice>("/organizations/privacy")
      .then(setNotice)
      .catch(() => setNotice(null))
      .finally(() => setLoadingNotice(false));
    refreshList();
  }, [refreshList]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!type) return;
    setSubmitting(true);
    try {
      await api.post("/organizations/me/data-subject-request", {
        request_type: type,
        details: details.trim() || null,
        contact_email: contactEmail.trim() || null,
      });
      toast("success", "Request received", `${typeLabel(type)} — we will respond using the contact details on file.`);
      setType(null);
      setDetails("");
      refreshList();
    } catch (err) {
      toast("error", "Could not submit request", err instanceof Error ? err.message : "Try again");
    } finally {
      setSubmitting(false);
    }
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const blob = await api.download("/organizations/me/data-export");
      downloadBlob(blob, "phantix-my-data.json");
      toast("success", "Download started", "Your data export is ready.");
    } catch (err) {
      toast("error", "Export failed", err instanceof Error ? err.message : "Try again");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Privacy & data requests" description="Your rights under NDPA §34–37 — raise requests in product, not by email." />

      <Card>
        <CardHeader title="How we handle your data" subtitle={notice?.version ? `Privacy notice v${notice.version}` : "Privacy notice"} action={
          <button type="button" onClick={() => void exportData()} disabled={exporting} className="btn-secondary !px-3 !py-1.5 text-xs">
            {exporting ? <Loader2 size={13} className="mr-1.5 inline animate-spin" /> : <Download size={13} className="mr-1.5 inline" />}
            Download my data
          </button>
        } />
        {loadingNotice ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : notice?.summary ? (
          <div className="space-y-3 px-5 pb-5">
            <p className="text-sm leading-6 text-slate-400">{notice.summary}</p>
            {Array.isArray(notice.highlights) && notice.highlights.length > 0 && (
              <ul className="space-y-1.5">
                {notice.highlights.slice(0, 8).map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-500">
                    <ShieldCheck size={13} className="mt-0.5 shrink-0 text-gold-400" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="px-5 pb-5 text-sm leading-6 text-slate-500">
            We process personal data only to run your organisation's security programme, in line with our published
            privacy notice. You can request a copy, correction, erasure, portability, restriction or raise an objection below.
          </p>
        )}
      </Card>

      <Card>
        <CardHeader title="Raise a data subject request" subtitle="Choose the right — each is explained below" />
        <form onSubmit={submit} className="space-y-4 px-5 pb-5">
          <div className="grid gap-2 sm:grid-cols-2">
            {REQUEST_TYPES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setType(r.id)}
                className={cx(
                  "rounded-lg border px-3 py-2.5 text-left transition-colors",
                  type === r.id
                    ? "border-gold-400/50 bg-gold-400/10"
                    : "border-phantix-700/60 bg-phantix-900/40 hover:border-phantix-600",
                )}
              >
                <p className={cx("text-sm font-medium", type === r.id ? "text-gold-300" : "text-slate-200")}>{r.label}</p>
                <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{r.helper}</p>
              </button>
            ))}
          </div>
          <div>
            <label className="label">Details (optional)</label>
            <textarea
              className="input min-h-[72px] resize-y"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Anything that helps us act on your request, e.g. which data you believe is affected."
            />
          </div>
          <div>
            <label className="label">Contact email (optional — defaults to your organisation's primary contact)</label>
            <input type="email" className="input" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="you@company.com" />
          </div>
          <button type="submit" className="btn-primary w-full !py-2.5" disabled={!type || submitting}>
            {submitting ? <Loader2 size={14} className="mr-1.5 inline animate-spin" /> : <Send size={14} className="mr-1.5 inline" />}
            Submit {type ? typeLabel(type) : "request"}
          </button>
        </form>
      </Card>

      <Card>
        <CardHeader title="Your requests" subtitle="Reference · type · status" />
        <div className="px-5 pb-5">
          {requests === null ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : requests.length === 0 ? (
            <EmptyState icon={<FileText size={20} />} title="No requests yet" body="Raise a request above and track its status here." />
          ) : (
            <div className="space-y-2">
              {requests.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-phantix-900/50 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-200">
                      <span className="font-mono text-gold-400">{r.reference}</span>
                      <span className="mx-2 text-slate-600">·</span>
                      {typeLabel(r.request_type)}
                    </p>
                    {r.details && <p className="mt-0.5 truncate text-[11px] text-slate-500">{r.details}</p>}
                  </div>
                  <span className={cx("chip !px-2 !py-0.5 text-[10px] capitalize", STATUS_COLORS[r.status] ?? "border-phantix-600/50 bg-phantix-800/60 text-slate-300")}>
                    {r.status.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
