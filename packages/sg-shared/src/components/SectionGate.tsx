import React from "react";
import { useResource } from "../useResource";
import { loadApplications, type ApplicationsSnapshot } from "../applications";
import { planLabel, sectionUpsell } from "../entitlements";
import { PageSkeleton } from "../ui";
import { UpgradeGate } from "./UpgradeGate";

// ── Section gate ─────────────────────────────────────────────────────────────
// Apps are free; a plan unlocks **sections** (selected pages). The launcher
// snapshot carries per-surface `gate` / `locked`, so a paid page renders an
// upgrade surface on Free instead of a broken or half-working screen.
//
// Fail-open by design: if gating is not enforced (dev), the snapshot is
// unavailable, or we simply don't know the section, the children render. A
// transient API failure must never lock an operator out of their own data.
export function SectionGate({
  section,
  title,
  body,
  children,
}: {
  /** Stable section id from `APPLICATION_SURFACES` (e.g. `defend.soc`). */
  section: string;
  title?: string;
  body?: string;
  children: React.ReactNode;
}) {
  const { data, loading } = useResource<ApplicationsSnapshot | null>(
    loadApplications,
    null,
    "applications",
  );

  // Wait for the snapshot before deciding, so a Free operator does not briefly
  // see a paid page. If it never loads, we fall through to children (fail-open).
  if (loading && !data) return <PageSkeleton variant="list" rows={4} />;

  const surfaces = (data?.applications ?? []).flatMap((a) => a.surfaces ?? []);
  const surface = surfaces.find((s) => s.section_key === section);
  const enforced = Boolean(data?.section_gate?.enforced);

  if (!enforced || !surface?.locked) return <>{children}</>;

  const up = sectionUpsell(section);
  const target = data?.section_gate?.upgrade_to ?? up?.plan ?? "starter";
  return (
    <UpgradeGate
      title={title ?? `${up?.label ?? surface.label} is included with ${planLabel(target)}`}
      body={body ?? surface.lock_reason ?? undefined}
      plan={target}
    />
  );
}

export default SectionGate;
