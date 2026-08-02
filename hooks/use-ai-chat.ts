// hooks/use-ai-chat.ts
//
// React state for the LLM-backed Formix AI panel.
//
// Replaces the old localStorage + rule-based engine hook:
//   - history is loaded from / persisted to the backend (GET/POST
//     /ai/forms/{id}/history & messages) so it survives reloads
//   - every turn runs through lib/ai-loop.ts's compile-and-repair loop: the
//     backend streams the explanation live, the client compiles the model's
//     revisedSource with the WASM compiler, and on failure the exact compiler
//     diagnostics are sent back for up to MAX_REPAIR_ATTEMPTS fixes
//   - each assistant message records its `baseline` (the source the model was
//     asked to edit) so the panel can render an old→new diff
//   - an unapplied AI revision stays as the "draft" baseline for the next
//     message ("now add a phone field" edits the previous result), exactly
//     like the old hook did — a real editor change clears the draft

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  appendAiMessage,
  chatAiStream,
  clearAiHistory,
  getAiHistory,
  type AiHistoryMessageInput,
} from "@/lib/api";
import { AiTurnError, runRepairLoop, type RepairOutcome } from "@/lib/ai-loop";
import type { FormlCompileResult, FormlDiagnostic } from "@/lib/use-forml-compiler";
import type { AiContext } from "@/lib/ai-engine";

export interface AiChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** The full revised .forml source this assistant turn produced (set once the
   *  repair loop resolves). Absent when the turn produced no code. */
  formlCode?: string;
  /** The source the model was asked to edit — the diff's "old" side. */
  baseline?: string;
  /** True while the turn is running (streaming explanation / compiling /
   *  repairing). */
  streaming?: boolean;
  /** True when the turn ended without an applicable source. */
  failed?: boolean;
  /** Compiler errors of the final (broken) source, shown to the user. */
  errorDiagnostics?: FormlDiagnostic[];
  /** Human-readable failure message. */
  errorMessage?: string;
  createdAt: number;
}

// Only the most recent messages travel VERBATIM in a request; anything older is
// compressed into a one-line summary (backend/schemas.py AiChatRequest).
const RECENT_MESSAGES = 6;

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** One-line summary of messages older than the verbatim window. */
function summarizeOlder(messages: AiChatMessage[], keep: number): string {
  const older = messages.slice(0, Math.max(0, messages.length - keep));
  if (older.length === 0) return "";
  const tail = older
    .slice(-8)
    .map((m) => `${m.role === "user" ? "U" : "A"}: ${m.text.slice(0, 60).replace(/\s+/g, " ")}`)
    .join(" | ");
  return `${older.length} earlier message(s) — ${tail}`;
}

function describeFailure(outcome: RepairOutcome): string {
  if (outcome.failureReason === "unparseable") {
    return "The AI returned a reply that isn't the required JSON shape, even after a retry. Try rephrasing your request.";
  }
  if (outcome.failureReason === "compile_failed") {
    const errorList = outcome.finalErrors
      .map((d) => `line ${d.line}, col ${d.col}: ${d.message}`)
      .join("; ");
    return `The generated Forml still doesn't compile after ${outcome.attempts - 1} fix${outcome.attempts - 1 === 1 ? "" : "es"}. Nothing was applied. ${errorList}`;
  }
  return "The AI turn didn't complete. Try again.";
}

export function useAiChat(
  formId: string | null,
  getContext: () => AiContext,
  compile: (src: string) => FormlCompileResult,
) {
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  // Refs let async callbacks read current values without re-creating themselves.
  const getContextRef = useRef(getContext);
  useEffect(() => { getContextRef.current = getContext; });
  const compileRef = useRef(compile);
  useEffect(() => { compileRef.current = compile; });
  const formIdRef = useRef(formId);
  useEffect(() => { formIdRef.current = formId; });

  const messagesRef = useRef<AiChatMessage[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Abort controller for the in-flight stream (stop button / form switch /
  // unmount).
  const abortRef = useRef<AbortController | null>(null);
  const isStreamingRef = useRef(false);
  useEffect(() => { isStreamingRef.current = isStreaming; });

  // An unapplied AI revision becomes the baseline for the next message until
  // the user edits the editor directly.
  const draftSourceRef = useRef<string | null>(null);
  const editorSourceRef = useRef<string | null>(null);

  const stopInFlight = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  // Switching forms: drop any in-flight turn and load that form's server history.
  useEffect(() => {
    let cancelled = false;
    stopInFlight();
    setMessages([]);
    draftSourceRef.current = null;
    editorSourceRef.current = null;
    if (!formId) return;
    getAiHistory(formId)
      .then((records) => {
        if (cancelled) return;
        setMessages(
          records.map((r) => ({
            id: r.id,
            role: r.role,
            text: r.content,
            formlCode: r.revised_source ?? undefined,
            createdAt: new Date(r.created_at).getTime() || Date.now(),
          })),
        );
      })
      .catch(() => { /* server history unavailable — start with an empty chat */ });
    return () => { cancelled = true; };
  }, [formId, stopInFlight]);

  useEffect(() => () => stopInFlight(), [stopInFlight]);

  const send = useCallback((rawText: string) => {
    const text = rawText.trim();
    if (!text || isStreamingRef.current || !formIdRef.current) return;

    const liveContext = getContextRef.current();
    // A manual editor change clears the unapplied-draft baseline (the draft
    // only survives when the editor still matches what the AI last produced).
    if (editorSourceRef.current !== liveContext.source) {
      draftSourceRef.current = null;
      editorSourceRef.current = liveContext.source;
    }
    const baseline = draftSourceRef.current ?? liveContext.source;

    // Recent messages for the request come from BEFORE this turn — the backend
    // builds the current turn from user_message itself.
    const prior = messagesRef.current;
    const recent: AiHistoryMessageInput[] = prior.slice(-RECENT_MESSAGES).map((m) => ({
      role: m.role,
      content: m.text,
      forml_code: m.role === "assistant" ? (m.formlCode ?? null) : null,
    }));
    const historySummary = summarizeOlder(prior, RECENT_MESSAGES);

    const userMsgId = makeId("u");
    const assistantMsgId = makeId("a");
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", text, createdAt: Date.now() },
      { id: assistantMsgId, role: "assistant", text: "", baseline, streaming: true, createdAt: Date.now() },
    ]);
    isStreamingRef.current = true;
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const updateText = (delta: string) => {
      setMessages((prev) => prev.map((m) => (m.id === assistantMsgId ? { ...m, text: m.text + delta } : m)));
    };

    (async () => {
      const formIdNow = formIdRef.current!;
      try {
        const outcome = await runRepairLoop({
          formId: formIdNow,
          userMessage: text,
          source: baseline,
          diagnostics: liveContext.diagnostics,
          selection: liveContext.selection ?? "",
          recentMessages: recent,
          historySummary,
          compile: compileRef.current,
          streamTurn: (payload, onEvent, signal) =>
            chatAiStream(formIdNow, payload, onEvent, signal),
          onDelta: updateText,
          signal: controller.signal,
        });

        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantMsgId) return m;
            const next: AiChatMessage = { ...m, text: outcome.explanation, streaming: false };
            // Only conversational turns / no-edit replies carry no code block;
            // an edit attaches the revised source (baseline drives the diff).
            if (outcome.revisedSource !== null && outcome.changed) {
              next.formlCode = outcome.revisedSource;
            }
            if (outcome.appliedSource !== null) {
              // Keep the AI's latest clean revision as the baseline for the
              // next turn ("now add a phone field") even before Apply.
              draftSourceRef.current = outcome.appliedSource;
            }
            if (!outcome.ok) {
              next.failed = true;
              next.errorDiagnostics = outcome.finalErrors;
              next.errorMessage = describeFailure(outcome);
              draftSourceRef.current = null;
            }
            return next;
          }),
        );

        // Persist the resolved turn server-side (survives reloads). Only store
        // a revised_source for turns that produced source.
        if (outcome.explanation || outcome.revisedSource !== null) {
          void appendAiMessage(formIdNow, {
            user_message: text,
            assistant_message: outcome.explanation,
            revised_source: outcome.appliedSource ?? (outcome.ok ? outcome.revisedSource : null),
          }).catch(() => { /* history persistence is best-effort */ });
        }
      } catch (err) {
        const reason = err instanceof AiTurnError ? err.reason : "http";
        const message = err instanceof Error ? err.message : "Something went wrong.";
        const isAbort = reason === "http" && message.toLowerCase().includes("cancelled");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  streaming: false,
                  ...(isAbort && m.text ? {} : { failed: true, errorMessage: isAbort ? "Stopped." : message }),
                }
              : m,
          ),
        );
      } finally {
        isStreamingRef.current = false;
        setIsStreaming(false);
        abortRef.current = null;
      }
    })();
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    isStreamingRef.current = false;
    setIsStreaming(false);
    setMessages((prev) =>
      prev.map((m) => {
        if (!m.streaming) return m;
        // A stopped turn keeps whatever text streamed but shows why it stopped.
        const next: AiChatMessage = { ...m, streaming: false };
        if (!m.formlCode && !m.text) {
          next.failed = true;
          next.errorMessage = "Stopped.";
        }
        return next;
      }),
    );
  }, []);

  const clear = useCallback(() => {
    stopInFlight();
    setMessages([]);
    draftSourceRef.current = null;
    if (formIdRef.current) {
      void clearAiHistory(formIdRef.current).catch(() => {});
    }
  }, [stopInFlight]);

  return { messages, isStreaming, send, stop, clear };
}
