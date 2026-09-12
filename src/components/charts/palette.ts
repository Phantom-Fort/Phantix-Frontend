/*
 * Chart colour — assigned by the job the colour does, not by taste.
 *
 * Two palettes, never mixed:
 *
 * 1. CATEGORICAL (identity): which attack surface a slice belongs to. Surfaces
 *    have no order, so the hue carries identity only. These five hues are the
 *    validated categorical theme and they pass every check on both of this
 *    app's surfaces — dark #0A0A0A and light #FFFFFF:
 *      dark  worst adjacent CVD ΔE 8.4 (protan), normal-vision ΔE 19.3, all ≥3:1
 *      light worst adjacent CVD ΔE 9.1 (protan), normal-vision ΔE 19.6
 *    Light carries a contrast WARN on aqua/yellow/magenta (2.2–2.8:1), which is
 *    why every chart using them ships visible labels and a table view — that
 *    relief is required, not optional.
 *
 * 2. STATUS (state): severity and lifecycle state. These are the product's own
 *    `--severity-*` tokens. They deliberately FAIL a categorical validation
 *    (critical↔high sit at normal-vision ΔE 8.7, medium↔high at CVD ΔE 2.9) and
 *    that is acceptable only because a status colour never carries meaning
 *    alone: every status mark here is paired with its label. Do not reuse a
 *    status hue as "series 5" — it would impersonate a state.
 *
 * Colour follows the entity, never its rank: `surfaceColor("cloud")` returns the
 * same hue whatever position cloud lands in after a filter.
 */

export type ChartTheme = "dark" | "light";

/** The five attack surfaces the posture engine scores, in a fixed order. */
export const SURFACES = ["design", "code", "test", "cloud", "mobile"] as const;
export type Surface = (typeof SURFACES)[number];

export const SURFACE_LABELS: Record<string, string> = {
  design: "Design",
  code: "Code",
  test: "Test",
  cloud: "Cloud",
  mobile: "Mobile",
  other: "Other",
};

/** Validated categorical theme, stepped per surface. Order is fixed. */
const CATEGORICAL: Record<ChartTheme, string[]> = {
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"],
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"],
};

/** Anything beyond the five named surfaces folds here — never a generated hue. */
const OTHER: Record<ChartTheme, string> = { dark: "#71717A", light: "#52525B" };

export function surfaceColor(surface: string, theme: ChartTheme = "dark"): string {
  const index = (SURFACES as readonly string[]).indexOf(String(surface).toLowerCase());
  if (index < 0) return OTHER[theme];
  return CATEGORICAL[theme][index];
}

/** Status palette — the product's severity tokens. Always shown with a label. */
export const SEVERITY_COLORS: Record<string, string> = {
  critical: "#DC2626",
  high: "#EA580C",
  medium: "#CA8A04",
  low: "#16A34A",
  info: "#0EA5E9",
};

export const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"] as const;

export function severityColor(severity: string): string {
  return SEVERITY_COLORS[String(severity).toLowerCase()] ?? OTHER.dark;
}

/*
 * Lifecycle states. Mapped onto the same reserved status roles rather than new
 * hues, because these are states too: `fixed` is good, `regressed` is critical
 * (a fix that did not hold), `retest_failed` is serious, `open` is neutral work.
 */
export const LIFECYCLE_COLORS: Record<string, string> = {
  open: "#0EA5E9",
  in_progress: "#CA8A04",
  fixed: "#16A34A",
  accepted: "#71717A",
  retest_failed: "#EA580C",
  regressed: "#DC2626",
};

export const LIFECYCLE_ORDER = [
  "open",
  "in_progress",
  "fixed",
  "retest_failed",
  "regressed",
  "accepted",
] as const;

export const LIFECYCLE_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  fixed: "Fixed",
  retest_failed: "Retest failed",
  regressed: "Regressed",
  accepted: "Accepted",
};

export function lifecycleColor(status: string): string {
  return LIFECYCLE_COLORS[String(status).toLowerCase()] ?? OTHER.dark;
}

/** Score → status band. Used for the per-surface meters, never for identity. */
export function scoreTone(score: number): { color: string; label: string } {
  if (score >= 85) return { color: "#16A34A", label: "Strong" };
  if (score >= 70) return { color: "#CA8A04", label: "Fair" };
  if (score >= 50) return { color: "#EA580C", label: "Weak" };
  return { color: "#DC2626", label: "Critical" };
}

/** Recessive chrome: grid, axis and tooltip surfaces per theme. */
export const CHROME: Record<ChartTheme, { grid: string; axis: string; tip: string; tipBorder: string; ink: string }> = {
  dark: { grid: "#27272A", axis: "#52525B", tip: "#0A0A0A", tipBorder: "#3F3F46", ink: "#E4E4E7" },
  light: { grid: "#E4E4E7", axis: "#A1A1AA", tip: "#FFFFFF", tipBorder: "#D4D4D8", ink: "#18181B" },
};
