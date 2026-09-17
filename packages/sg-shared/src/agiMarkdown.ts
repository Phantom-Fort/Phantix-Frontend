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
// Lines that already use a markdown marker (-, *, +, "1.") get the same
// re-indent treatment, not a pass-through: an LLM's own list indentation is
// arbitrary (2, 4, 6+ spaces, inconsistently) and CommonMark treats 4+ leading
// spaces as an *indented code block*, not a nested list — so a perfectly
// marker-correct "      - item" silently loses every bit of list styling
// (bullet, hanging indent, item spacing) and renders as an unstyled monospace
// block instead. Nesting depth is read *relatively* (each marker line's raw
// indent compared to the open list's indent stack) so it survives whatever
// literal whitespace width the source used, then re-emitted at a fixed 2
// spaces per level — comfortably under the 4-space code-block threshold.
//
// It is purely a text reshape — react-markdown never parses raw HTML, so the
// pipeline stays XSS-safe.

const BULLET_LINE = /^(\s*)[•◦○*]\s+(.*)$/;
const MARKDOWN_LIST_LINE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

export function normalizeAgiMarkdown(source: string): string {
  if (!source) return source;
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let inFence = false;
  // Raw indent widths of the currently-open list levels, outermost first —
  // lets nesting depth be read from indentation *relative to itself* instead
  // of assuming a fixed number of spaces per level.
  const indentStack: number[] = [];

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

    // A blank line doesn't end list nesting (a "loose" list uses blank lines
    // between items on purpose — that's the extra breathing room readers
    // actually ask for), so keep the indent stack across it.
    if (!line.trim()) {
      out.push(line);
      continue;
    }

    const bulletMatch = line.match(BULLET_LINE);
    const mdMatch = !bulletMatch ? line.match(MARKDOWN_LIST_LINE) : null;

    if (bulletMatch || mdMatch) {
      const indentRaw = (bulletMatch ? bulletMatch[1] : mdMatch![1]).replace(/\t/g, "  ");
      const marker = bulletMatch ? "-" : mdMatch![2];
      const content = (bulletMatch ? bulletMatch[2] : mdMatch![3]).trim();
      const width = indentRaw.length;

      while (indentStack.length && width < indentStack[indentStack.length - 1]) {
        indentStack.pop();
      }
      if (!indentStack.length || width > indentStack[indentStack.length - 1]) {
        indentStack.push(width);
      }
      const depth = indentStack.length - 1;
      out.push(`${"  ".repeat(depth)}${marker} ${content}`);
      continue;
    }

    // Real prose breaks the list's nesting context, so a later "- item" after
    // a paragraph starts a fresh list instead of nesting under whatever depth
    // was open before the prose interrupted it.
    indentStack.length = 0;
    out.push(line);
  }

  return out
    .join("\n")
    // Collapse 3+ blank lines into one blank line for an even rhythm.
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
