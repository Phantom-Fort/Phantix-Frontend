// ── Shared severity/brand tokens (staging-rollout §4) ────────────────────────
// Source of truth is the backend: GET /api/v1/branding/tokens (public, ETag
// cached, ~1 KB). Read once at boot and mirrored onto the CSS custom
// properties so the console shows the same severity colours as PDF/DOCX/PPTX
// reports and email. The static fallbacks in index.css match the canonical
// table, so a failed/offline fetch still renders correct colours.
//
// Normalisation: the API emits aliases such as `informational` for `info`;
// anything unrecognised maps to `unrated` (never a default grey).

const TOKENS_URL = "/api/v1/branding/tokens";
const CACHE_TTL_MS = 60 * 60 * 1000; // one hour

export type SeverityKey = "critical" | "high" | "medium" | "low" | "info" | "unrated";

const SEVERITY_KEYS: readonly SeverityKey[] = [
  "critical",
  "high",
  "medium",
  "low",
  "info",
  "unrated",
];

/** Canonical fallback table (also mirrored in index.css). */
export const FALLBACK_SEVERITY: Record<SeverityKey, string> = {
  critical: "#DC2626",
  high: "#EA580C",
  medium: "#CA8A04",
  low: "#16A34A",
  info: "#0EA5E9",
  unrated: "#667085",
};

const SEVERITY_ALIASES: Record<string, SeverityKey> = {
  critical: "critical",
  high: "high",
  medium: "medium",
  moderate: "medium",
  low: "low",
  info: "info",
  informational: "info",
  information: "info",
  unrated: "unrated",
  unknown: "unrated",
  none: "unrated",
};

/** Map any server severity label to the canonical set (informational → info). */
export function normalizeSeverity(value?: string | null): SeverityKey {
  if (!value) return "unrated";
  return SEVERITY_ALIASES[value.trim().toLowerCase()] ?? "unrated";
}

type SeverityEntry = string | { fg?: string; color?: string; fill?: string; badge?: string; deep?: string; label?: string };

function hexToRgbTriple(hex: string): string {
  const h = String(hex).replace("#", "").trim();
  if (h.length === 3) {
    return `${parseInt(h[0] + h[0], 16)} ${parseInt(h[1] + h[1], 16)} ${parseInt(h[2] + h[2], 16)}`;
  }
  if (h.length === 6) {
    return `${parseInt(h.slice(0, 2), 16)} ${parseInt(h.slice(2, 4), 16)} ${parseInt(h.slice(4, 6), 16)}`;
  }
  return "";
}

/** Live severity colours resolved so far (fallbacks until the fetch answers). */
let current: Record<SeverityKey, string> = { ...FALLBACK_SEVERITY };

let applied = false;
let cacheExpiry = 0;
let etag = "";

function applyToCss(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const key of SEVERITY_KEYS) {
    const triple = hexToRgbTriple(current[key]);
    if (triple) root.style.setProperty(`--severity-${key}`, triple);
  }
}

/** Current hex colour for a severity (safe anywhere inline styles are needed). */
export function severityHex(key: SeverityKey | string | null | undefined): string {
  return current[normalizeSeverity(key)] ?? FALLBACK_SEVERITY.unrated;
}

function pickColor(entry: SeverityEntry | undefined, fallback: string): string {
  if (typeof entry === "string") {
    return /^#?[0-9a-fA-F]{3,8}$/.test(entry.trim()) ? entry : fallback;
  }
  if (entry && typeof entry === "object") {
    const c = entry.fg ?? entry.color ?? entry.fill ?? entry.badge ?? entry.deep;
    if (typeof c === "string") return c;
  }
  return fallback;
}

async function load(): Promise<void> {
  if (applied && Date.now() < cacheExpiry) return;
  let res: Response;
  try {
    const headers: Record<string, string> = {};
    if (etag) headers["If-None-Match"] = etag;
    res = await fetch(TOKENS_URL, { headers, cache: "no-store" });
  } catch {
    return; // offline/blocked → CSS fallbacks (already canonical)
  }
  if (res.status === 304) {
    applied = true;
    cacheExpiry = Date.now() + CACHE_TTL_MS;
    return;
  }
  if (!res.ok) return;
  try {
    const data = (await res.json()) as {
      severity?: Record<string, SeverityEntry>;
      severity_order?: string[];
      aliases?: Record<string, string>;
    };
    const serverSeverity = data?.severity ?? {};
    const next: Record<SeverityKey, string> = { ...current };
    for (const [rawKey, entry] of Object.entries(serverSeverity)) {
      const key = normalizeSeverity(rawKey);
      next[key] = pickColor(entry, current[key]);
    }
    current = next;
    applied = true;
    cacheExpiry = Date.now() + CACHE_TTL_MS;
    etag = res.headers.get("ETag") ?? "";
    applyToCss();
    window.dispatchEvent(new CustomEvent("phantix:brand-tokens", { detail: { severity: current } }));
  } catch {
    /* unparseable body → keep fallbacks */
  }
}

/** Fetch + apply branding tokens. Safe to call more than once (ETag, TTL). */
export function loadBrandTokens(): void {
  void load();
}
