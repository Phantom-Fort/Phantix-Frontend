import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Cookie } from "lucide-react";
import { COOKIE_POLICY_PATH, getConsent, setConsent } from "../consent";
import { onConsentAccepted } from "../analytics";
import { APP_URL } from "../config";

// ── Analytics consent banner ─────────────────────────────────────────────────
// Shown until the operator accepts or declines. Analytics only starts on
// accept; declining is remembered and sends nothing. Non-blocking by design —
// it never covers the app or traps focus.

export default function CookieConsent() {
  const [open, setOpen] = useState(() => getConsent() === null);

  const choose = (choice: "accepted" | "declined") => {
    setConsent(choice);
    if (choice === "accepted") onConsentAccepted();
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-live="polite"
          aria-label="Analytics consent"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-x-0 bottom-0 z-[70] border-t border-phantix-700/60 bg-phantix-900/95 px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur"
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2.5">
            <Cookie size={16} className="shrink-0 text-gold-300" />
            <p className="min-w-[15rem] flex-1 text-[13px] leading-5 text-slate-300">
              We use <strong className="text-slate-200">first-party analytics</strong> to understand how SecureGraph
              is used — page path, referrer and coarse device info, with no tracking cookies, no fingerprints
              and no personal data. Your choice applies to every SecureGraph app. Read our{" "}
              {/* The policy page lives on Core; Attack/Defend/Code have no such route. */}
              <a href={`${APP_URL}${COOKIE_POLICY_PATH}`} className="text-gold-300 underline hover:text-gold-200">
                cookies &amp; analytics policy
              </a>
              .
            </p>
            <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
              <button className="btn-secondary flex-1 !px-3 !py-2 text-[13px] sm:flex-none" onClick={() => choose("declined")}>
                Decline
              </button>
              <button className="btn-primary flex-1 !px-3 !py-2 text-[13px] sm:flex-none" onClick={() => choose("accepted")}>
                Accept analytics
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
