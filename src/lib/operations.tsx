import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type OperationStatus = "running" | "success" | "error";

export interface Operation {
  id: string;
  label: string;
  route: string;
  status: OperationStatus;
  detail?: string;
  startedAt: number;
  finishedAt?: number;
}

export interface OperationInput {
  label: string;
  route: string;
  detail?: string;
}

export interface OperationsApi {
  operations: Operation[];
  /** Register an in-progress operation. Returns its id so the caller can update it. */
  register: (input: OperationInput) => string;
  /** Patch an operation. Moving running → success/error schedules auto-dismiss in 30s. */
  update: (id: string, patch: Partial<Operation>) => void;
  /** Remove an operation immediately. */
  remove: (id: string) => void;
}

/** Terminal states auto-close after this long. */
export const TERMINAL_DISMISS_MS = 30_000;

const OperationsContext = createContext<OperationsApi | null>(null);

let counter = 0;
function nextId() {
  return `op_${Date.now()}_${counter++}`;
}

export function OperationsProvider({ children }: { children: React.ReactNode }) {
  const [operations, setOperations] = useState<Operation[]>([]);
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const clearTimer = useCallback((id: string) => {
    const t = timersRef.current[id];
    if (t) {
      clearTimeout(t);
      delete timersRef.current[id];
    }
  }, []);

  const remove = useCallback(
    (id: string) => {
      setOperations((prev) => prev.filter((o) => o.id !== id));
      clearTimer(id);
    },
    [clearTimer],
  );

  const update = useCallback(
    (id: string, patch: Partial<Operation>) => {
      setOperations((prev) =>
        prev.map((o) => {
          if (o.id !== id) return o;
          const next = { ...o, ...patch };
          if (
            o.status === "running" &&
            (next.status === "success" || next.status === "error") &&
            next.finishedAt == null
          ) {
            next.finishedAt = Date.now();
            clearTimer(id);
            timersRef.current[id] = setTimeout(() => {
              setOperations((p) => p.filter((x) => x.id !== id));
            }, TERMINAL_DISMISS_MS);
          }
          return next;
        }),
      );
    },
    [clearTimer],
  );

  const register = useCallback((input: OperationInput) => {
    const id = nextId();
    setOperations((prev) => [
      ...prev,
      { id, label: input.label, route: input.route, detail: input.detail, status: "running", startedAt: Date.now() },
    ]);
    return id;
  }, []);

  useEffect(() => () => {
    Object.values(timersRef.current).forEach(clearTimeout);
  }, []);

  // Safety net: a running op that is never updated (page unmounted, no poll)
  // cannot linger forever — drop it after 24h.
  useEffect(() => {
    const t = setInterval(() => {
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      setOperations((prev) => prev.filter((o) => o.status !== "running" || o.startedAt > cutoff));
    }, 60_000);
    return () => clearInterval(t);
  }, []);

  const api = useMemo<OperationsApi>(
    () => ({ operations, register, update, remove }),
    [operations, register, update, remove],
  );

  return <OperationsContext.Provider value={api}>{children}</OperationsContext.Provider>;
}

export function useOperations(): OperationsApi {
  const ctx = useContext(OperationsContext);
  if (!ctx) throw new Error("useOperations must be used within <OperationsProvider>");
  return ctx;
}
