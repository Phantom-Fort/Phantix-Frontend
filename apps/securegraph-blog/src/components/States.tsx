import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="desk desk-full">
      <div className="state-sheet">{children}</div>
    </main>
  );
}

export function LoadingState() {
  return (
    <p className="state-note" role="status">
      Setting this week's issue…
    </p>
  );
}

export function ErrorState({ message, notFound }: { message: string | null; notFound?: boolean }) {
  if (notFound) {
    return (
      <div className="state-note" role="alert">
        <p className="state-title">This essay isn't in the Weekly.</p>
        <p className="state-hint">
          It may have been moved or taken down by the editors.{" "}
          <Link className="md-a" to="/">Back to this week's issue</Link>
        </p>
      </div>
    );
  }
  return (
    <div className="state-note" role="alert">
      <p className="state-title">This week's issue didn't arrive.</p>
      {message ? <p className="state-detail">{message}</p> : null}
      <p className="state-hint">
        Refresh in a moment. If it still won't load, the Weekly's content
        service is unreachable — or unset VITE_BLOG_API_URL to read the bundled
        demo issue.
      </p>
    </div>
  );
}
