import React, { useMemo } from "react";
import { useResource } from "../useResource";
import { loadApplications, type ApplicationsSnapshot } from "../applications";
import type { ApplicationKey, NavLeaf, NavSection } from "./types";

// ── Backend-driven navigation ────────────────────────────────────────────────
// The launcher snapshot already carries each application's pages: `group` is
// the section heading, `path` the SPA route, `label` the item, and `locked`
// whether the current plan has unlocked it. Building the sidebar from that is
// what stops the four `nav.tsx` files drifting from the backend.
//
// The static per-app `nav.tsx` is kept only as (a) the offline/demo fallback and
// (b) the icon registry, matched by path. If the snapshot has no surfaces we
// return the fallback unchanged.
export function useApplicationNav(
  application: ApplicationKey,
  fallback: NavSection[],
): NavSection[] {
  const { data } = useResource<ApplicationsSnapshot | null>(
    loadApplications,
    null,
    "applications",
  );

  return useMemo(() => {
    const card = (data?.applications ?? []).find((a) => a.key === application);
    const surfaces = card?.surfaces ?? [];
    if (surfaces.length === 0) return fallback;

    const iconByPath = new Map<string, React.ReactNode>();
    for (const section of fallback) {
      for (const item of section.items) iconByPath.set(item.to, item.icon);
    }

    const groups: NavSection[] = [];
    const groupIndex = new Map<string, number>();
    for (const surface of surfaces) {
      const group = surface.group || "More";
      let idx = groupIndex.get(group);
      if (idx === undefined) {
        idx = groups.length;
        groupIndex.set(group, idx);
        groups.push({ label: group, items: [] });
      }
      const leaf: NavLeaf = {
        to: surface.path,
        label: surface.label,
        icon: iconByPath.get(surface.path),
        locked: Boolean(surface.locked),
        lockReason: surface.lock_reason ?? null,
      };
      groups[idx].items.push(leaf);
    }
    return groups;
  }, [data, application, fallback]);
}

export default useApplicationNav;
