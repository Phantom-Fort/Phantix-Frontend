import type { Post } from "./types";

/**
 * Minimal YAML-ish frontmatter parser. Supports the flat key/value pairs the
 * blog needs (strings, numbers, booleans). Values with a colon or comma stay
 * intact because we split on the first colon only; values must be single-line.
 */
function scalar(value: string): unknown {
  const v = value.trim();
  if (v === "true") return true;
  if (v === "false") return false;
  if (v === "null" || v === "~") return null;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

function parseFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
  const match = raw.match(/^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/);
  if (!match) return { data: {}, body: raw };

  const data: Record<string, unknown> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (!key) continue;
    data[key] = scalar(line.slice(idx + 1));
  }
  return { data, body: raw.slice(match[0].length) };
}

function slugFromPath(path: string): string {
  const base = path.split("/").pop() ?? path;
  // Drop the .md extension and any "01-" ordering prefix, so filenames are
  // stable even when posts are re-ordered.
  return base.replace(/\.md$/, "").replace(/^\d+-/, "");
}

export function parsePostFile(path: string, raw: string): Post {
  const { data, body } = parseFrontmatter(raw);
  const slug = slugFromPath(path);
  const order =
    typeof data.order === "number"
      ? data.order
      : Number.parseInt(String(data.no ?? "0"), 10) || 0;

  return {
    slug,
    title: String(data.title ?? slug),
    no: String(data.no ?? "").padStart(2, "0"),
    order,
    date: String(data.date ?? ""),
    kicker: data.kicker ? String(data.kicker) : undefined,
    excerpt: String(data.excerpt ?? ""),
    featured: data.featured === true,
    body: body.trim(),
  };
}
