import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { marked, type Tokens } from "marked";
import { ArrowLeft, ArrowRight, ListTree, BookOpen } from "lucide-react";
import { docs, getDoc, extractToc, slugify, docCategories, resolveDocHref } from "@/lib/docs";
import { cx } from "@/lib/utils";
import { renderMermaid } from "@/lib/mermaid";
import { isFlowchart, renderFlowSvg } from "@/lib/flowChart";

// Configure marked once: heading ids for anchor scroll. Link handling is done in
// rewriteDocHtml so internal doc links resolve to /docs/:id and SPA-navigate.
marked.use({
  gfm: true,
  breaks: false,
  renderer: {
    heading({ tokens, depth }: Tokens.Heading) {
      const text = this.parser.parseInline(tokens);
      const raw = tokens.map((t) => t.raw).join("");
      const id = slugify(raw);
      if (depth >= 1 && depth <= 3) return `<h${depth} id="${id}">${text}</h${depth}>`;
      return `<h${depth}>${text}</h${depth}>`;
    },
  },
});

/** Rewrite relative `.md` cross-references to `/docs/:id`, external links, and
 *  swap bare-filename anchor text for the linked doc's title. */
function rewriteDocHtml(html: string, currentId: string, docsList: typeof docs): string {
  return html.replace(/<a href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/g, (match, href: string, rest: string, text: string) => {
    const resolved = resolveDocHref(href, currentId);
    let label = text;
    if (/\.md$/i.test(href)) {
      const base = href.split("/").pop() ?? "";
      const targetId = resolved.replace(/^\/docs\//, "");
      const target = docsList.find((d) => d.id === targetId);
      if (target && (!label.trim() || label.trim() === base)) label = target.title;
    }
    const external = /^https?:\/\//i.test(resolved);
    const attrs = external && !/target=/.test(rest) ? ' target="_blank" rel="noreferrer"' : "";
    return `<a href="${resolved}"${attrs}${rest}>${label}</a>`;
  });
}

export default function DocPage() {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();
  const doc = getDoc(docId ?? "");
  const [activeHeading, setActiveHeading] = useState<string>("");
  const articleRef = useRef<HTMLElement>(null);

  const html = useMemo(
    () => (doc ? rewriteDocHtml(marked.parse(doc.content) as string, doc.id, docs) : ""),
    [doc],
  );
  const toc = useMemo(() => (doc ? extractToc(doc.content) : []), [doc]);

  // Previous / next stay inside the same category so the trail is coherent.
  const categoryDocs = useMemo(() => (doc ? docs.filter((d) => d.category === doc.category) : []), [doc]);
  const catIdx = categoryDocs.findIndex((d) => d.id === docId);
  const prev = catIdx > 0 ? categoryDocs[catIdx - 1] : null;
  const next = catIdx >= 0 && catIdx < categoryDocs.length - 1 ? categoryDocs[catIdx + 1] : null;
  const category = docCategories.find((c) => c.id === doc?.category);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    setActiveHeading("");
  }, [docId]);

  // Hydrate ```mermaid fences into rendered diagrams after the marked HTML is
  // injected. Flowchart blocks render synchronously with the native renderer
  // (no flash); other diagram types hydrate via the lazy mermaid fallback.
  // Re-runs on doc change and on theme flips so diagrams always match the
  // active palette. Failed diagrams keep their raw source as a fallback.
  useEffect(() => {
    const hydrate = async () => {
      const article = articleRef.current;
      if (!article) return;
      const blocks = Array.from(article.querySelectorAll<HTMLElement>("pre > code.language-mermaid"));
      if (!blocks.length) return;
      for (const codeEl of blocks) {
        const pre = codeEl.closest("pre");
        if (!pre) continue;
        const code = codeEl.textContent ?? "";
        try {
          const svg = isFlowchart(code) ? renderFlowSvg(code) : await renderMermaid(code);
          if (svg) {
            const host = document.createElement("div");
            host.className = "mermaid-rendered";
            host.innerHTML = svg;
            pre.replaceWith(host);
          }
        } catch (err) {
          console.error("Mermaid render failed:", err);
        }
      }
    };
    void hydrate();
    const observer = new MutationObserver(() => {
      // Theme attribute flip re-renders diagrams with the new palette.
      if (articleRef.current) void hydrate();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, [html, doc?.id]);

  useEffect(() => {
    const headings = Array.from(document.querySelectorAll(".prose-doc h2[id], .prose-doc h3[id]"));
    if (!headings.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActiveHeading(e.target.id);
        }
      },
      { rootMargin: "-80px 0px -70% 0px" },
    );
    headings.forEach((h) => obs.observe(h));
    return () => obs.disconnect();
  }, [html]);

  // Internal anchors inside the rendered markdown should SPA-navigate (no reload).
  const handleArticleClick = (e: React.MouseEvent<HTMLElement>) => {
    const a = (e.target as HTMLElement).closest("a");
    if (!a) return;
    const href = a.getAttribute("href") || "";
    if (!href || /^https?:\/\//i.test(href) || href.startsWith("#") || e.defaultPrevented) return;
    e.preventDefault();
    navigate(href);
  };

  if (!doc) {
    return (
      <div className="mx-auto max-w-lg py-24 text-center">
        <BookOpen size={28} className="mx-auto text-slate-600" />
        <h1 className="mt-4 font-display text-xl font-bold text-white">Guide not found</h1>
        <Link to="/docs" className="btn-secondary mt-6 inline-flex"><ArrowLeft size={15} /> Back to docs</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* Breadcrumb */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex items-center gap-2 text-xs text-slate-500">
        <Link to="/docs" className="flex items-center gap-1.5 hover:text-gold-400">
          <ArrowLeft size={13} /> Documentation
        </Link>
        <span>/</span>
        <span>{category?.label}</span>
        <span>/</span>
        <span className="text-slate-300">{doc.title}</span>
      </motion.div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_260px]">
        {/* Content */}
        <motion.article
          key={doc.id}
          ref={articleRef}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="min-w-0"
          onClick={handleArticleClick}
        >
          <div className="mb-2 flex items-center gap-2">
            {doc.badge && <span className="chip border-gold-400/30 bg-gold-400/10 text-gold-300">{doc.badge}</span>}
            <span className="text-xs text-slate-600">{category?.label}</span>
          </div>
          <div
            className="prose-doc card !bg-phantix-900/45 max-w-none px-7 py-7 lg:px-10"
            dangerouslySetInnerHTML={{ __html: html }}
          />

          {/* Prev / next */}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {prev ? (
              <Link to={`/docs/${prev.id}`} className="card group p-4 transition-all hover:border-phantix-500/60">
                <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500">
                  <ArrowLeft size={11} /> Previous
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-200 group-hover:text-gold-300">{prev.title}</p>
              </Link>
            ) : <span />}
            {next && (
              <Link to={`/docs/${next.id}`} className="card group p-4 text-right transition-all hover:border-phantix-500/60">
                <p className="flex items-center justify-end gap-1.5 text-[11px] uppercase tracking-wider text-slate-500">
                  Next <ArrowRight size={11} />
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-200 group-hover:text-gold-300">{next.title}</p>
              </Link>
            )}
          </div>
        </motion.article>

        {/* TOC */}
        <aside className="hidden xl:block">
          <div className="sticky top-20">
            <div className="card p-4">
              <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                <ListTree size={13} /> On this page
              </p>
              <nav className="max-h-[62vh] space-y-0.5 overflow-y-auto pr-1">
                {toc.map((t) => (
                  <a
                    key={t.id}
                    href={`#${t.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(t.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className={cx(
                      "block rounded-lg px-2.5 py-1.5 text-xs leading-4 transition-colors",
                      t.depth === 3 && "pl-6",
                      activeHeading === t.id
                        ? "bg-gold-400/10 font-semibold text-gold-300"
                        : "text-slate-500 hover:bg-phantix-800/60 hover:text-slate-200",
                    )}
                  >
                    {t.text}
                  </a>
                ))}
                {toc.length === 0 && <p className="text-xs text-slate-600">No sections.</p>}
              </nav>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
