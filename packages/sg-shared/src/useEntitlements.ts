// Shared entitlement snapshot for UI gating.
//
// One module-level cache: many pages ask "may this org use X", and repeating the
// call per component would triple the same request on a page with several upsell
// strips. The snapshot is cheap and changes rarely, so it is fetched once and
// shared; `reload()` after a checkout return.
import { useCallback, useEffect, useState } from "react";
import { loadEntitlements, type Entitlements } from "./entitlements";

let _cache: Entitlements | null = null;
let _inflight: Promise<Entitlements | null> | null = null;

export function useEntitlements(): {
  ent: Entitlements | null;
  loading: boolean;
  reload: () => void;
} {
  const [ent, setEnt] = useState<Entitlements | null>(_cache);
  const [loading, setLoading] = useState(!_cache);

  const fetchOnce = useCallback(async () => {
    if (!_inflight) {
      _inflight = loadEntitlements()
        .then((e) => {
          _cache = e;
          return e;
        })
        .catch(() => null)
        .finally(() => {
          _inflight = null;
        });
    }
    return _inflight;
  }, []);

  const reload = useCallback(() => {
    _cache = null;
    setLoading(true);
    void fetchOnce().then((e) => {
      setEnt(e);
      setLoading(false);
    });
  }, [fetchOnce]);

  useEffect(() => {
    let alive = true;
    if (_cache) {
      setEnt(_cache);
      setLoading(false);
      return;
    }
    void fetchOnce().then((e) => {
      if (!alive) return;
      setEnt(e);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [fetchOnce]);

  return { ent, loading, reload };
}
