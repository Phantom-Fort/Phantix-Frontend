import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

/**
 * Renders post markdown with the Weekly's type system. react-markdown passes a
 * `node` prop to custom components; we strip it so it never reaches the DOM.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      components={{
        h1: ({ node: _n, ...props }) => <h1 className="md-h1" {...props} />,
        h2: ({ node: _n, ...props }) => <h2 className="md-h2" {...props} />,
        h3: ({ node: _n, ...props }) => <h3 className="md-h3" {...props} />,
        h4: ({ node: _n, ...props }) => <h4 className="md-h4" {...props} />,
        p: ({ node: _n, ...props }) => <p className="md-p" {...props} />,
        a: ({ node: _n, ...props }) => <a className="md-a" {...props} />,
        blockquote: ({ node: _n, ...props }) => <blockquote className="md-quote" {...props} />,
        ul: ({ node: _n, ...props }) => <ul className="md-ul" {...props} />,
        ol: ({ node: _n, ...props }) => <ol className="md-ol" {...props} />,
        li: ({ node: _n, ...props }) => <li className="md-li" {...props} />,
        code: ({ node: _n, ...props }) => <code className="md-code" {...props} />,
        pre: ({ node: _n, ...props }) => <pre className="md-pre" {...props} />,
        hr: ({ node: _n, ...props }) => <hr className="md-hr" {...props} />,
        img: ({ node: _n, ...props }) => <img className="md-img" {...props} />,
        table: ({ node: _n, ...props }) => <table className="md-table" {...props} />,
        th: ({ node: _n, ...props }) => <th className="md-th" {...props} />,
        td: ({ node: _n, ...props }) => <td className="md-td" {...props} />,
        strong: ({ node: _n, ...props }) => <strong className="md-strong" {...props} />,
        em: ({ node: _n, ...props }) => <em className="md-em" {...props} />,
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
