"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

type Language = "forml" | "ebnf" | "json" | "tsx" | "bash" | "text";

interface CodeBlockProps {
  code: string;
  language?: Language;
  filename?: string;
  showLineNumbers?: boolean;
  highlightLines?: number[];
  hideHeader?: boolean;
  /** Exact pixel line-height for every row (defaults to 1.6rem = 25.6px). */
  lineHeight?: number;
  /** Exact pixel font size for code text (defaults to 12.5px). */
  fontSize?: number;
  /** Render without the card chrome (border/bg/radius/margins) so an outer
      panel supplies the frame — used by the homepage MacBook mockup, which
      needs to control every pixel to exact-fit the code into its window. */
  bare?: boolean;
}

// ── Token type ────────────────────────────────────────────────────────────────
type Token = { text: string; color: string };
// Default ink follows the active theme's code canvas (design.md §Code Editor)
// so the same component renders correctly in both light and dark mode.
const RESET = "var(--code-text)";

// ── Forml tokenizer ──────────────────────────────────────────────────────────
function tokenizeFormlLine(line: string): Token[] {
  const keywords = new Set(["form","field","page","section","group","use","var","if","else","repeat","count","on","action","validate","compute","ui","from","map"]);
  const types    = new Set(["text","integer","float","email","date","boolean","url","select","radio","checkbox","file","image","pdf","document","POST","PUT","PATCH"]);
  const attrs    = new Set(["required","min","max","minLength","maxLength","pattern","accept","maxSize","multiple","label","placeholder","helpText","default","bind","endpoint","method","option","load","change","blur","submit","hide","show","clear","set","navigate"]);

  const tokens: Token[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === "/" && line[i + 1] === "/") {
      tokens.push({ text: line.slice(i), color: "var(--code-comment)" }); break;
    }
    if (line[i] === '"') {
      let j = i + 1;
      while (j < line.length && line[j] !== '"') j++;
      tokens.push({ text: line.slice(i, j + 1), color: "var(--code-string)" });
      i = j + 1; continue;
    }
    if (/[a-zA-Z_]/.test(line[i])) {
      let j = i + 1;
      while (j < line.length && /[a-zA-Z0-9_]/.test(line[j])) j++;
      const word = line.slice(i, j);
      let color = RESET;
      if (keywords.has(word)) color = "var(--code-keyword)";
      else if (types.has(word)) color = "var(--code-operator)";
      else if (attrs.has(word)) color = "var(--code-attr)";
      tokens.push({ text: word, color }); i = j; continue;
    }
    if (/[0-9]/.test(line[i])) {
      let j = i + 1;
      while (j < line.length && /[0-9.]/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), color: "var(--code-number)" }); i = j; continue;
    }
    tokens.push({ text: line[i], color: RESET }); i++;
  }
  return tokens;
}

// ── EBNF tokenizer ───────────────────────────────────────────────────────────
function tokenizeEbnfLine(line: string): Token[] {
  const tokens: Token[] = [];
  const ruleMatch = line.match(/^(\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*=)/);
  const ruleStart = ruleMatch ? ruleMatch[2] : null;
  let i = 0;
  while (i < line.length) {
    if (line[i] === "/" && line[i + 1] === "*") {
      const end = line.indexOf("*/", i + 2);
      const j = end === -1 ? line.length : end + 2;
      tokens.push({ text: line.slice(i, j), color: "var(--code-comment)" }); i = j; continue;
    }
    if (line[i] === '"' || line[i] === "'") {
      const q = line[i]; let j = i + 1;
      while (j < line.length && line[j] !== q) j++;
      tokens.push({ text: line.slice(i, j + 1), color: "var(--code-string)" }); i = j + 1; continue;
    }
    if (/[A-Z]/.test(line[i])) {
      let j = i + 1;
      while (j < line.length && /[A-Z0-9_]/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), color: "var(--code-operator)" }); i = j; continue;
    }
    if (/[a-z]/.test(line[i])) {
      let j = i + 1;
      while (j < line.length && /[a-z_0-9]/.test(line[j])) j++;
      const word = line.slice(i, j);
      tokens.push({ text: word, color: word === ruleStart ? "var(--code-attr)" : "var(--code-keyword)" }); i = j; continue;
    }
    if (["|", ";", "=", "[", "]", "{", "}"].includes(line[i])) {
      tokens.push({ text: line[i], color: "var(--code-keyword)" }); i++; continue;
    }
    tokens.push({ text: line[i], color: RESET }); i++;
  }
  return tokens;
}

// ── JSON tokenizer ───────────────────────────────────────────────────────────
function tokenizeJsonLine(line: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let j = i + 1;
      while (j < line.length && line[j] !== '"') j++;
      const raw   = line.slice(i, j + 1);
      const after = line.slice(j + 1).trimStart();
      tokens.push({ text: raw, color: after.startsWith(":") ? "var(--code-operator)" : "var(--code-string)" });
      i = j + 1; continue;
    }
    if (/[a-z]/.test(line[i])) {
      let j = i + 1;
      while (j < line.length && /[a-z]/.test(line[j])) j++;
      const word = line.slice(i, j);
      tokens.push({ text: word, color: ["true","false","null"].includes(word) ? "var(--code-keyword)" : RESET });
      i = j; continue;
    }
    if (/[0-9\-]/.test(line[i])) {
      let j = i + 1;
      while (j < line.length && /[0-9.eE\-]/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), color: "var(--code-number)" }); i = j; continue;
    }
    tokens.push({ text: line[i], color: RESET }); i++;
  }
  return tokens;
}

function tokenizeLine(line: string, lang: Language): Token[] {
  if (lang === "forml") return tokenizeFormlLine(line);
  if (lang === "ebnf")  return tokenizeEbnfLine(line);
  if (lang === "json")  return tokenizeJsonLine(line);
  return [{ text: line, color: RESET }];
}

const langLabel: Record<Language, string> = {
  forml: "Forml", ebnf: "EBNF", json: "JSON", tsx: "TSX", bash: "Bash", text: "",
};

// ── CodeBlock component ───────────────────────────────────────────────────────
export function CodeBlock({
  code,
  language = "text",
  filename,
  showLineNumbers = true,
  highlightLines = [],
  hideHeader = false,
  lineHeight,
  fontSize,
  bare = false,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const lines = code.split("\n");

  // Exact-fit mode: when the caller supplies lineHeight/fontSize (px), every
  // row is forced to exactly that height so the block can be sized precisely
  // into a fixed frame (the homepage MacBook mockup). Defaults mirror the
  // previous fixed 1.6rem/12.5px so every existing call site is untouched.
  const rowHeight = lineHeight ?? 25.6;
  const codeFont = fontSize ?? 12.5;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`relative overflow-hidden ${
        bare
          ? ""
          : "rounded-xl border border-(--border-hairline) bg-(--bg-base) my-6"
      }`}
    >
      {/* Header */}
      {!hideHeader && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-(--bg-subtle) border-b border-(--border-hairline)">
          <div className="flex items-center gap-3">
            {filename && (
              <span className="text-xs font-mono text-(--ink-tertiary)">{filename}</span>
            )}
            {!filename && langLabel[language] && (
              <span className="text-xs font-mono uppercase tracking-widest text-(--ink-tertiary) px-1.5 py-0.5 border border-(--border-hairline)">
                {langLabel[language]}
              </span>
            )}
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs font-mono text-(--ink-tertiary) hover:text-(--ink-primary) transition-colors"
            aria-label="Copy code"
          >
            {copied ? (
              <><Check className="w-3 h-3" /><span>Copied</span></>
            ) : (
              <><Copy className="w-3 h-3" /><span>Copy</span></>
            )}
          </button>
        </div>
      )}

      {/* Code lines */}
      <div className={bare ? "overflow-x-auto" : "overflow-x-auto py-3"}>
        {lines.map((line, i) => {
          const lineNum = i + 1;
          const isHighlighted = highlightLines.includes(lineNum);
          const tokens = tokenizeLine(line, language);
          return (
            <div
              key={i}
              className={`flex ${isHighlighted ? "bg-(--bg-subtle)/50" : ""}`}
              style={{ minHeight: `${rowHeight}px` }}
            >
              {showLineNumbers && (
                <span
                  className="select-none shrink-0 w-12 text-right pr-4 pl-5 font-mono text-[11px] text-(--ink-tertiary)"
                  style={{ lineHeight: `${rowHeight}px` }}
                >
                  {lineNum}
                </span>
              )}
              <span
                className={`pr-6 font-mono whitespace-pre ${!showLineNumbers ? "pl-4" : ""}`}
                style={{ lineHeight: `${rowHeight}px`, fontSize: `${codeFont}px` }}
              >
                {tokens.map((tok, ti) => (
                  <span key={ti} style={{ color: tok.color }}>
                    {tok.text}
                  </span>
                ))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
