import React, { forwardRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Full-featured markdown renderer using react-markdown + remark-gfm + rehype-raw.
 * Supports headings, bold, italic, inline code, code blocks, lists,
 * blockquotes, horizontal rules, tables, images, raw HTML, and links.
 */
export const MarkdownRenderer = forwardRef<HTMLDivElement, MarkdownRendererProps>(
  ({ content, className }, ref) => {
    return (
      <div ref={ref} className={cn('prose-custom space-y-2', className)}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            h1: ({ children }) => (
              <h1 className="text-xl font-bold mt-6 mb-3 text-foreground">{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-lg font-semibold mt-5 mb-2 text-foreground">{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-base font-semibold mt-4 mb-2 text-foreground">{children}</h3>
            ),
            h4: ({ children }) => (
              <h4 className="text-sm font-semibold mt-3 mb-1 text-foreground">{children}</h4>
            ),
            p: ({ children }) => (
              <p className="text-sm text-foreground my-2 leading-relaxed">{children}</p>
            ),
            a: ({ href, children }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline hover:text-primary/80"
              >
                {children}
              </a>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold">{children}</strong>
            ),
            em: ({ children }) => <em>{children}</em>,
            blockquote: ({ children }) => (
              <blockquote className="border-l-2 border-primary/50 pl-3 my-3 text-sm text-muted-foreground italic">
                {children}
              </blockquote>
            ),
            ul: ({ children }) => (
              <ul className="list-disc list-inside space-y-1 my-2 text-sm text-foreground">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal list-inside space-y-1 my-2 text-sm text-foreground">{children}</ol>
            ),
            li: ({ children }) => <li>{children}</li>,
            hr: () => <hr className="my-4 border-border" />,
            code: ({ className: codeClassName, children }) => {
              const isBlock = codeClassName?.startsWith('language-');
              if (isBlock) {
                return (
                  <pre className="bg-muted rounded-md p-3 my-3 overflow-x-auto">
                    <code className={cn('text-xs font-mono text-foreground', codeClassName)}>
                      {children}
                    </code>
                  </pre>
                );
              }
              return (
                <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono text-foreground">
                  {children}
                </code>
              );
            },
            pre: ({ children }) => <>{children}</>,
            img: ({ src, alt, width, height }) => (
              <img
                src={src}
                alt={alt || ''}
                width={width}
                height={height}
                className="max-w-full h-auto rounded-md my-3"
                loading="lazy"
              />
            ),
            table: ({ children }) => (
              <div className="my-3 overflow-x-auto">
                <table className="w-full text-sm border-collapse">{children}</table>
              </div>
            ),
            thead: ({ children }) => <thead>{children}</thead>,
            tbody: ({ children }) => <tbody>{children}</tbody>,
            tr: ({ children }) => (
              <tr className="border-b border-border/50">{children}</tr>
            ),
            th: ({ children }) => (
              <th className="text-left py-1.5 px-2 font-semibold text-foreground border-b border-border">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="py-1.5 px-2 text-foreground">{children}</td>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  }
);

MarkdownRenderer.displayName = 'MarkdownRenderer';
