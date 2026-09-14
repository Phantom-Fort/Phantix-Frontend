// Request deduplication — prevents duplicate in-flight GET requests within a time window.
// Mutations (POST/PUT/PATCH/DELETE) are never deduped.
const _inFlight = new Map<string, { promise: Promise<any>; ts: number }>();
const DEDUPE_WINDOW_MS = 2000;

export function dedupedRequest<T>(
  method: string,
  path: string,
  body: unknown,
  fetcher: () => Promise<T>,
): Promise<T> {
  if (method !== "GET") return fetcher();
  const key = body ? `${method}:${path}:${JSON.stringify(body)}` : `${method}:${path}`;
  const now = Date.now();
  const cached = _inFlight.get(key);
  if (cached && now - cached.ts < DEDUPE_WINDOW_MS) return cached.promise;
  const promise = fetcher().then(
    (r) => { _inFlight.delete(key); return r; },
    (e) => { _inFlight.delete(key); throw e; },
  );
  _inFlight.set(key, { promise, ts: now });
  return promise;
}

// Clean up stale entries periodically
if (typeof window !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of _inFlight) { if (now - v.ts > DEDUPE_WINDOW_MS * 2) _inFlight.delete(k); }
  }, 5000);
}
