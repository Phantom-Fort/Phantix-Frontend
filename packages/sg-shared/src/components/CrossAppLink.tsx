import React, { useState } from "react";
import { Link } from "react-router-dom";
import { applicationHandoffHref, applicationTarget, type ApplicationKey } from "../applications";

/**
 * A link to a page that lives in another application.
 *
 * Since the split, a page can sit in Attack while the thing it points at sits
 * in Core — and a plain `<Link to="/integrations">` from Defend just falls into
 * that app's catch-all and bounces to its root. This resolves the right origin
 * and carries the session across it with a single-use handoff, so following the
 * link does not land the operator on a login screen.
 *
 * When the target turns out to be this same application, it renders an ordinary
 * router link and never touches the network.
 */
export function CrossAppLink({
  app,
  to,
  className,
  title,
  children,
}: {
  app: ApplicationKey;
  to: string;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const target = applicationTarget(app, to);

  if (!target.external) {
    return (
      <Link to={target.href} className={className} title={title}>
        {children}
      </Link>
    );
  }

  async function go(e: React.MouseEvent) {
    // Let the browser handle modified clicks (new tab) with the plain href.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    window.location.assign(await applicationHandoffHref(app, to));
  }

  return (
    <a href={target.href} onClick={go} className={className} title={title} aria-busy={busy}>
      {children}
    </a>
  );
}

export default CrossAppLink;
