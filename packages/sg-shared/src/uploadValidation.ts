// ── Client-side input validation & sanitization ──────────────────────────────
//
// Mirrors the server-side guards in the backend so an operator gets an
// immediate, specific error instead of a round-trip `400`, and so we never send
// obviously malformed payloads:
//
//   app/shared/security/upload_guard.py   (file size / type / extension)
//   app/shared/security/input_sanitize.py (control chars, markup, filenames)
//
// The server is still the authority — it re-sniffs every upload and re-sanitizes
// every field. These helpers only improve UX and reduce wasted requests, so they
// stay deliberately lenient: when in doubt, let the request through and let the
// backend decide.

const MB = 1024 * 1024;

export interface UploadPolicy {
  /** Human label used in error messages, e.g. "Logo". */
  label: string;
  maxBytes: number;
  /** Lower-case extensions without the dot. */
  readonly extensions: readonly string[];
  /** MIME types the browser might report (advisory — browsers often send ""). */
  readonly mimeTypes: readonly string[];
}

/**
 * Keep these in sync with the backend limits:
 *   APK      → settings.APK_MAX_SIZE_MB (default 200)
 *   Diagram  → drawio_parser.MAX_FILE_BYTES (5 MiB)
 *   API spec → asset import service limit
 *   Logo     → control_plane organizations._MAX_LOGO_BYTES (2 MiB)
 */
export const UPLOAD_POLICIES = {
  apk: {
    label: "APK",
    maxBytes: 200 * MB,
    extensions: ["apk", "xapk", "apks"],
    mimeTypes: [
      "application/vnd.android.package-archive",
      "application/zip",
      "application/octet-stream",
      "",
    ],
  },
  diagram: {
    label: "Diagram",
    maxBytes: 5 * MB,
    extensions: ["drawio", "xml"],
    mimeTypes: ["application/xml", "text/xml", "application/octet-stream", ""],
  },
  apiSpec: {
    label: "API spec",
    maxBytes: 10 * MB,
    extensions: ["json", "yaml", "yml"],
    mimeTypes: [
      "application/json",
      "application/yaml",
      "application/x-yaml",
      "text/yaml",
      "text/plain",
      "application/octet-stream",
      "",
    ],
  },
  logo: {
    label: "Logo",
    maxBytes: 2 * MB,
    extensions: ["png", "jpg", "jpeg", "webp", "svg"],
    mimeTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
  },
} as const satisfies Record<string, UploadPolicy>;

export type UploadKind = keyof typeof UPLOAD_POLICIES;

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / MB).toFixed(bytes % MB === 0 ? 0 : 1)} MB`;
}

/** Lower-case extension for a filename, or "" when there is none. */
export function fileExtension(filename: string): string {
  const base = (filename || "").split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  // dot > 0 so dotfiles (".env") are not treated as an extension.
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
}

/**
 * Returns a human-readable error message when the file is not acceptable for
 * the given policy, or `null` when it looks fine.
 *
 * Extension is the primary signal (browser MIME is unreliable for APK/drawio);
 * if a file has no extension we defer to the server's content sniffing.
 */
export function validateUploadFile(file: File | null | undefined, kind: UploadKind): string | null {
  const policy = UPLOAD_POLICIES[kind];
  if (!file) return `Choose a ${policy.label.toLowerCase()} file.`;
  if (file.size === 0) return `${policy.label} is empty.`;
  if (file.size > policy.maxBytes) {
    return `${policy.label} must be ${formatBytes(policy.maxBytes)} or smaller (selected file is ${formatBytes(file.size)}).`;
  }
  const ext = fileExtension(file.name);
  if (ext && !(policy.extensions as readonly string[]).includes(ext)) {
    const allowed = policy.extensions.map((e) => `.${e}`).join(", ");
    return `${policy.label} must be one of: ${allowed}.`;
  }
  const mime = (file.type || "").toLowerCase();
  if (!ext && mime && !(policy.mimeTypes as readonly string[]).includes(mime)) {
    return `${policy.label} type "${mime}" is not supported.`;
  }
  return null;
}

// ── Text sanitization (mirrors app/shared/security/input_sanitize.py) ────────

// C0 controls minus tab/LF/CR, plus DEL and C1 controls.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
// Every control character, including tab/LF/CR.
const ALL_CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;
const SCRIPT_BLOCK =
  /<\s*(script|style|iframe|object|embed|applet|template|noscript)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const HTML_TAG = /<[^>]*>/g;
const WHITESPACE = /\s+/g;

/** Remove NUL/control characters, keeping tab/LF/CR when `keepNewlines`. */
export function stripControlChars(value: string, keepNewlines = true): string {
  if (!value) return value;
  if (!keepNewlines) return value.replace(ALL_CONTROL_CHARS, "");
  const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return normalized.replace(CONTROL_CHARS, "");
}

/** Decode the handful of entities that can hide markup (`&lt;script&gt;`). */
function decodeBasicEntities(value: string): string {
  return value
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&amp;/gi, "&");
}

/** Remove script/style blocks and all remaining markup (entity-aware). */
export function stripHtml(value: string): string {
  if (!value) return value;
  let text = value.replace(SCRIPT_BLOCK, " ").replace(HTML_TAG, " ");
  // Two passes mirror the backend: decoding can expose a nested tag.
  for (let i = 0; i < 2; i++) {
    const decoded = decodeBasicEntities(text);
    if (decoded === text) break;
    text = decoded.replace(SCRIPT_BLOCK, " ").replace(HTML_TAG, " ");
  }
  return text;
}

export interface SanitizeTextOptions {
  maxLength?: number;
  stripHtmlTags?: boolean;
  collapseWhitespace?: boolean;
  keepNewlines?: boolean;
}

/** Normalize arbitrary user text into a safe string (trimmed, bounded). */
export function sanitizeText(value: string | null | undefined, options: SanitizeTextOptions = {}): string {
  if (value == null) return "";
  const { maxLength, stripHtmlTags = false, collapseWhitespace = false, keepNewlines = true } = options;
  let text = String(value).replace(/\uFEFF/g, "").replace(/\u200B/g, "");
  if (!keepNewlines) text = text.replace(/[\r\n\t]+/g, " ");
  text = stripControlChars(text, keepNewlines);
  if (stripHtmlTags) text = stripHtml(text);
  if (collapseWhitespace || !keepNewlines) text = text.replace(WHITESPACE, " ");
  text = text.trim();
  if (typeof maxLength === "number" && maxLength >= 0 && text.length > maxLength) {
    text = text.slice(0, maxLength).trim();
  }
  return text;
}

/** Sanitize a single-line field (names, subjects, hosts). */
export function sanitizeSingleLine(value: string | null | undefined, stripHtmlTags = true): string {
  return sanitizeText(value, { stripHtmlTags, collapseWhitespace: true, keepNewlines: false });
}

/** Sanitize a multi-line field, preserving paragraph breaks. */
export function sanitizeMultiline(value: string | null | undefined, stripHtmlTags = true): string {
  return sanitizeText(value, { stripHtmlTags, keepNewlines: true });
}
