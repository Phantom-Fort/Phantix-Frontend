import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { initAnalytics, track, trackPageView } from "./analytics";

/** Sends a page_view on every route, plus post_view on article routes. */
export function useAnalytics(): void {
  const { pathname } = useLocation();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    trackPageView();
    const m = pathname.match(/^\/posts\/([^/]+)/);
    if (m) track({ type: "post_view", slug: decodeURIComponent(m[1]) });
  }, [pathname]);
}

/** Fires post_read once when a reader scrolls through ~90% of an article. */
export function useReadTracking(slug: string | undefined): void {
  useEffect(() => {
    if (!slug) return;
    let sent = false;
    const onScroll = () => {
      if (sent) return;
      const doc = document.documentElement;
      const total = Math.max(1, doc.scrollHeight);
      if ((window.scrollY + window.innerHeight) / total >= 0.9) {
        sent = true;
        track({ type: "post_read", slug });
        window.removeEventListener("scroll", onScroll);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [slug]);
}
