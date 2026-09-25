import { ISSUE } from "./config";
import { parsePostFile } from "./frontmatter";
import type { Post, PostSummary } from "./types";

/**
 * Demo mode: the bundled Markdown files double as (a) a zero-backend way to run
 * the blog and (b) the reference format the admin backend should return. They
 * live in src/content/posts/ and are compiled in at build time.
 */
const files = import.meta.glob("../content/posts/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const DEMO_POSTS: Post[] = Object.entries(files)
  .map(([path, raw]) => parsePostFile(path, raw))
  .sort((a, b) => a.order - b.order);

export const DEMO_SUMMARIES: PostSummary[] = DEMO_POSTS.map((p) => ({
  slug: p.slug,
  title: p.title,
  no: p.no,
  order: p.order,
  date: p.date,
  kicker: p.kicker,
  excerpt: p.excerpt,
  featured: p.featured,
}));

export const DEMO_ISSUE = ISSUE;
