import { Fragment, type ReactNode } from 'react';

type Props = {
  text: string;
  className?: string;
};

/**
 * Renderer de markdown mínimo — suficiente para respuestas de la IA
 * (listas numeradas, **negrita**, *itálica*, `code`, [link](url)).
 * No metemos `react-markdown` para no inflar el bundle ~40KB.
 */
export function MarkdownText({ text, className }: Props) {
  const blocks = parseBlocks(text);
  return (
    <div className={className ? `markdown ${className}` : 'markdown'}>
      {blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </div>
  );
}

type BlockType =
  | { kind: 'paragraph'; content: string }
  | { kind: 'ol'; items: string[] }
  | { kind: 'ul'; items: string[] };

function parseBlocks(raw: string): BlockType[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const blocks: BlockType[] = [];
  let olBuffer: string[] = [];
  let ulBuffer: string[] = [];
  let paraBuffer: string[] = [];

  const flushParagraph = () => {
    if (paraBuffer.length === 0) return;
    blocks.push({ kind: 'paragraph', content: paraBuffer.join(' ') });
    paraBuffer = [];
  };

  const flushOrdered = () => {
    if (olBuffer.length === 0) return;
    blocks.push({ kind: 'ol', items: olBuffer });
    olBuffer = [];
  };

  const flushUnordered = () => {
    if (ulBuffer.length === 0) return;
    blocks.push({ kind: 'ul', items: ulBuffer });
    ulBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.length === 0) {
      flushParagraph();
      flushOrdered();
      flushUnordered();
      continue;
    }

    const olMatch = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (olMatch) {
      flushParagraph();
      flushUnordered();
      olBuffer.push(olMatch[2]!);
      continue;
    }

    const ulMatch = line.match(/^[-*•]\s+(.+)$/);
    if (ulMatch) {
      flushParagraph();
      flushOrdered();
      ulBuffer.push(ulMatch[1]!);
      continue;
    }

    flushOrdered();
    flushUnordered();
    paraBuffer.push(line);
  }

  flushParagraph();
  flushOrdered();
  flushUnordered();

  return blocks;
}

function Block({ block }: { block: BlockType }) {
  if (block.kind === 'paragraph') {
    return <p>{renderInline(block.content)}</p>;
  }
  if (block.kind === 'ol') {
    return (
      <ol>
        {block.items.map((item, index) => (
          <li key={index}>{renderInline(item)}</li>
        ))}
      </ol>
    );
  }
  return (
    <ul>
      {block.items.map((item, index) => (
        <li key={index}>{renderInline(item)}</li>
      ))}
    </ul>
  );
}

// Inline: **bold**, *italic*, `code`, [label](url). Orden importa (bold antes
// que italic para que `**x**` no lo interprete como 2 itálicos).
function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let remaining = text;
  let key = 0;

  const patterns: Array<{
    regex: RegExp;
    build: (match: RegExpExecArray) => ReactNode;
  }> = [
    {
      regex: /\*\*([^*]+)\*\*/,
      build: (m) => <strong key={`k${key++}`}>{m[1]}</strong>
    },
    {
      regex: /(?<!\*)\*([^*]+)\*(?!\*)/,
      build: (m) => <em key={`k${key++}`}>{m[1]}</em>
    },
    {
      regex: /`([^`]+)`/,
      build: (m) => <code key={`k${key++}`}>{m[1]}</code>
    },
    {
      regex: /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/,
      build: (m) => (
        <a key={`k${key++}`} href={m[2]} target="_blank" rel="noreferrer noopener">
          {m[1]}
        </a>
      )
    }
  ];

  while (remaining.length > 0) {
    let firstIndex = remaining.length;
    let chosen: { pattern: typeof patterns[number]; match: RegExpExecArray } | null = null;

    for (const pattern of patterns) {
      const match = pattern.regex.exec(remaining);
      if (match && match.index < firstIndex) {
        firstIndex = match.index;
        chosen = { pattern, match };
      }
    }

    if (!chosen) {
      nodes.push(<Fragment key={`t${key++}`}>{remaining}</Fragment>);
      break;
    }

    if (chosen.match.index > 0) {
      nodes.push(<Fragment key={`t${key++}`}>{remaining.slice(0, chosen.match.index)}</Fragment>);
    }

    nodes.push(chosen.pattern.build(chosen.match));
    remaining = remaining.slice(chosen.match.index + chosen.match[0].length);
  }

  return nodes;
}
