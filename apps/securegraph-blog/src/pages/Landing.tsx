import { forwardRef, type CSSProperties, type ForwardedRef } from "react";
import { Link } from "react-router-dom";
import { Markdown } from "../components/Markdown";
import { ErrorState, LoadingState, Shell } from "../components/States";
import { track } from "../lib/analytics";
import { useGutterParallax, useInView, useReducedMotion } from "../lib/motion";
import { useIssue, usePost } from "../lib/useContent";
import type { IssueMeta, Post, PostSummary } from "../lib/types";

const d = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

export function Landing() {
  const { issue, posts, loading, error } = useIssue();
  const featuredSlug = posts.find((p) => p.featured)?.slug ?? posts[0]?.slug;
  const { post: featured } = usePost(featuredSlug);

  const reduce = useReducedMotion();
  const sheetRef = useGutterParallax<HTMLElement>(!reduce);
  const [pullRef, pullInView] = useInView<HTMLElement>(0.35);

  if (loading) return <Shell><LoadingState /></Shell>;
  if (error || !issue) return <Shell><ErrorState message={error} /></Shell>;

  const rest = posts.filter((p) => p.slug !== featuredSlug);

  return (
    <main className="desk desk-book">
      <article className="sheet" ref={sheetRef}>
        <section className="page page-left">
          <Masthead issue={issue} />
          <Cover issue={issue} />
          {featured ? <FeaturedEssay post={featured} /> : null}
          <span className="folio" aria-hidden="true">{issue.folio.split("–")[0] ?? "01"}</span>
        </section>

        <div className="gutter" aria-hidden="true">
          <span className="gutter-shadow" />
          <span className="gutter-hairline" />
        </div>

        <section className="page page-right">
          <PullQuote ref={pullRef} inView={reduce || pullInView} issue={issue} />
          <Contents posts={posts} />
          {rest.map((p) => (
            <SectionSummary key={p.slug} post={p} />
          ))}
          <Colophon issue={issue} />
          <span className="folio" aria-hidden="true">{issue.folio.split("–")[1] ?? "02"}</span>
        </section>
      </article>
    </main>
  );
}

function Masthead({ issue }: { issue: IssueMeta }) {
  return (
    <header className="masthead" data-reveal style={d(0)}>
      <div className="masthead-line">
        <span>{issue.name}</span>
        <span>{issue.number} · {issue.date}</span>
        <span>Folio {issue.folio}</span>
      </div>
    </header>
  );
}

function Cover({ issue }: { issue: IssueMeta }) {
  const [before, emphasis, after] = splitEmphasis(issue.name);
  return (
    <div className="cover">
      <p className="kicker" data-reveal style={d(70)}>{issue.kicker}</p>
      <h1 className="coverline" data-reveal style={d(140)}>
        {before}{emphasis ? <em>{emphasis}</em> : null}{after}
      </h1>
      <p className="deck" data-reveal style={d(210)}>{issue.deck}</p>
      <div className="byline" data-reveal style={d(280)}>
        <span>{issue.byline}</span>
        <span aria-hidden="true">·</span>
        <a href={issue.newsletterUrl} onClick={() => track({ type: "subscribe_click" })}>
          Subscribe
        </a>
      </div>
    </div>
  );
}

/** Italicise "Weekly" in the cover line, or the last word if the name changes. */
function splitEmphasis(name: string): [string, string, string] {
  const idx = name.indexOf("Weekly");
  if (idx !== -1) return [name.slice(0, idx), "Weekly", name.slice(idx + "Weekly".length)];
  const last = name.lastIndexOf(" ");
  if (last === -1) return ["", name, ""];
  return [name.slice(0, last + 1), name.slice(last + 1), ""];
}

/** The opening paragraphs of an essay, for the cover teaser. */
function leadParagraphs(body: string, count = 2): string {
  return body
    .split(/\r?\n\s*\r?\n/)
    .map((b) => b.trim())
    .filter((b) => b && !/^(#|>|[-*+] |\d+\. |```|!\[|\|)/.test(b))
    .slice(0, count)
    .join("\n\n");
}

function FeaturedEssay({ post }: { post: Post }) {
  return (
    <section className="sec" data-reveal style={d(350)}>
      <p className="sec-no">{post.no}</p>
      <h2 className="sec-title">{post.title}</h2>
      {post.excerpt ? <p className="essay-standfirst">{post.excerpt}</p> : null}
      <div className="essay">
        <Markdown>{leadParagraphs(post.body)}</Markdown>
      </div>
      <Link className="readmore" to={`/posts/${post.slug}`}>
        Read the full essay <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}

const PullQuote = forwardRef<HTMLElement, { inView: boolean; issue: IssueMeta }>(
  function PullQuote({ inView, issue }, ref: ForwardedRef<HTMLElement>) {
    return (
      <figure
        className={`pull${inView ? " inview" : ""}`}
        id="pull"
        ref={ref}
        data-reveal
        style={d(90)}
      >
        <blockquote className="pull-quote">
          {issue.pullQuote}
          <span className="pull-underline" aria-hidden="true" />
        </blockquote>
        <figcaption className="cite">— {issue.pullCite}</figcaption>
      </figure>
    );
  }
);

function Contents({ posts }: { posts: PostSummary[] }) {
  return (
    <nav className="toc" aria-label="Contents" data-reveal style={d(160)}>
      <p className="toc-label">Contents</p>
      <ol className="toc-list">
        {posts.map((p) => (
          <li key={p.slug}>
            <Link to={`/posts/${p.slug}`}>
              <span className="toc-no">{p.no}</span>
              <span className="toc-title">{p.title}</span>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function SectionSummary({ post }: { post: PostSummary }) {
  return (
    <section className="sec" data-reveal style={d(220)}>
      <p className="sec-no">{post.no}</p>
      <h2 className="sec-title">{post.title}</h2>
      <div className="sec-body">
        <p>{post.excerpt}</p>
      </div>
      <Link className="readmore" to={`/posts/${post.slug}`}>
        Read the full essay <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}

function Colophon({ issue }: { issue: IssueMeta }) {
  return (
    <div className="colophon" data-reveal style={d(430)}>
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
  );
}
