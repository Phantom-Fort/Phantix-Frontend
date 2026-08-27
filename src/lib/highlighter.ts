// Fine-grained Shiki bundle — loads ONLY the languages a pentest app actually
// renders (bash, python, json, javascript/typescript, http, sql, yaml, xml,
// markdown). Importing from "shiki" root would pull every grammar (~127 KB
// gzip) into the main chunk; this keeps the highlighter + grammars in small
// lazy chunks and uses the JS regex engine so no WASM/oniguruma is shipped.
import type { HighlighterCore } from "shiki/core"
import { createHighlighterCore } from "shiki/core"
import { createJavaScriptRegexEngine } from "shiki/engine/javascript"

export const DEFAULT_THEME = "github-dark"

const LANG_IMPORTS = {
  bash: () => import("shiki/dist/langs/bash.mjs"),
  python: () => import("shiki/dist/langs/python.mjs"),
  json: () => import("shiki/dist/langs/json.mjs"),
  javascript: () => import("shiki/dist/langs/javascript.mjs"),
  typescript: () => import("shiki/dist/langs/typescript.mjs"),
  http: () => import("shiki/dist/langs/http.mjs"),
  sql: () => import("shiki/dist/langs/sql.mjs"),
  yaml: () => import("shiki/dist/langs/yaml.mjs"),
  xml: () => import("shiki/dist/langs/xml.mjs"),
  markdown: () => import("shiki/dist/langs/markdown.mjs"),
} as const

type SupportedLang = keyof typeof LANG_IMPORTS

const ALIASES: Record<string, SupportedLang> = {
  shell: "bash", sh: "bash", zsh: "bash", console: "bash", terminal: "bash",
  py: "python", python3: "python",
  js: "javascript", jsx: "javascript", mjs: "javascript", node: "javascript",
  ts: "typescript", tsx: "typescript",
  nuclei: "yaml", yml: "yaml",
  html: "xml", svg: "xml",
  md: "markdown",
  curl: "bash", req: "http", request: "http", response: "http",
}

const PLAINTEXT = new Set(["text", "plain", "txt", "plaintext", ""])

/** Normalize an arbitrary fence language to one we can highlight, or plaintext. */
export function normalizeLang(lang?: string | null): SupportedLang | "plaintext" {
  const raw = (lang ?? "").trim().toLowerCase()
  if (PLAINTEXT.has(raw)) return "plaintext"
  if (raw in LANG_IMPORTS) return raw as SupportedLang
  if (raw in ALIASES) return ALIASES[raw]
  return "plaintext"
}

let highlighterPromise: Promise<HighlighterCore> | null = null

function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [import("shiki/dist/themes/github-dark.mjs")],
      langs: Object.values(LANG_IMPORTS).map((load) => load()),
      engine: createJavaScriptRegexEngine({ forgiving: true }),
    }).catch((err) => {
      highlighterPromise = null
      throw err
    })
  }
  return highlighterPromise
}

/** Highlight code to HTML with the constrained bundle; falls back to escaped text on failure. */
export async function highlightCode(code: string, lang?: string | null): Promise<string> {
  const hl = await getHighlighter()
  return hl.codeToHtml(code, { lang: normalizeLang(lang), theme: DEFAULT_THEME })
}
