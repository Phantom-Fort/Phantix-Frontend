#!/usr/bin/env node
/**
 * Validates the social-profile copy in docs/brand/social-profiles.md — profile
 * bios, LinkedIn Abouts, the founder profile and the launch posts — against the
 * field limits of each platform.
 *
 * Copy lives in fenced blocks whose info string carries an id and a ceiling:
 *
 *   ```bio:linkedin-tagline limit=120
 *   ...copy...
 *   ```
 *
 *   `limit=25w` counts whitespace-separated words instead of characters.
 *
 * Fails (exit 1) on an over-limit draft, a duplicate id, an unclosed block or
 * a missing block. Warns when a draft is within 5 characters of its ceiling,
 * because platforms that count URLs as 23 characters, emoji as two or newlines
 * as characters will still reject a "fits exactly" paste.
 *
 * Usage: npm run validate:social
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DOC = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "docs",
  "brand",
  "social-profiles.md",
);

/** Expected drafts, so a deleted block fails instead of silently vanishing. */
const REQUIRED = [
  // Company / product profiles
  "linkedin-tagline",
  "linkedin-about",
  "x-bio",
  "instagram-bio",
  "facebook-short",
  "facebook-about",
  "youtube-about",
  "github-bio",
  // Founder-facing profile
  "founder-headline",
  "founder-about",
  // Launch posts
  "post-1-linkedin",
  "post-1-x",
  "post-1-instagram",
  "post-2-linkedin",
  "post-2-x",
  "post-2-instagram",
  "post-3-linkedin",
  "post-3-x",
  "post-3-instagram",
  "post-4-linkedin",
  "post-4-x",
  "post-4-instagram",
  "post-5-linkedin",
  "post-5-x",
  "post-5-instagram",
  // Cross-platform boilerplates
  "boilerplate-15w",
  "boilerplate-30w",
  "boilerplate-50w",
  "boilerplate-100w",
  "boilerplate-press",
];

const md = readFileSync(DOC, "utf8");
const lines = md.split(/\r?\n/);

/** @type {{id:string,limit:number,unit:"chars"|"words",line:number,text:string[]}[]} */
const blocks = [];
let open = null;

lines.forEach((line, index) => {
  const opener = /^```bio:([a-z0-9-]+)\s+limit=(\d+)(w?)\s*$/.exec(line);
  if (opener) {
    if (open) throw new Error(`Nested bio block at line ${index + 1} (previous opened at ${open.line})`);
    open = {
      id: opener[1],
      limit: Number(opener[2]),
      unit: opener[3] === "w" ? "words" : "chars",
      line: index + 1,
      text: [],
    };
    return;
  }
  if (!open) return;
  if (/^```\s*$/.test(line)) {
    blocks.push(open);
    open = null;
    return;
  }
  open.text.push(line);
});

if (open) throw new Error(`Unclosed bio block "${open.id}" opened at line ${open.line}`);

const measure = (text) =>
  text.length === 0
    ? { chars: 0, words: 0 }
    : {
        // Code points, not UTF-16 units: em dashes and accents count once.
        chars: [...text].length,
        words: text.split(/\s+/).filter(Boolean).length,
      };

const seen = new Set();
const failures = [];
const warnings = [];
const rows = [];

for (const block of blocks) {
  if (seen.has(block.id)) failures.push(`duplicate id "${block.id}" (line ${block.line})`);
  seen.add(block.id);

  const text = block.text.join("\n").trim();
  const { chars, words } = measure(text);
  const used = block.unit === "words" ? words : chars;
  const near = used > block.limit - 5;
  const over = used > block.limit;

  rows.push({
    id: block.id,
    unit: block.unit,
    used,
    limit: block.limit,
    state: over ? "OVER" : near ? "near" : "ok",
  });

  if (over) {
    failures.push(`${block.id}: ${used} ${block.unit} > limit ${block.limit} (+${used - block.limit})`);
  } else if (near) {
    warnings.push(`${block.id}: ${used}/${block.limit} ${block.unit} — headroom under 5`);
  }
}

for (const id of REQUIRED) {
  if (!seen.has(id)) failures.push(`missing required draft "${id}"`);
}

/*
 * Internal cross-references: every `](#slug)` in the doc must match a heading.
 * Mirrors the github-slugger rules — strip anything outside letters, numbers,
 * spaces and hyphens, then turn each space into a hyphen without collapsing
 * runs, so "Governance — what" becomes "governance--what".
 */
const slugify = (heading) =>
  heading
    .replace(/^#{1,6}\s+/, "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s/g, "-");

const headings = new Set(lines.filter((line) => /^#{1,6}\s/.test(line)).map(slugify));
const anchors = new Set([...md.matchAll(/\]\(#([^)]+)\)/g)].map((match) => match[1]));

for (const anchor of anchors) {
  if (!headings.has(anchor)) failures.push(`broken cross-reference "#${anchor}"`);
}

const pad = (value, width) => String(value).padEnd(width);
const padStart = (value, width) => String(value).padStart(width);

console.log(`social profiles — ${path.relative(process.cwd(), DOC)}\n`);
console.log(`  ${pad("id", 22)} ${pad("unit", 6)} ${padStart("used", 6)} ${padStart("limit", 6)}  state`);
console.log(`  ${"-".repeat(22)} ${"-".repeat(6)} ${"-".repeat(6)} ${"-".repeat(6)}  -----`);
for (const row of rows) {
  console.log(
    `  ${pad(row.id, 22)} ${pad(row.unit, 6)} ${padStart(row.used, 6)} ${padStart(row.limit, 6)}  ${row.state}`,
  );
}

if (warnings.length > 0) {
  console.log("\nwarnings");
  for (const warning of warnings) console.log(`  ! ${warning}`);
}

if (failures.length > 0) {
  console.error("\nfailed");
  for (const failure of failures) console.error(`  x ${failure}`);
  process.exit(1);
}

console.log(`\nall ${rows.length} drafts fit their platform field limits.`);
console.log(`${anchors.size} internal cross-references resolve.`);
