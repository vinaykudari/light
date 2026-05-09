import type { ReactNode } from "react";
import styles from "./LightDashboard.module.css";

type Block =
  | { kind: "heading"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "paragraph"; text: string }
  | { kind: "pre"; text: string };

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className={styles.markdownMessage}>
      {parseBlocks(content).map((block, index) => renderBlock(block, index))}
    </div>
  );
}

export function ThinkingBubble({ label }: { label: string }) {
  return (
    <article className={`${styles.chatBubble} ${styles.thinkingBubble}`} data-role="assistant">
      <strong>{label}</strong>
      <div className={styles.typingDots} aria-label="Thinking">
        <span />
        <span />
        <span />
      </div>
    </article>
  );
}

function parseBlocks(content: string): Block[] {
  const blocks: Block[] = [];
  const lines = content.replace(/\r/g, "").split("\n");
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let code: string[] | null = null;

  function flushParagraph() {
    if (!paragraph.length) return;
    blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  }

  function flushList() {
    if (!list) return;
    blocks.push({ kind: "list", ordered: list.ordered, items: list.items });
    list = null;
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      if (code) {
        blocks.push({ kind: "pre", text: code.join("\n") });
        code = null;
      } else {
        flushParagraph();
        flushList();
        code = [];
      }
      continue;
    }
    if (code) {
      code.push(line);
      continue;
    }
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = trimmed.match(/^#{1,4}\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "heading", text: heading[1] });
      continue;
    }
    const bullet = trimmed.match(/^([-*]|\d+[.)])\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      const ordered = /^\d/.test(bullet[1]);
      if (!list || list.ordered !== ordered) {
        flushList();
        list = { ordered, items: [] };
      }
      list.items.push(bullet[2]);
      continue;
    }
    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  if (code) blocks.push({ kind: "pre", text: code.join("\n") });
  return blocks;
}

function renderBlock(block: Block, index: number) {
  if (block.kind === "heading") return <h4 key={index}>{renderInline(block.text)}</h4>;
  if (block.kind === "pre") return <pre key={index}>{block.text}</pre>;
  if (block.kind === "paragraph") return <p key={index}>{renderInline(block.text)}</p>;
  const Tag = block.ordered ? "ol" : "ul";
  return (
    <Tag key={index}>
      {block.items.map((item) => <li key={item}>{renderInline(item)}</li>)}
    </Tag>
  );
}

function renderInline(text: string) {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^)\s]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    if (match[2]) nodes.push(<strong key={`${match.index}-b`}>{match[2]}</strong>);
    if (match[3] && match[4]) {
      nodes.push(<a href={match[4]} key={`${match.index}-a`} target="_blank" rel="noreferrer">{match[3]}</a>);
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}
