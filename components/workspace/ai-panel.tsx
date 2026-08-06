"use client";

/**
 * components/workspace/ai-panel.tsx
 *
 * The Formix AI panel: a docked, resizable chat panel living alongside the
 * editor and preview — not a modal, not a bolted-on widget. Generates
 * Forml from a description, explains selected DSL, fixes compiler errors,
 * and suggests improvements to the form currently open in the editor.
 *
 * All "intelligence" comes from lib/ai-engine.ts + hooks/use-ai-chat.ts;
 * this component only renders state and wires user actions to them.
 */

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Bug, Check, Lightbulb, Sparkles, Square, Trash2, Wand2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/docs/code-block";
import { useAiChat, type AiChatMessage } from "@/hooks/use-ai-chat";
import { SUGGESTED_PROMPTS } from "@/lib/ai-engine";
import type { FormlCompileResult, FormlDiagnostic } from "@/lib/use-forml-compiler";

function autoGrow(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
}

function InlineMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => {
        if (line === "") return <div key={i} className="h-2" />;
        const isBullet = /^\s*-\s+/.test(line);
        const content = isBullet ? line.replace(/^\s*-\s+/, "") : line;
        const parts = content.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
        const rendered = parts.map((part, j) =>
          part.startsWith("**") && part.endsWith("**") ? (
            <strong key={j} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
          ) : (
            <span key={j}>{part}</span>
          ),
        );
        if (isBullet) {
          return (
            <div key={i} className="flex items-start gap-2 pl-0.5">
              <span className="mt-1.5 h-1 w-1 flex-none rounded-full bg-accent/70" />
              <p className="flex-1">{rendered}</p>
            </div>
          );
        }
        return <p key={i}>{rendered}</p>;
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

function ChatBubble({
  msg,
  applied,
  onApply,
}: {
  msg: AiChatMessage;
  applied: boolean;
  onApply: (id: string, code: string) => void;
}) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-accent/15 px-3.5 py-2.5 font-inter text-sm text-foreground">
          {msg.text}
        </div>
      </div>
    );
  }

  // The code panel appears as soon as its own stream phase starts (formlCode
  // becomes a string, even "") and grows with it — same progressive reveal
  // as the reply text above it, instead of popping in fully formed. The line
  // count + apply button only show once the code has finished streaming.
  const hasCode = msg.formlCode !== undefined;
  const codeComplete = hasCode && !msg.streaming;
  const textDone = msg.text.length > 0 || !msg.streaming;

  return (
    <div className="flex items-start gap-2.5">
      <div className="gradient-accent mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full">
        <Sparkles className="h-3 w-3 text-white" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="glass-panel rounded-2xl rounded-tl-sm px-3.5 py-2.5 font-inter text-sm leading-relaxed text-foreground/90">
          {msg.text.length === 0 && msg.streaming && !hasCode ? (
            <ThinkingDots />
          ) : (
            <>
              <InlineMarkdown text={msg.text} />
              {msg.streaming && !hasCode && (
                <span className="ml-0.5 inline-block h-3.5 w-[3px] animate-pulse bg-accent/70 align-middle" />
              )}
            </>
          )}
        </div>

        {hasCode && textDone && (
          <div className="overflow-hidden rounded-xl border border-accent/20">
            <CodeBlock code={msg.formlCode!} language="forml" filename="generated.forml" showLineNumbers={false} />
            {codeComplete ? (
              <div className="flex items-center justify-between border-t border-accent/20 bg-accent/[0.06] px-3.5 py-2">
                <span className="font-mono text-[11px] text-muted-foreground">
                  {msg.formlCode!.split("\n").length} lines
                </span>
                <Button size="sm" variant={applied ? "outline" : "default"} onClick={() => onApply(msg.id, msg.formlCode!)}>
                  {applied ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Applied
                    </>
                  ) : (
                    msg.applyLabel ?? "Insert into Editor"
                  )}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 border-t border-accent/20 bg-accent/[0.06] px-3.5 py-2 font-mono text-[11px] text-muted-foreground">
                <span className="h-1 w-1 animate-pulse rounded-full bg-accent/70" />
                writing…
              </div>
            )}
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
      className={`flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 font-inter text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        highlight
          ? "border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10"
          : "border-border bg-transparent text-muted-foreground hover:border-accent/30 hover:text-foreground"
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
  /** The WASM compiler — the compile-and-repair loop runs LLM output through
   *  it so generated forms are verified against the real grammar. */
  compile: (src: string) => FormlCompileResult;
  onApplyToEditor: (code: string) => void;
  onClose: () => void;
}) {
  const { messages, isStreaming, send, runQuickAction, stop, clear } = useAiChat(
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
    <div className="flex h-full min-h-0 flex-col border-l border-border bg-card">
      {/* Header */}
      <div className="flex h-9 flex-none items-center gap-2 border-b border-border px-3">
        <div className="gradient-accent flex h-5 w-5 items-center justify-center rounded-md">
          <Sparkles className="h-3 w-3 text-white" />
        </div>
        <span className="font-inter text-xs font-semibold text-foreground">Formix AI</span>
        {isStreaming && <span className="font-mono text-[10px] text-muted-foreground">generating…</span>}
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onClick={clear}
            disabled={messages.length === 0}
            title="Clear chat"
            aria-label="Clear chat"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close panel"
            aria-label="Close AI panel"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-none items-center gap-1.5 overflow-x-auto border-b border-border px-3 py-2">
        <QuickAction icon={Wand2} label="Improve Form" disabled={!formId || isStreaming} onClick={() => runQuickAction("improve", "Improve this form")} />
        <QuickAction icon={Bug} label="Fix Errors" highlight={hasErrors} disabled={!formId || isStreaming} onClick={() => runQuickAction("fix", "Fix the compiler errors in my form")} />
        <QuickAction
          icon={Lightbulb}
          label={selection.trim() ? "Explain Selection" : "Explain Form"}
          disabled={!formId || isStreaming}
          onClick={() => runQuickAction("explain", selection.trim() ? "Explain the selected code" : "Explain this form")}
        />
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="formix-scroll min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {!formId ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="font-inter text-sm text-foreground">Select a form to start</p>
            <p className="max-w-[220px] font-mono text-xs text-muted-foreground">Formix AI works alongside the form you're editing.</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-5 px-2 text-center">
            <div className="gradient-accent shadow-elevated flex h-12 w-12 items-center justify-center rounded-2xl">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-inter text-base font-semibold text-foreground">Formix AI</p>
              <p className="mt-1.5 max-w-[260px] font-inter text-sm text-muted-foreground">
                Describe the form you want and I'll write the Forml for you — or ask me to explain, fix, or improve what's already in the editor.
              </p>
            </div>
            <div className="flex w-full max-w-[320px] flex-col gap-2">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => submit(p)}
                  className="glass-panel ease-signature rounded-xl px-3.5 py-2.5 text-left font-inter text-xs text-foreground/80 transition-colors hover:border-accent/30 hover:text-foreground"
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
        className="flex flex-none flex-col gap-1.5 border-t border-border p-3"
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
            placeholder="Describe your form..."
            disabled={!formId}
            className="formix-scroll max-h-[140px] flex-1 resize-none rounded-xl border border-border bg-background/60 px-3 py-2.5 font-inter text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-ring focus:ring-2 focus:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-50"
          />
          {isStreaming ? (
            <Button type="button" variant="outline" size="icon" onClick={stop} aria-label="Stop generating" title="Stop generating">
              <Square className="h-3.5 w-3.5 fill-current" />
            </Button>
          ) : messages.length === 0 ? (
            <Button type="submit" size="sm" disabled={!formId || !input.trim()} className="gap-1.5 whitespace-nowrap">
              <Sparkles className="h-3.5 w-3.5" /> Generate Form
            </Button>
          ) : (
            <Button type="submit" size="icon" disabled={!formId || !input.trim()} aria-label="Send message" title="Send">
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="font-mono text-[10px] text-muted-foreground/60">Enter to send · Shift+Enter for a new line</p>
      </form>
    </div>
  );
}
