import { useEffect, useRef, useState } from "react";
import { tokens, API_BASE, isDemoMode } from "./api";

export interface SseEvent {
  event: string;
  data: unknown;
  raw: string;
  ts: string;
}

export interface SseOptions {
  /** Reconnect base delay in ms (doubles up to maxDelayMs). */
  baseDelayMs?: number;
  /** Cap for backoff. */
  maxDelayMs?: number;
  /** Pass `false` to keep the stream closed (e.g. not authenticated). */
  enabled?: boolean;
  /** Called for every parsed SSE event. */
  onEvent?: (evt: SseEvent) => void;
}

const demoEvent = (event: string, payload: Record<string, unknown>): SseEvent => ({
  event,
  data: payload,
  raw: JSON.stringify(payload),
  ts: new Date().toISOString(),
});

/**
 * Asset Intelligence SSE live feed (ASSET_INTELLIGENCE_AND_MONITORING_FE.md §7).
 * Browser EventSource cannot set Authorization, so this uses fetch + ReadableStream
 * and reconnects with exponential backoff on disconnect.
 */
export function useSseStream(path: string, opts: SseOptions = {}) {
  const { baseDelayMs = 5000, maxDelayMs = 30000, enabled = true, onEvent } = opts;
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState<SseEvent[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return;
    if (isDemoMode()) {
      // Demo: emit a fake connected pulse so the "live" indicator behaves.
      setConnected(true);
      const timer = setInterval(() => {
        const demo: Record<string, unknown> = { assetId: 0, value: null, type: "heartbeat" };
        const evt = demoEvent("heartbeat", demo);
        setEvents((prev) => [...prev.slice(-19), evt]);
        onEventRef.current?.(evt);
      }, 25000);
      return () => {
        setConnected(false);
        clearInterval(timer);
      };
    }

    let cancelled = false;
    let delay = baseDelayMs;

    const connect = async () => {
      if (cancelled) return;
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const url = `${API_BASE}${path}${path.includes("?") ? "&" : "?"}replay=10`;
        const headers: Record<string, string> = {
          Accept: "text/event-stream",
        };
        const bearer = tokens.appSession || tokens.orgUser || tokens.platform;
        if (bearer) headers["Authorization"] = `Bearer ${bearer}`;
        if (tokens.device) headers["X-Device-Token"] = tokens.device;

        const res = await fetch(url, { headers, signal: controller.signal });
        if (!res.ok || !res.body) {
          setConnected(false);
          scheduleReconnect();
          return;
        }
        setConnected(true);
        delay = baseDelayMs;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let eventName = "message";

        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() || "";
          for (const chunk of chunks) {
            const lines = chunk.split("\n");
            let dataLine = "";
            for (const line of lines) {
              if (line.startsWith("event:")) eventName = line.slice(6).trim();
              if (line.startsWith("data:")) dataLine += line.slice(5).trim();
            }
            if (!dataLine) continue;
            const evt: SseEvent = { event: eventName, data: dataLine, raw: dataLine, ts: new Date().toISOString() };
            try {
              evt.data = JSON.parse(dataLine);
            } catch { /* keep raw string */ }
            setEvents((prev) => [...prev.slice(-19), evt]);
            onEventRef.current?.(evt);
            eventName = "message";
          }
        }
      } catch {
        if (!cancelled) {
          setConnected(false);
          scheduleReconnect();
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (cancelled) return;
      const t = window.setTimeout(() => {
        delay = Math.min(delay * 2, maxDelayMs);
        void connect();
      }, delay);
      reconnectTimer = t;
    };

    let reconnectTimer: number | null = null;
    void connect();

    return () => {
      cancelled = true;
      abortRef.current?.abort();
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, enabled]);

  return { connected, events, setEvents };
}
