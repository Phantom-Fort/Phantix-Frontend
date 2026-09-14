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
  const busyRef = useRef(false);

  // Hold the latest callback/guard in refs. Callers typically pass inline arrow
  // functions, which get a new identity on every render — depending on them
  // directly would restart this effect and fire an immediate poll on every
  // re-render (a runaway request loop when the poll itself triggers a
  // re-render, e.g. reload() → setData → render → poll → reload()).
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const guardRef = useRef(guard);
  guardRef.current = guard;

  const poll = useCallback(async () => {
    if (busyRef.current) return;
    if (paused) return;
    if (guardRef.current && !guardRef.current()) return;
    busyRef.current = true;
    try {
      await callbackRef.current();
    } finally {
      busyRef.current = false;
    }
  }, [paused]);

  useEffect(() => {
    if (paused) return;
    // Immediate poll on mount / interval change only — never on re-render.
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
