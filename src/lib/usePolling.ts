import { useEffect, useRef, useCallback } from "react";

interface PollOptions {
  /** Polling interval in ms (adjusts based on visibility and staleness) */
  intervalMs?: number;
  /** Slow down to this interval when tab is hidden */
  hiddenIntervalMs?: number;
  /** If true, skip polling entirely */
  paused?: boolean;
  /** Called before each poll — if returns false, poll is skipped */
  guard?: () => boolean;
}

/**
 * Smart polling hook — adjusts frequency when tab is hidden,
 * pauses when data hasn't changed, and respects a guard function.
 */
export function useSmartPoll(
  callback: () => Promise<void> | void,
  opts: PollOptions = {},
) {
  const { intervalMs = 10000, hiddenIntervalMs = 60000, paused = false, guard } = opts;
  const lastDataRef = useRef<string>("");
  const busyRef = useRef(false);

  const poll = useCallback(async () => {
    if (busyRef.current) return;
    if (paused) return;
    if (guard && !guard()) return;
    busyRef.current = true;
    try {
      await callback();
    } finally {
      busyRef.current = false;
    }
  }, [callback, paused, guard]);

  useEffect(() => {
    if (paused) return;
    poll();

    let interval: ReturnType<typeof setInterval>;
    const onVisible = () => {
      const active = document.visibilityState === "visible";
      clearInterval(interval);
      if (active) {
        poll();
        interval = setInterval(poll, intervalMs);
      } else {
        interval = setInterval(poll, hiddenIntervalMs);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    interval = setInterval(poll, intervalMs);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll, intervalMs, hiddenIntervalMs, paused]);

  return { force: poll };
}
