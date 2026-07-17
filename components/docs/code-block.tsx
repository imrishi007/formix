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
}

// ── Token type ────────────────────────────────────────────────────────────────
type Token = { text: string; color: string };
const RESET = "rgba(212,212,212,0.9)";

// ── Forml tokenizer ──────────────────────────────────────────────────────────
function tokenizeFormlLine(line: string): Token[] {
  const keywords = new Set(["form","field","page","section","group","use","var","if","else","repeat","count","on","action","validate","compute","ui","from","map"]);
  const types    = new Set(["text","integer","float","email","date","boolean","url","select","radio","checkbox","POST","PUT","PATCH"]);
  const attrs    = new Set(["required","min","max","minLength","maxLength","pattern","label","placeholder","helpText","default","bind","endpoint","method","option","load","change","blur","submit","hide","show","clear","set","navigate"]);

  const tokens: Token[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === "/" && line[i + 1] === "/") {
      tokens.push({ text: line.slice(i), color: "#6a9955" }); break;
    }
    if (line[i] === '"') {
      let j = i + 1;
      while (j < line.length && line[j] !== '"') j++;
      tokens.push({ text: line.slice(i, j + 1), color: "#ce9178" });
      i = j + 1; continue;
    }
    if (/[a-zA-Z_]/.test(line[i])) {
      let j = i + 1;
      while (j < line.length && /[a-zA-Z0-9_]/.test(line[j])) j++;
      const word = line.slice(i, j);
      let color = RESET;
      if (keywords.has(word)) color = "#569cd6";
      else if (types.has(word)) color = "#4ec9b0";
      else if (attrs.has(word)) color = "#9cdcfe";
      tokens.push({ text: word, color }); i = j; continue;
    }
    if (/[0-9]/.test(line[i])) {
      let j = i + 1;
      while (j < line.length && /[0-9.]/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), color: "#b5cea8" }); i = j; continue;
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
      tokens.push({ text: line.slice(i, j), color: "#6a9955" }); i = j; continue;
    }
    if (line[i] === '"' || line[i] === "'") {
      const q = line[i]; let j = i + 1;
      while (j < line.length && line[j] !== q) j++;
      tokens.push({ text: line.slice(i, j + 1), color: "#ce9178" }); i = j + 1; continue;
    }
    if (/[A-Z]/.test(line[i])) {
      let j = i + 1;
      while (j < line.length && /[A-Z0-9_]/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), color: "#4fc1ff" }); i = j; continue;
    }
    if (/[a-z]/.test(line[i])) {
      let j = i + 1;
      while (j < line.length && /[a-z_0-9]/.test(line[j])) j++;
      const word = line.slice(i, j);
      tokens.push({ text: word, color: word === ruleStart ? "#dcdcaa" : "#9cdcfe" }); i = j; continue;
    }
    if (["|", ";", "=", "[", "]", "{", "}"].includes(line[i])) {
      tokens.push({ text: line[i], color: "#c586c0" }); i++; continue;
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
      tokens.push({ text: raw, color: after.startsWith(":") ? "#9cdcfe" : "#ce9178" });
      i = j + 1; continue;
    }
    if (/[a-z]/.test(line[i])) {
      let j = i + 1;
      while (j < line.length && /[a-z]/.test(line[j])) j++;
      const word = line.slice(i, j);
      tokens.push({ text: word, color: ["true","false","null"].includes(word) ? "#569cd6" : RESET });
      i = j; continue;
    }
    if (/[0-9\-]/.test(line[i])) {
      let j = i + 1;
      while (j < line.length && /[0-9.eE\-]/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), color: "#b5cea8" }); i = j; continue;
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
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const lines = code.split("\n");

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative overflow-hidden border border-foreground/10 bg-[#1e1e1e] rounded-sm my-6">
      {/* Header */}
      {!hideHeader && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#161616] border-b border-foreground/10">
          <div className="flex items-center gap-3">
            {filename && (
              <span className="text-xs font-mono text-foreground/40">{filename}</span>
            )}
            {!filename && langLabel[language] && (
              <span className="text-[10px] font-mono uppercase tracking-widest text-foreground/30 px-1.5 py-0.5 border border-foreground/10">
                {langLabel[language]}
              </span>
            )}
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-[10px] font-mono text-foreground/30 hover:text-foreground/70 transition-colors"
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
      <div className="overflow-x-auto py-3">
        {lines.map((line, i) => {
          const lineNum = i + 1;
          const isHighlighted = highlightLines.includes(lineNum);
          const tokens = tokenizeLine(line, language);
          return (
            <div
              key={i}
              className={`flex min-h-[1.6rem] ${isHighlighted ? "bg-white/[0.04]" : ""}`}
            >
              {showLineNumbers && (
                <span
                  className="select-none shrink-0 w-12 text-right pr-4 pl-5 font-mono text-[11px]"
                  style={{ color: "rgba(255,255,255,0.18)", lineHeight: "1.6rem" }}
                >
                  {lineNum}
                </span>
              )}
              <span
                className={`pr-6 font-mono text-[12.5px] whitespace-pre ${!showLineNumbers ? "pl-4" : ""}`}
                style={{ lineHeight: "1.6rem" }}
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
