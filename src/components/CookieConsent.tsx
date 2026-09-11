import { useState } from "react";
import { Link } from "react-router-dom";
import { Cookie } from "lucide-react";
import { COOKIE_POLICY_PATH, getConsent, setConsent } from "@/lib/consent";
import { onConsentAccepted } from "@/lib/analytics";

// ── Analytics consent banner ─────────────────────────────────────────────────
// Shown until the operator accepts or declines. Analytics only starts on
// accept; declining is remembered and sends nothing. Non-blocking by design —
// it never covers the app or traps focus.

export default function CookieConsent() {
  const [open, setOpen] = useState(() => getConsent() === null);

  if (!open) return null;

  const choose = (choice: "accepted" | "declined") => {
    setConsent(choice);
    if (choice === "accepted") onConsentAccepted();
    setOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Analytics consent"
      className="fixed inset-x-0 bottom-0 z-[70] border-t border-phantix-700/60 bg-phantix-900/95 px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
        <Cookie size={16} className="shrink-0 text-gold-300" />
        <p className="min-w-0 flex-1 text-xs leading-5 text-slate-300">
          We use <strong className="text-slate-200">first-party analytics</strong> to understand how the
          Command Centre is used — page path, referrer and coarse device info, with no cookies, no
          fingerprints and no personal data. Read our{" "}
          <Link to={COOKIE_POLICY_PATH} className="text-gold-300 underline hover:text-gold-200">
            cookies &amp; analytics policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button className="btn-ghost !px-3 !py-1.5 text-xs" onClick={() => choose("declined")}>
            Decline
          </button>
          <button className="btn-primary !px-3 !py-1.5 text-xs" onClick={() => choose("accepted")}>
            Accept analytics
          </button>
        </div>
      </div>
    </div>
  );
}
