import React from 'react';
import { cn } from '@/lib/utils';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Lightweight markdown-to-JSX renderer for controlled content.
 * Handles headings, bold, italic, inline code, lists, blockquotes,
 * horizontal rules, tables, and paragraphs.
 */
export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  const nextKey = () => key++;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line — skip
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line.trim())) {
      elements.push(<hr key={nextKey()} className="my-4 border-border" />);
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,4})\s+(.*)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const Tag = `h${level}` as keyof JSX.IntrinsicElements;
      const hClasses: Record<number, string> = {
        1: 'text-xl font-bold mt-6 mb-3 text-foreground',
        2: 'text-lg font-semibold mt-5 mb-2 text-foreground',
        3: 'text-base font-semibold mt-4 mb-2 text-foreground',
        4: 'text-sm font-semibold mt-3 mb-1 text-foreground',
      };
      elements.push(
        <Tag key={nextKey()} className={hClasses[level]}>
          {renderInline(text)}
        </Tag>
      );
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <blockquote
          key={nextKey()}
          className="border-l-2 border-primary/50 pl-3 my-3 text-sm text-muted-foreground italic"
        >
          {renderInline(quoteLines.join(' '))}
        </blockquote>
      );
      continue;
    }

    // Table
    if (line.includes('|') && i + 1 < lines.length && /^\|?[\s-:|]+\|/.test(lines[i + 1])) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].includes('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      elements.push(renderTable(tableLines, nextKey()));
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i++;
      }
      elements.push(
        <ul key={nextKey()} className="list-disc list-inside space-y-1 my-2 text-sm text-foreground">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line.trim())) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i++;
      }
      elements.push(
        <ol key={nextKey()} className="list-decimal list-inside space-y-1 my-2 text-sm text-foreground">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Paragraph (collect consecutive non-special lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('> ') &&
      !/^---+\s*$/.test(lines[i].trim()) &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      elements.push(
        <p key={nextKey()} className="text-sm text-foreground my-2 leading-relaxed">
          {renderInline(paraLines.join(' '))}
        </p>
      );
    }
  }

  return <div className={cn('space-y-0', className)}>{elements}</div>;
}

/** Render inline formatting: bold, italic, inline code, links */
function renderInline(text: string): React.ReactNode {
  // Split by inline patterns and build a node array
  const parts: React.ReactNode[] = [];
  // Process with regex replacements — simple sequential pass
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith('`')) {
      // Inline code
      parts.push(
        <code key={parts.length} className="bg-muted px-1 py-0.5 rounded text-xs font-mono text-foreground">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**')) {
      // Bold
      parts.push(
        <strong key={parts.length} className="font-semibold">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*')) {
      // Italic
      parts.push(
        <em key={parts.length}>{token.slice(1, -1)}</em>
      );
    } else if (token.startsWith('[')) {
      // Link [text](url)
      const linkMatch = token.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        parts.push(
          <a
            key={parts.length}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline hover:text-primary/80"
          >
            {linkMatch[1]}
          </a>
        );
      }
    }

    lastIndex = match.index + token.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

/** Render a markdown table */
function renderTable(tableLines: string[], key: number): React.ReactNode {
  const parseRow = (line: string) =>
    line
      .split('|')
      .map(c => c.trim())
      .filter(c => c.length > 0 && !/^[-:]+$/.test(c));

  const headerCells = parseRow(tableLines[0]);
  // Skip separator row (index 1)
  const bodyRows = tableLines.slice(2).map(parseRow);

  return (
    <div key={key} className="my-3 overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border">
            {headerCells.map((cell, idx) => (
              <th key={idx} className="text-left py-1.5 px-2 font-semibold text-foreground">
                {renderInline(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, rIdx) => (
            <tr key={rIdx} className="border-b border-border/50">
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="py-1.5 px-2 text-foreground">
                  {renderInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
