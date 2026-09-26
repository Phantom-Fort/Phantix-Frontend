/**
 * User timezone — one source of truth for rendering time.
 *
 * Times must render in the *viewer's* zone, not the server's and not a
 * hardcoded UTC. Lagos (`Africa/Lagos`) is one instance of the problem, not the
 * requirement: a user in Berlin or São Paulo gets their own zone with no
 * configuration, because the browser already knows it.
 *
 * Resolution order:
 *   1. an explicit override the user chose in their profile (persisted locally,
 *      and sent to the API so mail matches the UI),
 *   2. the browser's zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`),
 *   3. UTC as the last resort, so a broken environment degrades predictably
 *      rather than rendering `NaN` or `Invalid Date`.
 *
 * Use these helpers rather than bare `toLocaleString()`, so every surface
 * agrees and a future profile setting takes effect everywhere at once.
 */

const STORAGE_KEY = "sg.timezone";

let override: string | null = null;
let resolved: string | null = null;

/** The viewer's zone: profile override, else the browser's, else UTC. */
export function userTimeZone(): string {
  if (override) return override;
  if (resolved) return resolved;
  try {
    resolved = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    resolved = "UTC";
  }
  return resolved;
}

/** Is the resolved zone actually the browser's, or just our fallback? */
export function timeZoneIsKnown(): boolean {
  return userTimeZone() !== "UTC" || detectedZone() === "UTC";
}

function detectedZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Persist the user's chosen zone (or clear it to fall back to the browser). */
export function setUserTimeZone(tz: string | null): void {
  override = tz && tz.trim() ? tz.trim() : null;
  try {
    if (override) localStorage.setItem(STORAGE_KEY, override);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode / storage disabled — the in-memory value still applies */
  }
}

/** Read a previously chosen zone at startup. Safe to call when building the app. */
export function loadUserTimeZone(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) override = stored;
  } catch {
    /* ignore */
  }
}

/**
 * Parse an API timestamp.
 *
 * The API records UTC and hands it back without a zone designator
 * ("2026-09-26T10:41:00"), which `new Date()` reads as *local* time. In a UTC+1
 * zone every row the server had just written therefore read "1h ago" — never
 * "just now" — in the notification bell and the audit trail alike, and drifted
 * from there. Bare wall-clock strings are pinned to UTC; a value that carries an
 * offset/zone, or a date-only value, is left to the runtime to interpret.
 */
export function parseTimestamp(value: string): Date {
  const trimmed = value.trim();
  const bare = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(trimmed);
  return new Date(bare ? `${trimmed.replace(" ", "T")}Z` : trimmed);
}

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d =
    value instanceof Date
      ? value
      : typeof value === "string"
        ? parseTimestamp(value)
        : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Full date + time in the viewer's zone. */
export function formatDateTime(
  value: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleString(undefined, { timeZone: userTimeZone(), ...options });
}

/** Date only. */
export function formatDate(
  value: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleDateString(undefined, {
    timeZone: userTimeZone(),
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  });
}

/** Time only, with the zone abbreviation where the runtime provides it. */
export function formatTime(
  value: string | number | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleTimeString(undefined, {
    timeZone: userTimeZone(),
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  });
}

/** e.g. "Africa/Lagos (GMT+1)" — for showing the user which zone they are on. */
export function timeZoneLabel(at: Date = new Date()): string {
  const tz = userTimeZone();
  try {
    const parts = new Intl.DateTimeFormat(undefined, {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(at);
    const offset = parts.find((p) => p.type === "timeZoneName")?.value;
    return offset ? `${tz} (${offset})` : tz;
  } catch {
    return tz;
  }
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "3 min ago", "2 h ago", "4 d ago" — relative, so it carries no zone at all. */
export function formatRelative(
  value: string | number | Date | null | undefined,
  now: number = Date.now(),
): string {
  const d = toDate(value);
  if (!d) return "—";
  const delta = now - d.getTime();
  if (delta < MINUTE) return "just now";
  if (delta < HOUR) return `${Math.round(delta / MINUTE)} min ago`;
  if (delta < DAY) return `${Math.round(delta / HOUR)} h ago`;
  return `${Math.round(delta / DAY)} d ago`;
}

/**
 * The IANA zone to send with writes (schedules, reports) so the server records
 * intent in the user's zone instead of assuming UTC.
 */
export function timeZoneForApi(): string {
  return userTimeZone();
}
