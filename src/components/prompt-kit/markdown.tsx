import { cn } from "@/lib/utils"
import { marked } from "marked"
import { memo, useId, useMemo } from "react"
import ReactMarkdown, { Components } from "react-markdown"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"
import { CodeBlock, CodeBlockCode } from "./code-block"
import MermaidDiagram from "@/components/MermaidDiagram"

export type MarkdownProps = {
  children: string
  id?: string
  className?: string
  components?: Partial<Components>
}

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown)
  return tokens.map((token) => token.raw)
}

function extractLanguage(className?: string): string {
  if (!className) return "plaintext"
  const match = className.match(/language-(\w+)/)
  return match ? match[1] : "plaintext"
}

// ── Chat typography ──────────────────────────────────────────────────────────
// Tailwind preflight resets every element margin, so without explicit spacing
// markdown renders as a flat wall. These components give streamed answers a
// deliberate reading rhythm: real list indentation with hanging markers, quiet
// heading scale, tables that scroll instead of overflow, and quotes that read
// as quotes. Nesting indents naturally — every ul/ol pads its own level.
const INITIAL_COMPONENTS: Partial<Components> = {
  p: ({ children }) => (
    <p className="my-2.5 break-words text-[0.95em] leading-[1.75] first:mt-0 last:mb-0">
      {children}
    </p>
  ),
  h1: ({ children }) => (
    <h1 className="mb-1.5 mt-4 break-words text-[1.2em] font-semibold leading-snug tracking-tight text-white first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-1.5 mt-4 break-words text-[1.1em] font-semibold leading-snug tracking-tight text-white first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-3 break-words text-[1.02em] font-semibold leading-snug text-gold-200 first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-1 mt-3 break-words text-[0.98em] font-semibold text-slate-100 first:mt-0">
      {children}
    </h4>
  ),
  h5: ({ children }) => (
    <h5 className="mb-1 mt-2 text-[0.92em] font-semibold uppercase tracking-wider text-slate-400 first:mt-0">
      {children}
    </h5>
  ),
  ul: ({ children }) => (
    <ul className="my-2 list-disc space-y-1 pl-[1.35em] marker:font-semibold marker:text-gold-400/80 [&>li>p]:my-0">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal space-y-1 pl-[1.55em] marker:font-semibold marker:text-gold-400/80 [&>li>p]:my-0">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="break-words pl-1 leading-[1.7] [&>ul]:mt-1 [&>ol]:mt-1">
      {children}
    </li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-3 border-l-2 border-gold-400/40 pl-3 text-[0.92em] italic leading-relaxed text-slate-400 [&>p]:my-1">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-phantix-700/40" />,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="break-all font-medium text-gold-300 underline decoration-gold-400/40 underline-offset-2 transition-colors hover:text-gold-200 hover:decoration-gold-300"
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-slate-100">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-slate-200">{children}</em>,
  table: ({ children }) => (
    <div className="wb-scroll my-3 max-w-full overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-left text-[0.88em]">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-border bg-muted/60">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-3 py-1.5 font-semibold text-slate-200">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-b border-border/60 px-3 py-1.5 align-top text-slate-300 last:border-b-0">
      {children}
    </td>
  ),
  img: ({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={typeof src === "string" ? src : undefined}
      alt={alt ?? ""}
      loading="lazy"
      className="my-3 max-w-full rounded-lg border border-border"
    />
  ),
  code: function CodeComponent({ className, children, ...props }) {
    const isInline =
      !props.node?.position?.start.line ||
      props.node?.position?.start.line === props.node?.position?.end.line

    if (isInline) {
      return (
        <code
          className={cn(
            "rounded-md border border-phantix-700/50 bg-phantix-950/80 px-1 py-px font-mono text-[0.85em] text-gold-200/90",
            className
          )}
          {...props}
        >
          {children}
        </code>
      )
    }

    const language = extractLanguage(className)
    const code = String(children ?? "").replace(/\n$/, "")

    if (language === "mermaid") {
      return <MermaidDiagram code={code} />
    }

    return (
      <CodeBlock className={className}>
        <CodeBlockCode code={code} language={language} />
      </CodeBlock>
    )
  },
  pre: function PreComponent({ children }) {
    return <>{children}</>
  },
}

const MemoizedMarkdownBlock = memo(
  function MarkdownBlock({
    content,
    components = INITIAL_COMPONENTS,
  }: {
    content: string
    components?: Partial<Components>
  }) {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    )
  },
  function propsAreEqual(prevProps, nextProps) {
    return prevProps.content === nextProps.content
  }
)

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock"

function MarkdownComponent({
  children,
  id,
  className,
  components = INITIAL_COMPONENTS,
}: MarkdownProps) {
  const generatedId = useId()
  const blockId = id ?? generatedId
  const blocks = useMemo(() => parseMarkdownIntoBlocks(children), [children])

  return (
    <div className={cn("min-w-0 break-words", className)}>
      {blocks.map((block, index) => (
        <MemoizedMarkdownBlock
          key={`${blockId}-block-${index}`}
          content={block}
          components={components}
        />
      ))}
    </div>
  )
}

const Markdown = memo(MarkdownComponent)
Markdown.displayName = "Markdown"

export { Markdown }