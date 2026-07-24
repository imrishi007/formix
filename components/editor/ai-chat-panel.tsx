"use client";

import { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Send,
  Bot,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Code2,
  Copy,
  ChevronDown,
  ChevronUp,
  X,
  Zap,
  Wand2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { generateFormlCode, type ChatMessage } from "@/lib/api";
import type { FormlCompileResult } from "@/lib/use-forml-compiler";

interface AIChatPanelProps {
  currentCode: string;
  onApplyCode: (code: string) => void;
  compile: (code: string) => FormlCompileResult;
  onClose?: () => void;
}

interface DisplayMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  code?: string;
  isCompiling?: boolean;
  isValidated?: boolean;
  compileErrors?: string[];
  attemptsCount?: number;
}

const PROMPT_SUGGESTIONS = [
  "Build a job application form with name, email, role select, and experience",
  "Create a multi-page event registration form with tickets and payment",
  "Add conditional logic for users under 18 years old",
  "Create a feedback form with rating and repeat group for dynamic comments",
];

export function AIChatPanel({
  currentCode,
  onApplyCode,
  compile,
  onClose,
}: AIChatPanelProps) {
  const [inputPrompt, setInputPrompt] = useState("");
  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "👋 Hi! I am **Formix AI**, powered by Groq and armed with the full **FormL EBNF Grammar Specification**. Tell me what form you want to create or edit, and I will generate valid FormL code and place it directly into your editor!",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, statusText, loading]);

  const handleSend = async (userPromptText?: string) => {
    const promptToSubmit = (userPromptText || inputPrompt).trim();
    if (!promptToSubmit || loading) return;

    const userMsgId = `user-${Date.now()}`;
    const newUserMsg: DisplayMessage = {
      id: userMsgId,
      role: "user",
      text: promptToSubmit,
    };

    setMessages((prev) => [...prev, newUserMsg]);
    if (!userPromptText) setInputPrompt("");
    setLoading(true);

    // Build chat payload for API (exclude welcome message)
    const historyPayload: ChatMessage[] = messages
      .filter((m) => m.id !== "welcome" && (m.role === "user" || m.role === "assistant"))
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.text,
      }));

    historyPayload.push({ role: "user", content: promptToSubmit });

    let currentPromptCode = currentCode;
    let attempts = 0;
    const maxAttempts = 3;
    let finalReply = "";
    let finalCode: string | undefined = undefined;
    let isValidated = false;
    let lastErrors: string[] = [];

    try {
      while (attempts < maxAttempts) {
        attempts++;
        if (attempts === 1) {
          setStatusText("AI understanding prompt & generating FormL...");
        } else {
          setStatusText(`Syntax check failed. AI self-correcting (Attempt ${attempts}/${maxAttempts})...`);
        }

        const res = await generateFormlCode(historyPayload, currentPromptCode);
        finalReply = res.reply;
        finalCode = res.extracted_code;

        if (finalCode) {
          setStatusText("Verifying code against FormL WASM compiler...");
          // Validate code using the WASM compiler
          const compileResult = compile(finalCode);
          const errors = compileResult.diagnostics.filter(
            (d) => d.severity === "error"
          );

          if (compileResult.ok && errors.length === 0) {
            isValidated = true;
            lastErrors = [];
            break; // Success! Code is valid.
          } else {
            // Code has compiler errors -> Self correction step!
            lastErrors = errors.map(
              (e) => `Line ${e.line}, Col ${e.col}: ${e.message}`
            );
            // Update currentPromptCode context for next retry iteration
            currentPromptCode = finalCode;

            // Append error feedback message for the next iteration
            historyPayload.push({
              role: "assistant",
              content: finalReply,
            });
            historyPayload.push({
              role: "user",
              content: `The code you generated failed compilation with the following error(s):\n${lastErrors.join(
                "\n"
              )}\n\nPlease correct the syntax to strictly match the FormL EBNF grammar and return ONLY the updated code inside \`\`\`forml ... \`\`\`.`,
            });
          }
        } else {
          // No code block found in response, break and show text response
          break;
        }
      }

      // Automatically inject code into editor ONLY if compilation was validated
      if (finalCode && isValidated) {
        onApplyCode(finalCode);
      }

      const botMsgId = `bot-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: botMsgId,
          role: "assistant",
          text: finalReply,
          code: finalCode,
          isValidated,
          compileErrors: lastErrors,
          attemptsCount: attempts,
        },
      ]);
    } catch (err: any) {
      console.error("[Formix AI Chat] Error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          text: `⚠️ **Generation Error**: ${err.message || "Failed to reach AI service. Please check your backend connection or GROQ API key."}`,
        },
      ]);
    } finally {
      setLoading(false);
      setStatusText("");
    }
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Simple formatter to convert markdown bold and backticks into styled JSX
  const renderFormattedText = (content: string) => {
    const lines = content.split("\n");
    return lines.map((line, idx) => {
      // Split line by **bold** and `code` patterns
      const parts = line.split(/(\*\*.*?\*\*|`.*?`)/g);
      return (
        <p key={idx} className={idx > 0 ? "mt-1.5" : ""}>
          {parts.map((part, pIdx) => {
            if (part.startsWith("**") && part.endsWith("**")) {
              return (
                <strong key={pIdx} className="font-semibold text-white">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            if (part.startsWith("`") && part.endsWith("`")) {
              return (
                <code
                  key={pIdx}
                  className="rounded bg-white/[0.1] px-1 py-0.5 font-mono text-[11px] text-[#C4B5FD]"
                >
                  {part.slice(1, -1)}
                </code>
              );
            }
            return part;
          })}
        </p>
      );
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-white/[0.08] bg-[#161616] shadow-2xl overflow-hidden font-inter">
      {/* Header */}
      <div className="flex h-12 flex-none items-center justify-between border-b border-white/[0.08] bg-[#1C1C1C] px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 shadow-[0_0_12px_rgba(139,92,246,0.3)]">
            <Sparkles className="h-3.5 w-3.5 text-[#C4B5FD]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-inter text-[13px] font-semibold text-white">
                Formix AI
              </span>
              <span className="rounded bg-[#8B5CF6]/20 px-1.5 py-0.5 font-mono text-[9px] font-medium text-[#C4B5FD]">
                Groq EBNF
              </span>
            </div>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#71717A] hover:bg-white/[0.08] hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="formix-scroll min-h-0 flex-1 overflow-auto p-4 space-y-4">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`flex gap-3 ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {msg.role === "assistant" && (
              <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 text-[#C4B5FD] mt-0.5">
                <Bot className="h-3.5 w-3.5" />
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-[12px] leading-relaxed shadow-sm ${
                msg.role === "user"
                  ? "bg-[#8B5CF6] text-white font-medium rounded-tr-xs"
                  : "bg-[#222222] text-[#D4D4D8] border border-white/[0.06] rounded-tl-xs"
              }`}
            >
              <div className="font-sans">{renderFormattedText(msg.text)}</div>

              {/* Code Snippet & Validation Status */}
              {msg.code && (
                <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.1] bg-[#0F0F0F]">
                  <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#1A1A1A] px-3 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <Code2 className="h-3.5 w-3.5 text-[#8B5CF6]" />
                      <span className="font-mono text-[10px] text-[#A1A1AA]">
                        FormL Code
                      </span>
                      {msg.isValidated ? (
                        <span className="flex items-center gap-1 rounded bg-[#22C55E]/15 px-1.5 py-0.5 font-inter text-[9px] text-[#4ADE80]">
                          <CheckCircle2 className="h-3 w-3" /> Validated
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded bg-[#EF4444]/15 px-1.5 py-0.5 font-inter text-[9px] text-[#F87171]">
                          <AlertCircle className="h-3 w-3" /> Unverified Syntax
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => copyCode(msg.code!, msg.id)}
                        className="flex items-center gap-1 rounded px-2 py-1 font-inter text-[9px] text-[#A1A1AA] hover:bg-white/[0.08] hover:text-white transition-colors"
                      >
                        <Copy className="h-2.5 w-2.5" />
                        {copiedId === msg.id ? "Copied!" : "Copy"}
                      </button>
                      <button
                        type="button"
                        onClick={() => onApplyCode(msg.code!)}
                        className="flex items-center gap-1 rounded bg-[#8B5CF6] px-2 py-1 font-inter text-[9px] font-semibold text-white hover:bg-[#7C3AED] transition-colors shadow-sm"
                      >
                        <Wand2 className="h-2.5 w-2.5" />
                        Apply to Editor
                      </button>
                    </div>
                  </div>

                  <pre className="max-h-56 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-[#A78BFA] bg-[#0A0A0A]">
                    {msg.code}
                  </pre>
                </div>
              )}
            </div>

            {msg.role === "user" && (
              <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#333333] text-white mt-0.5">
                <User className="h-3.5 w-3.5" />
              </div>
            )}
          </motion.div>
        ))}

        {/* Loading Indicator with statusText */}
        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 text-[#A1A1AA]"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#8B5CF6]/15 border border-[#8B5CF6]/30 text-[#C4B5FD]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-[#222222] px-3.5 py-2 font-inter text-[11px] text-[#D4D4D8] flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#8B5CF6] animate-ping" />
              {statusText || "AI is thinking..."}
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Preset Suggestions */}
      {messages.length < 3 && !loading && (
        <div className="px-4 py-2 border-t border-white/[0.06] bg-[#191919]">
          <p className="mb-2 font-inter text-[10px] font-medium text-[#71717A]">
            Suggestions:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PROMPT_SUGGESTIONS.map((sug, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSend(sug)}
                className="rounded-lg border border-white/[0.08] bg-[#222222] px-2.5 py-1 text-left font-inter text-[10px] text-[#A1A1AA] hover:border-[#8B5CF6]/40 hover:bg-[#8B5CF6]/10 hover:text-white transition-all"
              >
                {sug}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Form */}
      <div className="border-t border-white/[0.08] bg-[#1C1C1C] p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            disabled={loading}
            placeholder="Describe form requirements or ask for edits..."
            className="min-w-0 flex-1 rounded-xl border border-white/[0.1] bg-[#111111] px-3.5 py-2.5 font-inter text-[12px] text-white outline-none placeholder:text-[#52525B] focus:border-[#8B5CF6] transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !inputPrompt.trim()}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-[#8B5CF6] text-white shadow-[0_4px_14px_rgba(139,92,246,0.3)] transition-all hover:bg-[#7C3AED] active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
