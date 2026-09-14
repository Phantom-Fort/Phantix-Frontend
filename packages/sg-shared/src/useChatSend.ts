import { useRef, useState } from "react";

export type SendHint = "idle" | "queued";

export function useChatSend() {
  const lock = useRef(false);
  const queued = useRef<string | null>(null);
  const lastSent = useRef("");
  const [hint, setHint] = useState<SendHint>("idle");

  const requestSend = (raw: string, exec: (msg: string) => Promise<void>) => {
    const msg = raw.trim();
    if (!msg) return;
    if (lock.current && msg === lastSent.current) return;
    if (lock.current) {
      if (queued.current) {
        queued.current = null;
        setHint("idle");
        lastSent.current = msg;
        void exec(msg);
        return;
      }
      queued.current = msg;
      setHint("queued");
      return;
    }
    void pump(msg, exec);
  };

  const pump = async (msg: string, exec: (m: string) => Promise<void>) => {
    lock.current = true;
    lastSent.current = msg;
    setHint("idle");
    try {
      await exec(msg);
    } finally {
      lock.current = false;
      const next = queued.current;
      queued.current = null;
      if (next) void pump(next, exec);
    }
  };

  return { hint, requestSend, busy: () => lock.current };
}
