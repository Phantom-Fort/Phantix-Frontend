// Normalizes AGI engine copy into well-formed markdown before it reaches the
// chat renderer.
//
// The session-chat contract (backend) sends operator text as plain text with
// newlines preserved and uses the circle bullet "○" for every list row. Rendered
// raw, those lines become a <br>-separated wall of text with zero indentation.
// This transformer rewrites the conventions into real markdown so the renderer
// produces proper nested lists with hanging indents, markers, and rhythm:
//
//   ○ Root item                →      - Root item
//     ○ Nested item            →        - Nested item
//   1. Ordered stays ordered
//
// It is purely a text reshape — react-markdown never parses raw HTML, so the
// pipeline stays XSS-safe.

const BULLET = /^[•◦○*]$/;

export function normalizeAgiMarkdown(source: string): string {
  if (!source) return source;
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let inFence = false;

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");

    // Never touch fenced code blocks (agi-tool JSON, curl samples, …).
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      out.push(line);
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }

    // Already-markdown list rows pass through untouched.
    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
      out.push(line);
      continue;
    }

    const m = line.match(/^(\s*)[•◦○*]\s+(.*)$/);
    if (m && BULLET.test(m[0].trim().charAt(0))) {
      const indent = m[1].replace(/\t/g, "  ");
      // Two leading spaces per nesting level → one markdown indent unit.
      const depth = Math.floor(indent.length / 2);
      const pad = "  ".repeat(depth);
      out.push(`${pad}- ${m[2].trim()}`);
      continue;
    }

    out.push(line);
  }

  return out
    .join("\n")
    // Collapse 3+ blank lines into one blank line for an even rhythm.
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}