import type { CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { Markdown } from "../components/Markdown";
import { ErrorState, LoadingState, Shell } from "../components/States";
import { track } from "../lib/analytics";
import { useReadTracking } from "../lib/useAnalytics";
import { useIssue, usePost } from "../lib/useContent";

const d = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

export function Post() {
  const { slug } = useParams<{ slug: string }>();
  const { issue } = useIssue();
  const { post, loading, error } = usePost(slug);
  useReadTracking(slug);

  if (loading) return <Shell><LoadingState /></Shell>;
  if (error || !post || !issue) return <Shell><ErrorState message={error} notFound={/not found|404/i.test(error ?? "")} /></Shell>;

  return (
    <main className="desk desk-full">
      <article className="article-sheet">
        <header className="masthead" data-reveal style={d(0)}>
          <div className="masthead-line">
            <span>{issue.name}</span>
            <span>{issue.number} · {issue.date}</span>
            <span>Folio {issue.folio}</span>
          </div>
        </header>

        <div className="post-cover">
          <p className="kicker" data-reveal style={d(70)}>{post.kicker ?? issue.kicker}</p>
          <h1 className="post-title" data-reveal style={d(140)}>{post.title}</h1>
          <p className="post-byline" data-reveal style={d(210)}>
            {post.no ? `No. ${post.no} · ` : ""}{issue.byline}{post.date ? ` · ${post.date}` : ""}
          </p>
        </div>

        {post.excerpt ? <p className="post-standfirst" data-reveal style={d(240)}>{post.excerpt}</p> : null}

        <div className="article" data-reveal style={d(280)}>
          <Markdown>{post.body}</Markdown>
        </div>

        <footer className="post-footer" data-reveal style={d(350)}>
          <Link className="back-link" to="/">← Back to this week's issue</Link>
          <div className="colophon">
            <p className="colophon-label">{issue.newsletterLabel}</p>
            <p>{issue.newsletterBlurb}</p>
            <a
              className="subscribe"
              href={issue.newsletterUrl}
              onClick={() => track({ type: "subscribe_click" })}
            >
              Subscribe <span aria-hidden="true">→</span>
            </a>
          </div>
        </footer>

        <span className="folio" aria-hidden="true">Folio {issue.folio}</span>
      </article>
    </main>
  );
}
