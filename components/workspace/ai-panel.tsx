"use client";

/**
 * components/workspace/ai-panel.tsx
 *
 * The Formix AI panel: a docked, resizable chat panel living alongside the
 * editor and preview — not a modal, not a bolted-on widget. Every turn goes
 * to the LLM-backed chat endpoint (backend/routers/ai.py) through
 * hooks/use-ai-chat.ts, which streams the explanation, compiles the model's
 * revised source with the WASM compiler, and runs the compile-and-repair loop.
 *
 * This component only renders state and wires user actions to the hook:
 *   - streamed explanation bubbles
 *   - per-turn "View diff" toggle (old source → revised source, line diff)
 *   - "Apply changes" only after a clean compile; failed turns show the
 *     compiler errors and the broken source, never an Apply button
 */

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Bug, Check, Diff, Lightbulb, Sparkles, Square, Trash2, Wand2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/code-block";
import { useAiChat, type AiChatMessage } from "@/hooks/use-ai-chat";
import { PANEL_PROMPTS } from "@/lib/ai-engine";
import { diffLines, diffStats, hasChanges, type DiffLine } from "@/lib/forml-diff";
import type { FormlCompileResult, FormlDiagnostic } from "@/lib/use-forml-compiler";

function autoGrow(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
}

/** Normalize a model-supplied fence language to the CodeBlock's supported set
 *  (unknown tags default to "forml" — the model's most common example language). */
type CodeBlockLanguage = "forml" | "ebnf" | "json" | "tsx" | "bash" | "text";

function toCodeBlockLanguage(lang: string | undefined): CodeBlockLanguage {
  const normalized = (lang ?? "").trim().toLowerCase();
  if (normalized === "ebnf") return "ebnf";
  if (normalized === "json") return "json";
  if (normalized === "tsx" || normalized === "typescript") return "tsx";
  if (normalized === "bash" || normalized === "sh" || normalized === "shell") return "bash";
  if (normalized === "text") return "text";
  return "forml";
}

/** Minimal inline markdown renderer for assistant replies. Handles the bits the
 *  model actually uses: fenced code blocks, lists, inline code, **bold**, and
 *  `*italic*`. Everything else falls through as plain text. */
function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split("```");
  return (
    <div className="space-y-1.5">
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          // Odd slices are inside a fenced code block; strip the language tag.
          const [lang, ...rest] = part.split("\n");
          const code = rest.join("\n").replace(/\n$/, "");
          return (
            <CodeBlock key={i} code={code} language={toCodeBlockLanguage(lang)} filename="example" showLineNumbers={false} />
          );
        }
        return <MarkdownParagraph key={i} text={part} />;
      })}
    </div>
  );
}

/** One non-code paragraph: resolves **bold**, *italic*, `inline code`, and
 *  bullet/numbered list lines. */
function MarkdownParagraph({ text }: { text: string }) {
  const lines = text.split("\n").filter((l) => l.trim() !== "");
  return (
    <>
      {lines.map((line, i) => {
        const bullet = /^\s*[-*]\s+/.exec(line);
        const numbered = /^\s*(\d+)[.)]\s+/.exec(line);
        if (bullet) return <ListLine key={i} text={line.slice(bullet[0].length)} marker="•" />;
        if (numbered) return <ListLine key={i} text={line.slice(numbered[0].length)} marker={`${numbered[1]}.`} />;
        return (
          <p key={i} className="text-sm leading-relaxed">
            <RichText text={line} />
          </p>
        );
      })}
    </>
  );
}

function ListLine({ text, marker }: { text: string; marker: string }) {
  return (
    <div className="flex items-start gap-2 pl-0.5">
      <span className="mt-1.5 flex-none font-medium text-accent-foreground/60">{marker}</span>
      <p className="flex-1 text-sm leading-relaxed">
        <RichText text={text} />
      </p>
    </div>
  );
}

/** Splits on **bold**, *italic*, and `code` tokens and renders them. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, j) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={j} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("*") && part.endsWith("*")) {
          return <em key={j} className="text-foreground/80">{part.slice(1, -1)}</em>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code key={j} className="rounded bg-muted/60 px-1 py-0.5 font-mono text-[0.85em] text-foreground/90">
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={j}>{part}</span>;
      })}
    </>
  );
}

function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60"
          style={{ animation: "ast-status-blink 1s ease-in-out infinite", animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

/**
 * Unified-style line diff between an assistant turn's baseline and its revised
 * source. Added lines tinted with the app's success token, removed lines with
 * the danger token, unchanged plain — the accent tokens follow the app theme,
 * so the diff reads in whichever syntax theme the user is in.
 */
function DiffView({ lines }: { lines: DiffLine[] }) {
  return (
    <pre className="formix-scroll max-h-80 overflow-auto rounded-lg border border-(--border-hairline) bg-(--bg-subtle) px-1 py-2 font-mono text-xs leading-5">
      {lines.map((line, i) => (
        <div
          key={i}
          className={`flex whitespace-pre ${
            line.type === "add"
              ? "bg-(--accent-success)/10 text-(--accent-success)"
              : line.type === "remove"
                ? "bg-(--accent-danger)/10 text-(--accent-danger)/80"
                : "text-(--ink-secondary)"
          }`}
        >
          <span className="w-7 flex-none select-none pr-2 text-right text-(--ink-tertiary)/50">
            {line.oldLine ?? " "}
          </span>
          <span className="w-7 flex-none select-none pr-2 text-right text-(--ink-tertiary)/50">
            {line.newLine ?? " "}
          </span>
          <span className="w-4 flex-none select-none text-center">
            {line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
          </span>
          <span className="min-w-0 flex-1 break-all">{line.content || " "}</span>
        </div>
      ))}
    </pre>
  );
}

function ChatBubble({
  msg,
  applied,
  onApply,
}: {
  msg: AiChatMessage;
  applied: boolean;
  onApply: (id: string, code: string) => void;
}) {
  const [showDiff, setShowDiff] = useState(false);

  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-(--accent-primary)/15 px-3.5 py-2.5 text-sm text-(--ink-primary)">
          {msg.text}
        </div>
      </div>
    );
  }

  const hasCode = msg.formlCode !== undefined;
  const codeComplete = hasCode && !msg.streaming;
  const changed =
    hasCode && msg.baseline !== undefined && hasChanges(msg.baseline, msg.formlCode!);
  const diff = changed && showDiff ? diffLines(msg.baseline!, msg.formlCode!) : null;
  const stats = changed ? diffStats(msg.baseline!, msg.formlCode!) : null;

  return (
    <div className="flex items-start gap-2.5">
      <div className="gradient-accent mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full">
        <Sparkles className="h-3 w-3 text-white" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="glass-panel rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm leading-relaxed text-(--ink-primary)/90">
          {msg.text.length === 0 && msg.streaming ? (
            <ThinkingDots />
          ) : (
            <>
              <InlineMarkdown text={msg.text} />
              {msg.streaming && (
                <span className="ml-0.5 inline-block h-3.5 w-[3px] animate-pulse bg-(--accent-primary)/70 align-middle" />
              )}
            </>
          )}
        </div>

        {/* Failed turn — show why, never an Apply button. */}
        {msg.failed && (
          <div className="space-y-2 rounded-xl border border-(--accent-danger)/25 bg-(--accent-danger)/[0.06] px-3.5 py-2.5">
            <p className="text-xs font-medium text-(--accent-danger)">{msg.errorMessage}</p>
            {msg.errorDiagnostics && msg.errorDiagnostics.length > 0 && (
              <ul className="space-y-0.5 font-mono text-[11px] text-(--accent-danger)/80">
                {msg.errorDiagnostics.map((d, i) => (
                  <li key={i}>
                    L{d.line}:C{d.col} {d.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {hasCode && codeComplete && !msg.failed && (
          <div className="overflow-hidden rounded-xl border border-(--accent-primary)/20">
            {changed ? (
              <>
                <div className="flex items-center justify-between border-b border-(--accent-primary)/20 bg-(--accent-primary)/[0.06] px-3.5 py-2">
                  <button
                    type="button"
                    onClick={() => setShowDiff((v) => !v)}
                    className="flex items-center gap-1.5 text-xs font-medium text-(--ink-tertiary) transition-colors hover:text-(--ink-primary)"
                  >
                    <Diff className="h-3.5 w-3.5" />
                    {showDiff ? "Hide diff" : "View diff"}
                    {stats && (
                      <span className="flex items-center gap-1">
                        <span className="text-(--accent-success)">+{stats.added}</span>
                        <span className="text-(--accent-danger)">−{stats.removed}</span>
                      </span>
                    )}
                  </button>
                  <span className="text-xs text-(--ink-tertiary)">
                    {msg.formlCode!.split("\n").length} lines
                  </span>
                </div>
                {showDiff ? (
                  <div className="p-2">
                    <DiffView lines={diff!} />
                  </div>
                ) : (
                  <CodeBlock code={msg.formlCode!} language="forml" filename="generated.forml" showLineNumbers={false} />
                )}
              </>
            ) : (
              <CodeBlock code={msg.formlCode!} language="forml" filename="generated.forml" showLineNumbers={false} />
            )}

            <div className="flex items-center justify-between border-t border-(--accent-primary)/20 bg-(--accent-primary)/[0.06] px-3.5 py-2">
              <span className="text-xs text-(--ink-tertiary)">
                {changed
                  ? msg.formlCode!.split("\n").length
                  : "No source changes in this reply."}
              </span>
              {changed ? (
                <Button size="sm" variant={applied ? "outline" : "default"} onClick={() => onApply(msg.id, msg.formlCode!)}>
              {applied ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Applied
                </>
              ) : (
                "Insert into Editor"
              )}
                </Button>
              ) : (
                <span className="text-xs text-(--ink-tertiary)">Nothing to apply</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
  disabled,
  highlight,
}: {
  icon: typeof Wand2;
  label: string;
  onClick: () => void;
  disabled: boolean;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        highlight
          ? "border-(--accent-danger)/30 bg-(--accent-danger)/5 text-(--accent-danger) hover:bg-(--accent-danger)/10"
          : "border-(--border-hairline) bg-transparent text-(--ink-tertiary) hover:border-(--accent-primary)/30 hover:text-(--ink-primary)"
      }`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

export function AiPanel({
  formId,
  source,
  diagnostics,
  selection,
  compile,
  onApplyToEditor,
  onClose,
}: {
  formId: string | null;
  source: string;
  diagnostics: FormlDiagnostic[];
  selection: string;
  /** The WASM compiler — the compile-and-repair loop runs it client-side. */
  compile: (src: string) => FormlCompileResult;
  onApplyToEditor: (code: string) => void;
  onClose: () => void;
}) {
  const { messages, isStreaming, send, stop, clear } = useAiChat(
    formId,
    () => ({ source, diagnostics, selection }),
    compile,
  );

  const [input, setInput] = useState("");
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setAppliedIds(new Set()), [formId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const hasErrors = diagnostics.some((d) => d.severity === "error");
  const disabled = !formId || isStreaming;

  const handleApply = (id: string, code: string) => {
    onApplyToEditor(code);
    setAppliedIds((prev) => new Set(prev).add(id));
  };

  const submit = (text: string) => {
    if (!text.trim() || disabled) return;
    send(text);
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";
  };

  return (
    <div className="glass-panel !bg-(--bg-surface-glass) flex h-full min-h-0 flex-col border-l border-(--border-hairline)">
      {/* Header */}
      <div className="flex h-9 flex-none items-center gap-2 border-b border-(--border-hairline) px-3">
        <div className="gradient-accent flex h-5 w-5 items-center justify-center rounded-md">
          <Sparkles className="h-3 w-3 text-white" />
        </div>
        <span className="text-xs font-semibold text-(--ink-primary)">Formix AI</span>
        {isStreaming && <span className="text-xs text-(--ink-tertiary)">generating…</span>}
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onClick={clear}
            disabled={messages.length === 0}
            title="Clear chat"
            aria-label="Clear chat"
            className="flex h-7 w-7 items-center justify-center rounded-md text-(--ink-tertiary) transition-colors hover:text-(--ink-primary) disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close panel"
            aria-label="Close AI panel"
            className="flex h-7 w-7 items-center justify-center rounded-md text-(--ink-tertiary) transition-colors hover:text-(--ink-primary)"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-none items-center gap-1.5 overflow-x-auto border-b border-(--border-hairline) px-3 py-2">
        <QuickAction icon={Wand2} label="Improve Form" disabled={disabled} onClick={() => submit("Improve this form")} />
        <QuickAction icon={Bug} label="Fix Errors" highlight={hasErrors} disabled={disabled} onClick={() => submit("Fix the compiler errors in my form")} />
        <QuickAction
          icon={Lightbulb}
          label={selection.trim() ? "Explain Selection" : "Explain Form"}
          disabled={disabled}
          onClick={() => submit(selection.trim() ? "Explain the selected code" : "Explain this form")}
        />
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="formix-scroll min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {!formId ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-(--border-hairline) bg-(--bg-subtle)">
              <Sparkles className="h-4 w-4 text-(--ink-tertiary)" />
            </div>
            <p className="text-sm text-(--ink-primary)">Select a form to start</p>
            <p className="max-w-[220px] text-xs text-(--ink-tertiary)">Formix AI works alongside the form you&apos;re editing.</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-5 px-2 text-center">
            <div className="gradient-accent shadow-elevated flex h-12 w-12 items-center justify-center rounded-2xl">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-base font-semibold text-(--ink-primary)">Formix AI</p>
              <p className="mt-1.5 max-w-[260px] text-sm text-(--ink-secondary)">
                Ask me anything about Forml — questions, doubts, or ideas — or tell me to build, fix, or improve the form in your editor.
              </p>
            </div>
            <div className="flex w-full max-w-[320px] flex-col gap-2">
              {PANEL_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => submit(p)}
                  className="glass-panel rounded-xl px-3.5 py-2.5 text-left text-xs text-(--ink-primary)/80 transition-colors hover:border-(--accent-primary)/30 hover:text-(--ink-primary)"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m) => (
              <ChatBubble key={m.id} msg={m} applied={appliedIds.has(m.id)} onApply={handleApply} />
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="flex flex-none flex-col gap-1.5 border-t border-(--border-hairline) p-3"
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={taRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              autoGrow(e.target);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(input);
              }
            }}
            placeholder="Ask me anything about Forml..."
            disabled={!formId}
            className="formix-scroll max-h-[140px] flex-1 resize-none rounded-xl border border-(--border-hairline) bg-(--bg-surface)/60 px-3 py-2.5 text-sm text-(--ink-primary) outline-none transition-colors placeholder:text-(--ink-tertiary)/50 focus:border-(--accent-primary) focus:ring-2 focus:ring-(--accent-primary)/15 disabled:cursor-not-allowed disabled:opacity-50"
          />
          {isStreaming ? (
            <Button type="button" variant="outline" size="icon" onClick={stop} aria-label="Stop generating" title="Stop generating">
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!formId || !input.trim()} aria-label="Send message" title="Send">
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-(--ink-tertiary)/60">Enter to send · Shift+Enter for a new line</p>
      </form>
    </div>
  );
}
