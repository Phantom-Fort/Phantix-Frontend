import { useEffect, useState } from "react";
import { fetchPost, fetchPosts } from "./content";
import type { IssueMeta, Post, PostSummary } from "./types";

export function useIssue(): {
  issue: IssueMeta | null;
  posts: PostSummary[];
  loading: boolean;
  error: string | null;
} {
  const [issue, setIssue] = useState<IssueMeta | null>(null);
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchPosts()
      .then((r) => {
        if (!active) return;
        setIssue(r.issue);
        setPosts(r.posts);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { issue, posts, loading, error };
}

export function usePost(slug: string | undefined): {
  post: Post | null;
  loading: boolean;
  error: string | null;
} {
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(Boolean(slug));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setPost(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    fetchPost(slug)
      .then((p) => {
        if (!active) return;
        setPost(p);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  return { post, loading, error };
}
