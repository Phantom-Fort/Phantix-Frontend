import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Severity, VerificationStatus } from "./types";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export const severityMeta: Record<Severity, { label: string; color: string; bg: string; border: string }> = {
  critical: { label: "Critical", color: "text-severity-critical", bg: "bg-severity-critical/12", border: "border-severity-critical/30" },
  high: { label: "High", color: "text-severity-high", bg: "bg-severity-high/12", border: "border-severity-high/30" },
  medium: { label: "Medium", color: "text-severity-medium", bg: "bg-severity-medium/12", border: "border-severity-medium/30" },
  low: { label: "Low", color: "text-severity-low", bg: "bg-severity-low/12", border: "border-severity-low/30" },
  info: { label: "Info", color: "text-severity-info", bg: "bg-severity-info/12", border: "border-severity-info/30" },
};

export const severityHex: Record<Severity, string> = {
  critical: "#F43F5E",
  high: "#FB923C",
  medium: "#FACC15",
  low: "#38BDF8",
  info: "#94A3B8",
};

export const verificationMeta: Record<VerificationStatus, { label: string; className: string }> = {
  auto_verified: { label: "Verified (auto)", className: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" },
  manually_verified: { label: "Verified (human)", className: "text-emerald-300 bg-emerald-300/10 border-emerald-300/30" },
  unverified: { label: "Needs verification", className: "text-severity-medium bg-severity-medium/10 border-severity-medium/30" },
  rejected: { label: "Excluded", className: "text-slate-400 bg-slate-400/10 border-slate-400/30" },
  false_positive: { label: "False positive", className: "text-severity-critical bg-severity-critical/10 border-severity-critical/30" },
};

export const riskLevelHex: Record<string, string> = {
  critical: "#F43F5E",
  high: "#FB923C",
  medium: "#FACC15",
  low: "#38BDF8",
};

export const priorityBandMeta: Record<string, { label: string; className: string }> = {
  P1: { label: "P1 · Immediate", className: "text-severity-critical bg-severity-critical/12 border-severity-critical/40" },
  P2: { label: "P2 · This week", className: "text-severity-high bg-severity-high/12 border-severity-high/40" },
  P3: { label: "P3 · This month", className: "text-severity-medium bg-severity-medium/12 border-severity-medium/40" },
  P4: { label: "P4 · Planned", className: "text-severity-low bg-severity-low/12 border-severity-low/40" },
  P5: { label: "P5 · Backlog", className: "text-slate-400 bg-slate-400/10 border-slate-500/30" },
};

export function timeAgo(iso: string | null): string {
  if (!iso) return "---";
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "---";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "---";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat().format(n);
}

export const statusColor: Record<string, string> = {
  completed: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  complete: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  delivered: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  ready: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  active: "text-severity-low bg-severity-low/10 border-severity-low/30",
  running: "text-severity-low bg-severity-low/10 border-severity-low/30",
  generating: "text-severity-low bg-severity-low/10 border-severity-low/30",
  approved: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  verified: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  pass: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  resolved: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  pending: "text-severity-medium bg-severity-medium/10 border-severity-medium/30",
  pending_approval: "text-severity-medium bg-severity-medium/10 border-severity-medium/30",
  queued: "text-severity-medium bg-severity-medium/10 border-severity-medium/30",
  draft: "text-slate-400 bg-slate-400/10 border-slate-500/30",
  paused: "text-severity-medium bg-severity-medium/10 border-severity-medium/30",
  open: "text-severity-high bg-severity-high/10 border-severity-high/30",
  in_progress: "text-severity-low bg-severity-low/10 border-severity-low/30",
  failed: "text-severity-critical bg-severity-critical/10 border-severity-critical/30",
  cancelled: "text-slate-400 bg-slate-400/10 border-slate-500/30",
  rejected: "text-severity-critical bg-severity-critical/10 border-severity-critical/30",
  gap: "text-severity-critical bg-severity-critical/10 border-severity-critical/30",
  unknown: "text-slate-400 bg-slate-400/10 border-slate-500/30",
  accepted: "text-severity-low bg-severity-low/10 border-severity-low/30",
  fixed: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  retest_failed: "text-severity-high bg-severity-high/10 border-severity-high/30",
  regressed: "text-severity-critical bg-severity-critical/10 border-severity-critical/30",
  false_positive: "text-slate-400 bg-slate-400/10 border-slate-500/30",
  not_bootstrapped: "text-severity-medium bg-severity-medium/10 border-severity-medium/30",
  collected: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  manual: "text-severity-low bg-severity-low/10 border-severity-low/30",
  closed: "text-slate-400 bg-slate-400/10 border-slate-500/30",
};

export function titleCase(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const assetTypeIcon: Record<string, string> = {
  domain: "🌐",
  subdomain: "🔗",
  ip_address: "🖧",
  github_repo: "📦",
  api: "⚡",
  port_service: "🔌",
  mobile_apk: "📱",
  database_connection: "🗄️",
  web_app: "🕸️",
  cloud_resource: "☁️",
  other: "📌",
};

// ── Finding verification & impact helpers ─────────────────────────────────────
export function isReportable(f: any): boolean {
  if (f.reportable === true) return true;
  const s = String(f.verification_status ?? f.evidence?.verification?.verification_status ?? f.status ?? "").toLowerCase();
  return s === "auto_verified" || s === "manually_verified" || s === "verified";
}

const VERIFIED_STATUSES = new Set(["auto_verified", "manually_verified", "verified"]);
const EXCLUDED_STATUSES = new Set(["rejected", "false_positive", "excluded", "noise"]);

/** Pull findings arrays from report list/detail payloads (AGI sections, structured content, etc.). */
export function extractReportFindings(report: any): any[] {
  if (!report || typeof report !== "object") return [];
  const sections = report.sections;
  if (Array.isArray(report.findings)) return report.findings;
  if (!sections || typeof sections !== "object") return [];
  if (Array.isArray(sections.findings)) return sections.findings;
  const out: any[] = [];
  for (const val of Object.values(sections as Record<string, unknown>)) {
    if (!val || typeof val !== "object") continue;
    const s = val as Record<string, unknown>;
    if (Array.isArray(s.findings)) out.push(...s.findings);
    if (Array.isArray(s.content)) {
      const looksLikeFinding = s.content.some(
        (c: any) => c && typeof c === "object" && (c.severity != null || c.finding_key != null || c.title != null),
      );
      if (looksLikeFinding) out.push(...(s.content as any[]));
    }
  }
  return out;
}

/** Dedupe key for AGI/tool findings (stable across sessions when ids differ). */
export function findingDedupeKey(f: any): string {
  if (f?.finding_key) return String(f.finding_key);
  if (f?.id != null && String(f.id).length < 48) return String(f.id);
  const title = String(f?.title ?? "").trim().toLowerCase();
  const target = String(f?.target ?? f?.asset_value ?? "").trim().toLowerCase();
  const sev = String(f?.severity ?? "").toLowerCase();
  return `${title}|${target}|${sev}`;
}

/** Derive report pipeline chips when API omits `stats` (common for agi_session list payloads). */
export function deriveReportStats(report: any): {
  after_dedupe: number;
  after_verification: number;
  excluded_from_report: number;
  impact_analyzed?: number;
  attack_paths?: number;
  require_verified?: boolean;
  candidates?: number;
} {
  const existing = report?.stats && typeof report.stats === "object" ? report.stats : null;
  const findings = extractReportFindings(report);
  const rawCount =
    Number(report?.sections?.findings_count) ||
    Number(report?.output_files?.json?.findings_count) ||
    findings.length;

  const seen = new Set<string>();
  let verified = 0;
  let excluded = 0;
  let impact = 0;
  let candidates = 0;
  let attackPaths = 0;

  for (const f of findings) {
    const key = findingDedupeKey(f);
    if (seen.has(key)) continue;
    seen.add(key);
    const st = String(f?.status ?? f?.verification_status ?? "").toLowerCase();
    if (VERIFIED_STATUSES.has(st) || isReportable(f)) verified += 1;
    else if (EXCLUDED_STATUSES.has(st)) excluded += 1;
    else candidates += 1;
    if (f?.impact != null || f?.impact_level != null || f?.impact_analysis != null || f?.business_impact != null) {
      impact += 1;
    }
    if (f?.attack_path || f?.attack_paths || f?.category === "attack_path") attackPaths += 1;
  }

  const afterDedupe = seen.size || rawCount;
  const apiDedupe = existing?.after_dedupe;
  const apiVerified = existing?.after_verification;
  const apiExcluded = existing?.excluded_from_report;
  const apiImpact = existing?.impact_analyzed;

  // Prefer API stats when present and non-zero; otherwise fill from sections.findings.
  const useDerived = findings.length > 0 || rawCount > 0;
  return {
    after_dedupe: typeof apiDedupe === "number" && (apiDedupe > 0 || !useDerived) ? apiDedupe : afterDedupe,
    after_verification:
      typeof apiVerified === "number" && (apiVerified > 0 || !useDerived) ? apiVerified : verified,
    excluded_from_report:
      typeof apiExcluded === "number" && (apiExcluded > 0 || !useDerived) ? apiExcluded : excluded,
    impact_analyzed:
      typeof apiImpact === "number"
        ? apiImpact
        : impact > 0
          ? impact
          : afterDedupe > 0
            ? 0
            : undefined,
    attack_paths: existing?.attack_paths ?? (attackPaths || undefined),
    require_verified: existing?.require_verified,
    candidates,
  };
}

export function normalizeReportRow(raw: any): any {
  if (!raw || typeof raw !== "object") return raw;
  const stats = deriveReportStats(raw);
  return {
    ...raw,
    version: raw.version ?? raw.report_version ?? 1,
    report_version: raw.report_version ?? raw.version ?? 1,
    created_at: raw.created_at ?? raw.generated_at ?? raw.updated_at ?? new Date().toISOString(),
    size_bytes: raw.size_bytes ?? 0,
    formats_requested: raw.formats_requested ?? ["markdown", "json"],
    stats,
  };
}

/** Canonical tracker statuses (findings-tracker.md). */
export const TRACKER_STATUSES = [
  "open",
  "in_progress",
  "fixed",
  "accepted",
  "retest_failed",
  "regressed",
] as const;

/** Map engine tracker / AGI finding rows into FE TrackerFinding shape. */
export function normalizeTrackerFinding(raw: any, fallbackCampaign = ""): {
  finding_key: string;
  title: string;
  severity: any;
  status: string;
  owner: string | null;
  campaign_name: string;
  asset_value: string;
  updated_at: string;
  surface?: string;
  priority?: string;
  asset_id?: number | null;
  assigned_owner?: string | null;
  target_fix_date?: string | null;
  detection_count?: number;
  retest_status?: string | null;
  description?: string | null;
} {
  const statusRaw = String(raw?.status ?? "open").toLowerCase().replace(/-/g, "_");
  // Map legacy / verification labels onto the living-board set only.
  const statusMap: Record<string, string> = {
    candidate: "open",
    unverified: "open",
    resolved: "fixed",
    verified: "fixed",
    false_positive: "accepted",
    auto_verified: "open",
    manually_verified: "open",
  };
  const status = statusMap[statusRaw] ?? statusRaw;
  const key =
    raw?.finding_key ??
    raw?.key ??
    (raw?.id != null ? String(raw.id) : findingDedupeKey(raw).slice(0, 36));
  const owner =
    raw?.assigned_owner ?? raw?.owner ?? raw?.assigned_owner_email ?? null;
  const assetObj = raw?.asset && typeof raw.asset === "object" ? raw.asset : null;
  return {
    finding_key: String(key),
    title: String(raw?.title ?? raw?.name ?? "Untitled finding"),
    severity: (raw?.severity ?? "info") as any,
    status,
    owner: owner != null ? String(owner) : null,
    assigned_owner: owner != null ? String(owner) : null,
    campaign_name: String(raw?.campaign_name ?? raw?.campaign ?? fallbackCampaign ?? "—"),
    asset_value: String(
      raw?.asset_value ??
        assetObj?.value ??
        assetObj?.name ??
        raw?.target ??
        raw?.asset ??
        "—",
    ),
    updated_at: String(raw?.updated_at ?? raw?.last_detected_at ?? raw?.created_at ?? new Date().toISOString()),
    surface: raw?.surface != null ? String(raw.surface) : undefined,
    priority: raw?.priority != null ? String(raw.priority) : undefined,
    asset_id: raw?.asset_id != null ? Number(raw.asset_id) : assetObj?.id != null ? Number(assetObj.id) : null,
    target_fix_date: raw?.target_fix_date ?? null,
    detection_count: raw?.detection_count != null ? Number(raw.detection_count) : undefined,
    retest_status: raw?.retest_status ?? null,
    description: raw?.description ?? null,
  };
}

export function impactLevelRank(level?: string): number {
  const m: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  return m[(level || "").toLowerCase()] ?? 0;
}

export function impactLevelColor(level?: string): string {
  const m: Record<string, string> = {
    Critical: "bg-red-500/15 text-red-400 border-red-500/30",
    High: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    Medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    Low: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  };
  return m[level ?? ""] ?? "bg-slate-500/15 text-slate-400 border-slate-500/30";
}

export const categoryLabels: Record<string, string> = {
  remote_code_execution: "Remote code execution",
  injection: "Injection",
  authentication_bypass: "Auth bypass",
  privilege_escalation: "Privilege escalation",
  data_exposure: "Data exposure",
  information_disclosure: "Info disclosure",
  lateral_movement: "Lateral movement",
  service_disruption: "Service disruption",
  cryptographic_weakness: "Cryptographic weakness",
  misconfiguration: "Misconfiguration",
  attack_surface_exposure: "Attack surface",
  supply_chain: "Supply chain",
  compliance_control_gap: "Compliance concern",
};

export const blastRadiusLabels: Record<string, string> = {
  local: "Local component",
  host: "Host / endpoint",
  service: "Application / service",
  organization: "Organization",
  internet_facing: "Internet-facing",
};
