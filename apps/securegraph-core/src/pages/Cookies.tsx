import React from "react";
import { Cookie, ShieldCheck, RefreshCw } from "lucide-react";
import { PageHeader, Card, CardHeader } from "@/components/ui";
import { clearConsent, getConsent } from "@/lib/consent";

// ── Cookies & analytics policy ───────────────────────────────────────────────
// Public page (no auth) linked from the consent banner. States exactly what the
// first-party analytics records and how to change your choice.

export default function Cookies() {
  const consent = getConsent();

  const reset = () => {
    clearConsent();
    window.location.reload();
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader
        title="Cookies & analytics"
        description="What we measure, why, and how to change your choice."
      />

      <div className="space-y-5">
        <Card>
          <CardHeader
            title="We do not use advertising cookies"
            subtitle="No third-party trackers, no cross-site profiling."
            action={<Cookie size={16} className="text-gold-300" />}
          />
          <div className="space-y-3 text-sm leading-6 text-slate-300">
            <p>
              SecureGraph uses <strong className="text-slate-100">first-party, cookieless analytics</strong> to
              understand how the product is used so we can improve it. We do <strong>not</strong> use
              advertising cookies, we do <strong>not</strong> sell data, and we do <strong>not</strong> track
              you across other sites.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title="What the analytics records" subtitle="Aggregate page usage only" />
          <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6 text-slate-300">
            <li>Page path and the referring page</li>
            <li>Coarse device info: screen size, browser language and time zone</li>
            <li>Campaign parameters (UTM) when a link carries them</li>
            <li>A random per-session id kept in <code>sessionStorage</code> — not a cookie, cleared when the tab closes</li>
            <li>Severity-level event counts for product features you use</li>
          </ul>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            It does <strong>not</strong> record your name, email, IP-linked identity, keystrokes, page content,
            or any personal data. We honour <code>Do Not Track</code> and a deployment kill-switch.
          </p>
        </Card>

        <Card>
          <CardHeader
            title="Your choice"
            subtitle="Analytics runs only after you accept"
            action={<ShieldCheck size={16} className="text-emerald-300" />}
          />
          <p className="text-sm leading-6 text-slate-300">
            You can accept or decline analytics at any time. Declining stops all beacons; nothing else in the
            product is affected.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Current choice:{" "}
            <strong className="text-slate-300">
              {consent === "accepted" ? "Accepted" : consent === "declined" ? "Declined" : "Not set"}
            </strong>
          </p>
          <button className="btn-secondary mt-4 text-xs" onClick={reset}>
            <RefreshCw size={13} className="mr-1.5 inline" /> Change my choice
          </button>
        </Card>

        <Card>
          <CardHeader title="Retention & contact" subtitle="Governed by the privacy notice" />
          <p className="text-sm leading-6 text-slate-300">
            Analytics records are retained in aggregate for product measurement and are not used to identify
            you. For access, correction or erasure requests, use the data-subject request tool in
            <span className="text-slate-200"> Settings → Privacy</span>, or contact our Data Protection Officer.
          </p>
        </Card>
      </div>
    </div>
  );
}
