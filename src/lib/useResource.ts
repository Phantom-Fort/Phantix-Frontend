import { useCallback, useEffect, useState } from "react";
import { isDemoMode } from "./api";

export type ResourceState<T> = {
  data: T;
  loading: boolean;
  error: string | null;
  reload: () => void;
  demo: boolean;
};

/** Load live API data, or demo-data when isDemoMode(). */
export function useResource<T>(loader: () => Promise<T>, initial: T): ResourceState<T> {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const demo = isDemoMode();

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loader()
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // loader is a stable module fn; tick forces reload; demo mode flips with flag
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, demo]);

  return { data, loading, error, reload, demo };
}
