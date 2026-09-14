import { useCallback, useEffect, useState, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import { isDemoMode } from "./api";

export type ResourceState<T> = {
  data: T;
  loading: boolean;
  error: string | null;
  reload: () => void;
  demo: boolean;
  /** Imperatively patch the cached value (used by SSE live updates). */
  setData: React.Dispatch<React.SetStateAction<T>>;
};

// Simple in-memory cache for stale-while-revalidate
const _swrCache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute

/** Load live API data, or demo-data when isDemoMode(). */
export function useResource<T>(loader: () => Promise<T>, initial: T, cacheKey?: string): ResourceState<T> {
  const [data, setData] = useState<T>(() => {
    if (cacheKey && _swrCache.has(cacheKey)) {
      return _swrCache.get(cacheKey)!.data as T;
    }
    return initial;
  });
  const [loading, setLoading] = useState(!(cacheKey && _swrCache.has(cacheKey)));
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const demo = isDemoMode();
  const mountedRef = useRef(true);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const hadCached = cacheKey && _swrCache.has(cacheKey);
    if (!hadCached) setLoading(true);
    setError(null);

    loader()
      .then((value) => {
        if (!mountedRef.current) return;
        setData(value);
        if (cacheKey) _swrCache.set(cacheKey, { data: value, ts: Date.now() });
      })
      .catch((err: unknown) => {
        if (!mountedRef.current) return;
        if (!hadCached) setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        if (!mountedRef.current) return;
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, demo]);

  return { data, loading, error, reload, demo, setData };
}

/** Clear stale entries from SWR cache */
if (typeof window !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of _swrCache) {
      if (now - v.ts > CACHE_TTL_MS) _swrCache.delete(k);
    }
  }, 30_000);
}
