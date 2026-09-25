import { ISSUE } from "./config";
import { DEMO_POSTS, DEMO_SUMMARIES } from "./demo";
import type { IssueMeta, Post, PostSummary, PostsResponse } from "./types";

/**
 * Content source. Two modes:
 *
 *  - demo (default): `VITE_BLOG_API_URL` is unset, so the bundled Markdown
 *    fixtures under src/content/posts/ are used. Lets the site run with no
 *    backend.
 *  - live: `VITE_BLOG_API_URL` points at the admin backend (absolute URL, or
 *    "/api/v1" when a same-origin rewrite proxies it). The blog then calls
 *    GET {base}/posts and GET {base}/posts/{slug}.
 */
const configured = (import.meta.env.VITE_BLOG_API_URL as string | undefined)?.trim();
export const API_MODE: "demo" | "live" = configured ? "live" : "demo";
const BASE = (configured ?? "").replace(/\/+$/, "");

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw new Error(`Request failed (${res.status} ${res.statusText})`);
  }
  return (await res.json()) as T;
}

let postsCache: { issue: IssueMeta; posts: PostSummary[] } | null = null;
const postCache = new Map<string, Post>();

export async function fetchPosts(): Promise<{ issue: IssueMeta; posts: PostSummary[] }> {
  if (postsCache) return postsCache;

  if (API_MODE === "demo") {
    postsCache = { issue: ISSUE, posts: DEMO_SUMMARIES };
    return postsCache;
  }

  const data = await json<PostsResponse>(await fetch(`${BASE}/posts`));
  postsCache = {
    issue: { ...ISSUE, ...(data.issue ?? {}) },
    posts: data.posts ?? [],
  };
  return postsCache;
}

export async function fetchPost(slug: string): Promise<Post> {
  const cached = postCache.get(slug);
  if (cached) return cached;

  if (API_MODE === "demo") {
    const found = DEMO_POSTS.find((p) => p.slug === slug);
    if (!found) throw new Error("Post not found");
    postCache.set(slug, found);
    return found;
  }

  const post = await json<Post>(await fetch(`${BASE}/posts/${encodeURIComponent(slug)}`));
  postCache.set(slug, post);
  return post;
}
