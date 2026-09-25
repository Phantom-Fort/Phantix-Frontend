import { Link, useLocation } from "react-router-dom";
import { track } from "../lib/analytics";
import { ISSUE } from "../lib/config";

export function Header() {
  const { pathname } = useLocation();
  const onPost = pathname.startsWith("/posts/");

  return (
    <header className="site-header">
      <Link className="site-brand" to="/" aria-label="The SecureGraph Weekly, this week's issue">
        The SecureGraph <span>Weekly</span>
      </Link>
      <nav className="site-nav" aria-label="The Weekly">
        {onPost && (
          <Link className="site-nav-link" to="/">
            ← This week's issue
          </Link>
        )}
        <a
          className="site-nav-link site-nav-cta"
          href={ISSUE.newsletterUrl}
          onClick={() => track({ type: "subscribe_click" })}
        >
          Subscribe
        </a>
      </nav>
    </header>
  );
}
