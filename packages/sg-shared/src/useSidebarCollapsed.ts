import { useCallback, useEffect, useState } from "react";

const KEY = "sg_sidebar_collapsed";

/**
 * Persisted, cross-tab sidebar collapse state shared by every SecureGraph app
 * shell (Core / Attack / Defend / Code). One key so the operator's preference
 * follows them between applications on the same host family.
 */
export function useSidebarCollapsed(): {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (value: boolean) => void;
} {
  const [collapsed, setState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  });

  const setCollapsed = useCallback((value: boolean) => {
    setState(value);
    try {
      localStorage.setItem(KEY, value ? "1" : "0");
    } catch {
      /* private mode — collapse still works for the session */
    }
  }, []);

  const toggle = useCallback(() => setCollapsed(!collapsed), [collapsed, setCollapsed]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setState(e.newValue === "1");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return { collapsed, toggle, setCollapsed };
}
