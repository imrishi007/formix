"use client";

import { useMemo, useState, type ElementType, type ReactNode } from "react";
import { Check, Copy, ExternalLink, Image as ImageIcon } from "lucide-react";

type InlineNode = { type: "text" | "strong" | "em" | "code" | "link"; value: string; href?: string };

function inlineMarkdown(value: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|!?\[[^\]]*\]\([^)]*\))/g;
  let cursor = 0;
  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) nodes.push({ type: "text", value: value.slice(cursor, index) });
    const token = match[0];
    if (token.startsWith("!") || token.startsWith("[")) {
      const image = token.match(/^!?\[([^\]]*)\]\(([^)]+)\)$/);
      if (image) nodes.push({ type: "link", value: image[1], href: image[2] });
    } else if (token.startsWith("`")) nodes.push({ type: "code", value: token.slice(1, -1) });
    else if (token.startsWith("**") || token.startsWith("__")) nodes.push({ type: "strong", value: token.slice(2, -2) });
    else nodes.push({ type: "em", value: token.slice(1, -1) });
    cursor = index + token.length;
  }
  if (cursor < value.length) nodes.push({ type: "text", value: value.slice(cursor) });
  return nodes;
}

function Inline({ value }: { value: string }) {
  return <>{inlineMarkdown(value).map((node, index) => {
    if (node.type === "strong") return <strong key={index} className="font-semibold text-white">{node.value}</strong>;
    if (node.type === "em") return <em key={index} className="text-[#D4D4D8]">{node.value}</em>;
    if (node.type === "code") return <code key={index} className="rounded-md bg-white/[0.08] px-1.5 py-0.5 font-mono text-[0.88em] text-[#C4B5FD]">{node.value}</code>;
    if (node.type === "link") return <a key={index} href={node.href} target="_blank" rel="noreferrer" className="text-[#A78BFA] underline decoration-[#8B5CF6]/40 underline-offset-4 hover:text-white">{node.value || node.href}</a>;
    return <span key={index}>{node.value}</span>;
  })}</>;
}

function highlightCode(code: string, language: string): ReactNode[] {
  const escaped = code;
  const pattern = /(\/\/.*|#.*|--.*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b\d+(?:\.\d+)?\b|\b(?:const|let|var|function|return|if|else|for|while|true|false|null|undefined|class|import|from|export|async|await|def|print|SELECT|FROM|WHERE)\b)/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const match of escaped.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) nodes.push(escaped.slice(cursor, index));
    const token = match[0];
    const className = /^(\/\/|#|--)/.test(token)
      ? "text-[#71717A]"
      : /^['"]/.test(token)
        ? "text-[#A5D6A7]"
        : /^\d/.test(token)
          ? "text-[#F9C978]"
          : "text-[#C4B5FD]";
    nodes.push(<span key={`${language}-${index}`} className={className}>{token}</span>);
    cursor = index + token.length;
  }
  if (cursor < escaped.length) nodes.push(escaped.slice(cursor));
  return nodes;
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  };
  return (
    <div className="my-6 overflow-hidden rounded-xl border border-white/[0.09] bg-[#111111] shadow-[0_12px_28px_rgba(0,0,0,0.22)]">
      <div className="flex h-9 items-center justify-between border-b border-white/[0.07] bg-white/[0.03] px-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#71717A]">{language || "code"}</span>
        <button type="button" onClick={copy} className="flex items-center gap-1.5 rounded-md px-2 py-1 font-inter text-[10px] text-[#A1A1AA] transition-colors hover:bg-white/[0.08] hover:text-white">
          {copied ? <Check className="h-3 w-3 text-[#22C55E]" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="formix-scroll overflow-auto px-5 py-4 font-mono text-[13px] leading-6 text-[#D4D4D8]"><code>{highlightCode(code, language)}</code></pre>
    </div>
  );
}

function isTableSeparator(line: string) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function cells(line: string) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function MarkdownDocument({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(<p key={`p-${index}`} className="my-4 leading-7 text-[#A1A1AA]"><Inline value={paragraph.join(" ")} /></p>);
    paragraph = [];
  };

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { flushParagraph(); index += 1; continue; }

    if (line.startsWith("```") || line.startsWith("~~~")) {
      flushParagraph();
      const fence = line.slice(0, 3);
      const language = line.slice(3).trim();
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith(fence)) { code.push(lines[index]); index += 1; }
      blocks.push(<CodeBlock key={`code-${index}`} code={code.join("\n")} language={language} />);
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      const Tag = `h${level}` as ElementType;
      const sizes = ["text-3xl", "text-2xl", "text-xl", "text-lg", "text-base", "text-sm"];
      blocks.push(<Tag key={`h-${index}`} className={`mt-8 mb-3 font-semibold tracking-tight text-white ${sizes[level - 1]}`}><Inline value={heading[2]} /></Tag>);
      index += 1;
      continue;
    }

    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) {
      flushParagraph(); blocks.push(<hr key={`hr-${index}`} className="my-8 border-white/[0.09]" />); index += 1; continue;
    }

    if (line.trimStart().startsWith(">")) {
      flushParagraph();
      const quote: string[] = [];
      while (index < lines.length && lines[index].trimStart().startsWith(">")) { quote.push(lines[index].trimStart().replace(/^>\s?/, "")); index += 1; }
      blocks.push(<blockquote key={`quote-${index}`} className="my-5 border-l-2 border-[#8B5CF6] bg-[#8B5CF6]/[0.06] px-5 py-3 text-[#A1A1AA]"><Inline value={quote.join(" ")} /></blockquote>);
      continue;
    }

    if (index + 1 < lines.length && line.includes("|") && isTableSeparator(lines[index + 1])) {
      flushParagraph();
      const header = cells(line); index += 2; const rows: string[][] = [];
      while (index < lines.length && lines[index].includes("|")) { rows.push(cells(lines[index])); index += 1; }
      blocks.push(<div key={`table-${index}`} className="my-6 overflow-x-auto rounded-xl border border-white/[0.09]"><table className="w-full min-w-[420px] border-collapse text-left text-sm"><thead className="bg-white/[0.05]"><tr>{header.map((cell, i) => <th key={i} className="border-b border-white/[0.08] px-4 py-3 font-inter font-semibold text-white"><Inline value={cell} /></th>)}</tr></thead><tbody>{rows.map((row, ri) => <tr key={ri} className="border-b border-white/[0.06] last:border-0 hover:bg-white/[0.03]">{header.map((_, ci) => <td key={ci} className="px-4 py-3 text-[#A1A1AA]"><Inline value={row[ci] ?? ""} /></td>)}</tr>)}</tbody></table></div>);
      continue;
    }

    const list = line.match(/^(\s*)([-*+] |\d+\. )(.+)$/);
    if (list) {
      flushParagraph(); const ordered = /\d+\./.test(list[2]); const items: string[] = [];
      while (index < lines.length) { const item = lines[index].match(/^(\s*)([-*+] |\d+\. )(.+)$/); if (!item) break; items.push(item[3]); index += 1; }
      const List = ordered ? "ol" : "ul";
      blocks.push(<List key={`list-${index}`} className={`${ordered ? "list-decimal" : "list-disc"} my-4 space-y-2 pl-6 text-[#A1A1AA]`}>{items.map((item, i) => { const task = item.match(/^\[([ xX])\]\s+(.*)$/); return <li key={i} className="pl-1 leading-7">{task ? <span className="inline-flex items-center gap-2"><span className={`flex h-4 w-4 items-center justify-center rounded border ${task[1].toLowerCase() === "x" ? "border-[#8B5CF6] bg-[#8B5CF6] text-white" : "border-white/20"}`}>{task[1].toLowerCase() === "x" && <Check className="h-3 w-3" />}</span><Inline value={task[2]} /></span> : <Inline value={item} />}</li>; })}</List>);
      continue;
    }

    const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) { flushParagraph(); blocks.push(<figure key={`img-${index}`} className="my-6 overflow-hidden rounded-xl border border-white/[0.09] bg-white/[0.03]"><img src={image[2]} alt={image[1]} className="max-h-[420px] w-full object-contain" /><figcaption className="flex items-center gap-2 px-4 py-3 text-xs text-[#71717A]"><ImageIcon className="h-3.5 w-3.5" />{image[1]}</figcaption></figure>); index += 1; continue; }

    paragraph.push(line.trim()); index += 1;
  }
  flushParagraph();
  return <>{blocks}</>;
}

export function MarkdownPreview({ source }: { source: string }) {
  const wordCount = useMemo(() => source.trim() ? source.trim().split(/\s+/).length : 0, [source]);
  return (
    <div className="formix-scroll h-full min-h-0 overflow-auto bg-[#111111]">
      <div className="mx-auto min-h-full w-full max-w-3xl px-8 py-10 lg:px-14 lg:py-12">
        <div className="mb-8 flex items-center justify-between border-b border-white/[0.08] pb-5">
          <div><p className="font-inter text-[11px] font-semibold uppercase tracking-[0.16em] text-[#A78BFA]">Markdown Preview</p><p className="mt-1 font-inter text-xs text-[#71717A]">GitHub Flavored Markdown · {wordCount} words</p></div>
          <ExternalLink className="h-4 w-4 text-[#52525B]" />
        </div>
        <article className="font-inter text-[15px] leading-7"><MarkdownDocument source={source || "Start writing Markdown to see a live preview."} /></article>
      </div>
    </div>
  );
}
