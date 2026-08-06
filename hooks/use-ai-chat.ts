// hooks/use-ai-chat.ts
//
// Hybrid Formix AI panel state. Every turn is LLM-backed: the request streams
// through the Formix backend (backend/routers/ai.py), which routes to Groq
// (GROQ_API_KEY / AI_PROVIDER_PRIORITY) and pushes explanation deltas plus a
// revised .forml source over SSE (lib/api.ts `chatAiStream`). The backend owns
// the grammar, the retry/failover chain, and the strict JSON parsing.
//
// The LLM's output is made TRUSTWORTHY by the compile-and-repair loop
// (lib/ai-loop.ts `runRepairLoop`): the revised source is run through the
// same WASM compiler the editor uses; if it fails to compile, the exact
// diagnostics are sent back for up to two repair turns before anything is
// shown. The panel never displays source that hasn't at least been repaired
// against the real grammar.
//
// The deterministic rule-based engine (lib/ai-engine.ts `runAssistant` +
// `streamReply`) is kept as the FALLBACK: if the backend is unreachable,
// unconfigured, or errors before producing any output, the turn resolves
// locally instead of leaving the panel stuck on "generating…". The panel's
// UX (streaming prose, progressive code reveal, Apply button) is identical
// on both paths, so swapping the LLM for the engine is invisible to the UI.
//
// History stays in localStorage (as in the pre-LLM panel), and the last few
// messages are threaded into each request so the model is grounded in the
// conversation.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { detectIntent, runAssistant, streamReply, type AiContext, type AiIntent } from "@/lib/ai-engine";
import { chatAiStream, type AiHistoryMessageInput } from "@/lib/api";
import { runRepairLoop, type RepairOutcome } from "@/lib/ai-loop";
import type { FormlCompileResult } from "@/lib/use-forml-compiler";

export interface AiChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  formlCode?: string;
  applyLabel?: string;
  streaming?: boolean;
  createdAt: number;
}

const HISTORY_LIMIT = 60;
const RECENT_MESSAGES = 6;

function storageKey(formId: string): string {
  return `formix.ai.chat.${formId}`;
}

function loadHistory(formId: string | null): AiChatMessage[] {
  if (!formId || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(formId));
    return raw ? (JSON.parse(raw) as AiChatMessage[]) : [];
  } catch {
    return [];
  }
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useAiChat(
  formId: string | null,
  getContext: () => AiContext,
  compile: (src: string) => FormlCompileResult,
) {
  const [messages, setMessages] = useState<AiChatMessage[]>(() => loadHistory(formId));
  const [isStreaming, setIsStreaming] = useState(false);
  const cancelRef = useRef<() => void>(() => {});
  const getContextRef = useRef(getContext);
  getContextRef.current = getContext;

  // Refs mirroring state so the async turn closures read the freshest values
  // without re-creating the callbacks on every render.
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const formIdRef = useRef(formId);
  formIdRef.current = formId;
  const compileRef = useRef(compile);
  compileRef.current = compile;
  const abortRef = useRef<AbortController | null>(null);

  // Switching forms: stop any in-flight stream and load that form's history.
  useEffect(() => {
    cancelRef.current();
    setIsStreaming(false);
    setMessages(loadHistory(formId));
  }, [formId]);

  // Persist on every change.
  useEffect(() => {
    if (!formId) return;
    try {
      window.localStorage.setItem(storageKey(formId), JSON.stringify(messages.slice(-HISTORY_LIMIT)));
    } catch {
      /* localStorage unavailable (private mode, quota) — history just won't persist */
    }
  }, [messages, formId]);

  useEffect(() => () => cancelRef.current(), []);

  // ── Shared message finalisers ───────────────────────────────────────────────

  const finishMessage = useCallback((id: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, streaming: false } : m)));
    setIsStreaming(false);
    abortRef.current = null;
  }, []);

  /** Reveal a full .forml source progressively, exactly like the old engine's
   *  text streaming — the code panel appears as soon as formlCode becomes ""
   *  and fills in token by token (lib/ai-engine.ts `streamReply`). */
  const streamCode = useCallback((id: string, code: string, applyLabel: string, onDone: () => void) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, formlCode: "", applyLabel } : m)));
    cancelRef.current = streamReply(
      code,
      (soFar) => setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, formlCode: soFar } : m))),
      onDone,
    );
  }, []);

  // ── Deterministic fallback path ─────────────────────────────────────────────
  // Used whenever the LLM path can't run at all (no backend, no Groq key,
  // transport failure before any output). It can never hang — the whole
  // reply + code is computed synchronously and only the reveal is animated.

  const runFallback = useCallback((id: string, intent: AiIntent, userText: string, context: AiContext) => {
    const result = runAssistant(intent, userText, context);
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, applyLabel: result.applyLabel } : m)));
    cancelRef.current = streamReply(
      result.reply,
      (soFar) => setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: soFar } : m))),
      () => {
        if (result.formlCode) {
          streamCode(id, result.formlCode, result.applyLabel ?? "Insert into Editor", () => finishMessage(id));
        } else {
          finishMessage(id);
        }
      },
    );
  }, [finishMessage, streamCode]);

  // ── LLM path: backend → Groq over SSE, then compile-and-repair ─────────────
  // Returns true when the turn was handled (or intentionally aborted by the
  // user), false when the caller should fall back to runFallback.

  const runLLM = useCallback(async (id: string, userText: string, context: AiContext): Promise<boolean> => {
    const formIdNow = formIdRef.current;
    if (!formIdNow) return false; // no form → deterministic engine only

    const controller = new AbortController();
    abortRef.current = controller;
    // Stop button and form-switch both abort the in-flight fetch.
    cancelRef.current = () => controller.abort();

    // Thread the recent conversation VERBATIM so follow-up turns ("now add a
    // phone field") are grounded in the exact source the assistant stood on.
    const recentMessages: AiHistoryMessageInput[] = messagesRef.current
      .slice(-RECENT_MESSAGES)
      .map((m) => ({ role: m.role, content: m.text, forml_code: m.formlCode ?? null }));

    let streamedText = "";
    let outcome: RepairOutcome | null = null;

    try {
      outcome = await runRepairLoop({
        formId: formIdNow,
        userMessage: userText,
        source: context.source,
        diagnostics: context.diagnostics,
        selection: context.selection ?? "",
        recentMessages,
        historySummary: "",
        compile: compileRef.current,
        streamTurn: (payload, onEvent, signal) => chatAiStream(formIdNow, payload, onEvent, signal),
        onDelta: (t) => {
          streamedText += t;
          setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: m.text + t } : m)));
        },
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.signal.aborted) {
        finishMessage(id); // user pressed Stop — keep whatever streamed
        return true;
      }
      if (streamedText.length === 0) {
        // Nothing on screen yet (backend down / unconfigured / failed) — let
        // the caller produce the deterministic reply so the turn still lands.
        return false;
      }
      // Partial prose already streamed; don't duplicate it with a fallback.
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, text: m.text + "\n\n_(AI provider error — showing partial response)_" } : m)),
      );
      finishMessage(id);
      return true;
    }

    if (outcome === null) {
      // Defensive: the loop always returns an outcome, never null.
      return false;
    }

    // The model produced (or edited) source — reveal it. This covers clean
    // edits AND the "repaired until it still won't compile" case: the user
    // sees the best attempt with a note, and the diagnostics panel shows the
    // exact errors. Text is whatever already streamed — the loop's explanation
    // on a repaired turn is just the LAST attempt's prose, so don't clobber.
    if (outcome.revisedSource !== null && outcome.changed) {
      if (!outcome.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id
              ? { ...m, text: m.text + "\n\n_⚠ The generated code did not compile cleanly. Review it below — the diagnostics panel lists the errors._" }
              : m,
          ),
        );
      }
      streamCode(id, outcome.revisedSource, "Insert into Editor", () => finishMessage(id));
      return true;
    }

    // Conversational turn (or the model echoed the source unchanged) — the
    // explanation IS the answer; backfill any streamed text with the full
    // explanation so nothing is lost.
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: outcome.explanation } : m)));
    finishMessage(id);
    return true;
  }, [finishMessage, streamCode]);

  const run = useCallback((intent: AiIntent, userText: string | null) => {
    if (userText !== null) {
      setMessages((prev) => [...prev, { id: makeId("u"), role: "user", text: userText, createdAt: Date.now() }]);
    }

    const id = makeId("a");
    // formlCode starts undefined — the code panel only appears once its own
    // reveal phase begins, so Forml shows progressively like the prose does.
    setMessages((prev) => [
      ...prev,
      { id, role: "assistant", text: "", formlCode: undefined, streaming: true, createdAt: Date.now() },
    ]);
    setIsStreaming(true);

    const context = getContextRef.current();
    const text = userText ?? "";

    void (async () => {
      try {
        const handled = await runLLM(id, text, context);
        if (!handled) runFallback(id, intent, text, context);
      } catch {
        // Any unexpected exception still resolves locally — never hang.
        runFallback(id, intent, text, context);
      }
    })();
  }, [runLLM, runFallback]);

  const send = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;
    run(detectIntent(trimmed), trimmed);
  }, [run, isStreaming]);

  const runQuickAction = useCallback((intent: AiIntent, userFacingPrompt: string) => {
    if (isStreaming) return;
    run(intent, userFacingPrompt);
  }, [run, isStreaming]);

  const stop = useCallback(() => {
    cancelRef.current();
    setIsStreaming(false);
    setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)));
  }, []);

  const clear = useCallback(() => {
    cancelRef.current();
    setIsStreaming(false);
    setMessages([]);
    if (formId) {
      try {
        window.localStorage.removeItem(storageKey(formId));
      } catch {
        /* ignore */
      }
    }
  }, [formId]);

  return { messages, isStreaming, send, runQuickAction, stop, clear };
}
