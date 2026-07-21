import type { Severity, VerificationStatus } from "./types";

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
  if (!iso) return "—";
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
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "—";
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
  false_positive: "text-slate-400 bg-slate-400/10 border-slate-500/30",
  not_bootstrapped: "text-severity-medium bg-severity-medium/10 border-severity-medium/30",
  collected: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  manual: "text-severity-low bg-severity-low/10 border-severity-low/30",
  closed: "text-slate-400 bg-slate-400/10 border-slate-500/30",
};

export function titleCase(s: string): string {
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
