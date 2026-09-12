import React from "react";
import { Activity, Boxes, KeyRound, Lock, Network, ShieldCheck, ShieldAlert, Timer, XCircle } from "lucide-react";
import { Card, CardHeader, StatCard } from "@/components/ui";
import type { CloudPosture } from "@/lib/data";
import { cx, timeAgo } from "@/lib/utils";

// ── Cloud posture capabilities ───────────────────────────────────────────────
// The five things the posture page has to answer, in one panel: can the cloud and
// container packs actually run, what is reachable, what is our TLS posture, which
// host baselines exist, and is execution isolated and serialized per org.

const ISSUE_LABEL: Record<string, string> = {
  legacy_protocol: "Legacy protocol",
  weak_cipher: "Weak cipher",
  certificate_expired: "Expired certificate",
  certificate_expiring_soon: "Expiring soon",
  certificate_self_signed: "Self-signed",
  certificate_hostname_mismatch: "Hostname mismatch",
  certificate_weak_signature: "Weak signature",
};

function issueTone(issue: string): string {
  if (issue === "certificate_expired" || issue === "weak_cipher") return "border-severity-critical/30 bg-severity-critical/10 text-severity-critical";
  if (issue.startsWith("legacy_protocol") || issue.startsWith("certificate")) return "border-severity-medium/30 bg-severity-medium/10 text-severity-medium";
  return "border-phantix-700 text-slate-400";
}

function PackRow({
  label,
  enabled,
  reason,
  extra,
}: {
  label: string;
  enabled: boolean;
  reason?: string | null;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-md border border-phantix-700/50 bg-phantix-950/40 px-3 py-2">
      {enabled ? (
        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-400" />
      ) : (
        <XCircle size={14} className="mt-0.5 shrink-0 text-severity-medium" />
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-200">
          {label} — <span className={enabled ? "text-emerald-400" : "text-severity-medium"}>{enabled ? "enabled" : "held"}</span>
        </p>
        {!enabled && reason && <p className="mt-0.5 text-[11px] leading-5 text-slate-500">{reason}</p>}
        {extra}
      </div>
    </div>
  );
}

export default function CloudPosturePanel({
  posture,
  loading,
}: {
  posture: CloudPosture | null;
  loading?: boolean;
}) {
  if (loading && !posture) {
    return (
      <Card className="mb-5">
        <CardHeader title="Posture capabilities" subtitle="Packs, exposure, TLS, host baselines, execution" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-16 rounded-lg" />)}
        </div>
      </Card>
    );
  }
  if (!posture) return null;

  const { packs, network_exposure, tls_posture, cis_host_targets, execution } = posture;
  const summary = network_exposure.summary || {};
  const issues = Object.entries(tls_posture.by_issue || {}).sort((a, b) => b[1] - a[1]);

  return (
    <Card className="mb-5">
      <CardHeader
        title="Posture capabilities"
        subtitle="What can run, what is exposed, and how execution is contained"
      />

      {/* 1 · Pack eligibility */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <PackRow
          label="Cloud packs"
          enabled={packs.cloud.enabled}
          reason={packs.cloud.reason}
          extra={
            (packs.cloud.providers_configured?.length ?? 0) > 0 ? (
              <p className="mt-0.5 text-[11px] text-slate-500">
                Providers: {packs.cloud.providers_configured?.join(", ").toUpperCase()}
              </p>
            ) : undefined
          }
        />
        <PackRow label="Container packs" enabled={packs.container.enabled} reason={packs.container.reason} />
      </div>

      {/* 2 · Network exposure with first/last seen */}
      <div className="mt-5">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <Network size={12} /> Network exposure
        </p>
        {network_exposure.schema_upgrade_required ? (
          <p className="rounded-md border border-gold-400/25 bg-gold-400/[0.06] p-3 text-[11px] leading-5 text-gold-200">
            The exposure inventory is created when the security schema is bootstrapped. Re-run
            <span className="mx-1 font-mono">POST /db-connections/&#123;id&#125;/bootstrap</span> to enable it.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Reachable hosts" value={String(summary.hosts_reachable ?? 0)} icon={<Boxes size={16} />} />
              <StatCard label="Open ports/services" value={String(summary.open_now ?? 0)} icon={<Activity size={16} />} />
              <StatCard label="New (7d)" value={String(summary.new_7d ?? 0)} icon={<Timer size={16} />} />
              <StatCard label="Quiet 30d" value={String(summary.stale_30d ?? 0)} icon={<Timer size={16} />} />
            </div>
            {(network_exposure.items?.length ?? 0) > 0 && (
              <div className="mt-3 overflow-x-auto rounded-md border border-phantix-700/50">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-phantix-700/40">
                      <th className="th">Host</th>
                      <th className="th">Port</th>
                      <th className="th">Service</th>
                      <th className="th">First seen</th>
                      <th className="th">Last seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {network_exposure.items.slice(0, 6).map((row, i) => (
                      <tr key={`${row.host}-${row.port}-${i}`} className="border-b border-phantix-800/40 last:border-b-0">
                        <td className="td font-mono text-[11px] text-slate-300">{row.host}</td>
                        <td className="td font-mono text-[11px] text-slate-200">
                          {row.port}/{row.protocol ?? "tcp"}
                          {row.tls && <span className="chip ml-1 border-emerald-400/30 text-emerald-400">tls</span>}
                        </td>
                        <td className="td text-[11px] text-slate-400">{row.service ?? "—"}</td>
                        <td className="td text-[11px] text-slate-500" title={row.first_seen_at ?? ""}>{timeAgo(row.first_seen_at ?? null)}</td>
                        <td className="td text-[11px] text-slate-400" title={row.last_seen_at ?? ""}>{timeAgo(row.last_seen_at ?? null)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* 3 · TLS posture */}
      <div className="mt-5">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <Lock size={12} /> TLS posture ({tls_posture.affected_hosts} host{tls_posture.affected_hosts === 1 ? "" : "s"})
        </p>
        {issues.length === 0 ? (
          <p className="text-xs text-slate-500">
            No legacy protocol, weak cipher or certificate issue found on public endpoints yet.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {issues.map(([issue, count]) => (
              <span key={issue} className={cx("chip", issueTone(issue))}>
                {ISSUE_LABEL[issue] ?? issue} · {count}
              </span>
            ))}
          </div>
        )}
        {tls_posture.expiring_soon?.length > 0 && (
          <p className="mt-2 text-[11px] text-slate-500">
            Expiring soon:{" "}
            {tls_posture.expiring_soon.slice(0, 4).map((e) => `${e.host} (${e.days_remaining}d)`).join(" · ")}
          </p>
        )}
      </div>

      {/* 4 · CIS-style host baselines */}
      <div className="mt-5">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <ShieldAlert size={12} /> CIS-style host targets
        </p>
        {cis_host_targets.available?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {cis_host_targets.available.map((p) => (
              <span
                key={p.name}
                className={cx(
                  "chip",
                  p.severity === "high" || p.severity === "critical"
                    ? "border-severity-critical/30 text-severity-critical"
                    : "border-phantix-700 text-slate-400",
                )}
                title={`${p.display_name} → ${p.targets.join(", ")}`}
              >
                {p.display_name}
              </span>
            ))}
            {cis_host_targets.matched > 0 && (
              <span className="chip border-severity-medium/30 text-severity-medium">
                {cis_host_targets.matched} host finding{cis_host_targets.matched === 1 ? "" : "s"}
              </span>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No host-baseline packs are installed on this deployment.</p>
        )}
      </div>

      {/* 5 · Execution isolation + per-org lock */}
      <div className="mt-5">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <KeyRound size={12} /> Execution
        </p>
        <div className="flex flex-wrap gap-1.5">
          <span className={cx("chip", execution.docker_isolated ? "border-emerald-400/30 text-emerald-400" : "border-severity-medium/30 text-severity-medium")}>
            {execution.docker_isolated ? "Docker-isolated" : "No container runtime"}
          </span>
          <span className="chip border-phantix-700 text-slate-400">
            {execution.one_active_scan_per_org ? "1 active scan / org" : "Concurrency: organisation"}
          </span>
          {execution.global_scan_concurrency != null && (
            <span className="chip border-phantix-700 text-slate-400">
              Global tool slots: {execution.global_scan_concurrency}
            </span>
          )}
          <span className={cx("chip", execution.tool_lock_redis_enabled ? "border-phantix-700 text-slate-400" : "border-severity-medium/30 text-severity-medium")}>
            {execution.tool_lock_redis_enabled
              ? execution.tool_lock_fail_open
                ? "Lock: Redis (fail-open)"
                : "Lock: Redis (fail-closed)"
              : "Lock: in-process"}
          </span>
          {execution.active_scans?.length > 0 && (
            <span className="chip border-gold-400/30 text-gold-300">
              {execution.active_scans.length} running now
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
