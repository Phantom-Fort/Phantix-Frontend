import { useState } from "react";
import { getConsent, setConsent } from "../lib/consent";
import { onConsentAccepted } from "../lib/analytics";

/**
 * Minimal, on-brand consent strip. First-party and cookieless analytics are
 * gated on acceptance; nothing is beaconed until the reader says yes.
 */
export function ConsentBanner() {
  const [visible, setVisible] = useState(() => getConsent() === null);

  if (!visible) return null;

  const accept = () => {
    setConsent("accepted");
    onConsentAccepted();
    setVisible(false);
  };
  const decline = () => {
    setConsent("declined");
    setVisible(false);
  };

  return (
    <div className="consent-banner" role="region" aria-label="Analytics consent">
      <p className="consent-copy">
        We count anonymous, cookieless page reads so we know which essays are worth
        writing more of. No tracking across sites and no personal data. Your choice covers every SecureGraph site.
      </p>
      <div className="consent-actions">
        <button type="button" className="consent-accept" onClick={accept}>
          Accept
        </button>
        <button type="button" className="consent-decline" onClick={decline}>
          Decline
        </button>
      </div>
    </div>
  );
}
