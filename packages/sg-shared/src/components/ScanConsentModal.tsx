import React, { useEffect, useState } from "react";
import { ShieldCheck, ScrollText, AlertTriangle, Loader2 } from "lucide-react";
import { Modal } from "@sg/ui";
import { acceptScanConsent, type ScanConsentDocument } from "@sg/data";

/**
 * Scan-authorization consent gate.
 *
 * Shown when ``POST /scans/jobs`` returns 428 ``consent_required`` — i.e. the
 * scan targets an asset that is only *ownership-attested* (the operator confirmed
 * they own it; it was not auto-verified). The ownership attestation already
 * stands; this adds the Acceptable Use Policy and the generic Rules of
 * Engagement before active testing starts. Acceptance is versioned server-side,
 * so a new published version is asked for again.
 */
export default function ScanConsentModal({
  open,
  documents,
  missing,
  onClose,
  onAccepted,
}: {
  open: boolean;
  /** Documents from the 428 detail (or GET /scans/consent). */
  documents: ScanConsentDocument[];
  /** Keys still to accept; empty means "all shown". */
  missing: string[];
  onClose: () => void;
  /** Called after a successful acceptance so the caller can retry the scan. */
  onAccepted: () => void;
}) {
  const [acked, setAcked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAcked({});
      setError(null);
      setBusy(false);
    }
  }, [open]);

  const target = documents.filter((d) => missing.length === 0 || missing.includes(d.key));
  const allAcked = target.length > 0 && target.every((d) => acked[d.key]);

  const submit = async () => {
    if (!allAcked) return;
    setBusy(true);
    setError(null);
    try {
      const res = await acceptScanConsent(target.map((d) => d.key));
      if (res.missing.length) {
        setError("Some documents were not accepted. Review and try again.");
        setBusy(false);
        return;
      }
      onAccepted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record acceptance");
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Scan authorization required" wide>
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 rounded-md border border-severity-medium/30 bg-severity-medium/10 px-3.5 py-3">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-severity-medium" />
          <p className="text-[13px] leading-5 text-slate-300">
            This scan targets assets that are <strong>not automatically verified</strong> — you
            confirmed ownership rather than proving it. Accept the documents below before testing.
            Your ownership attestation still stands; this adds the acceptable-use and
            rules-of-engagement terms for active testing.
          </p>
        </div>

        <div className="max-h-[46vh] space-y-4 overflow-y-auto pr-1">
          {target.map((doc) => (
            <section
              key={doc.key}
              className="rounded-md border border-phantix-700/40 bg-phantix-950/50 p-4"
            >
              <header className="mb-2 flex items-start gap-2">
                <ScrollText size={15} className="mt-0.5 shrink-0 text-gold-400" />
                <div>
                  <h4 className="text-sm font-semibold text-slate-100">{doc.title || doc.key}</h4>
                  <p className="text-[12px] text-slate-500">
                    {doc.version ? `Version ${doc.version}` : ""}
                    {doc.effective ? `${doc.version ? " · " : ""}${doc.effective}` : ""}
                  </p>
                </div>
              </header>
              {doc.summary && (
                <p className="mb-3 text-[13px] leading-5 text-slate-400">{doc.summary}</p>
              )}
              <div className="space-y-2.5">
                {(doc.sections || []).map((s, i) => (
                  <div key={s.id || s.title || i}>
                    {s.title && (
                      <p className="text-[13px] font-medium text-slate-200">{s.title}</p>
                    )}
                    {s.body && <p className="text-[13px] leading-5 text-slate-400">{s.body}</p>}
                    {s.items && s.items.length > 0 && (
                      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] leading-5 text-slate-500">
                        {s.items.map((it, j) => (
                          <li key={j}>{it}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
              <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-md border border-phantix-700/40 bg-phantix-900/40 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={!!acked[doc.key]}
                  onChange={(e) => setAcked((p) => ({ ...p, [doc.key]: e.target.checked }))}
                  className="mt-0.5 rounded accent-gold-400"
                />
                <span className="text-[13px] leading-5 text-slate-300">
                  {doc.acceptance_required_copy || `I accept ${doc.title || doc.key}.`}
                </span>
              </label>
            </section>
          ))}
        </div>

        {error && <p className="text-[13px] text-severity-critical">{error}</p>}

        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary flex-1"
            onClick={() => void submit()}
            disabled={busy || !allAcked}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            Accept &amp; run scan
          </button>
        </div>
      </div>
    </Modal>
  );
}
