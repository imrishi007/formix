// hooks/use-ai-chat.ts
//
// React state for the Formix AI panel: message history (persisted to
// localStorage per form so it survives reloads), streaming lifecycle, and
// the send / quick-action / stop / clear actions the panel calls.
//
// Talks to the assistant only through lib/ai-engine.ts's `runAssistant` +
// `streamReply` — swapping the mock engine for a real backend later
// requires no change here.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { detectIntent, runAssistant, streamReply, type AiContext, type AiIntent } from "@/lib/ai-engine";

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

export function useAiChat(formId: string | null, getContext: () => AiContext) {
  const [messages, setMessages] = useState<AiChatMessage[]>(() => loadHistory(formId));
  const [isStreaming, setIsStreaming] = useState(false);
  const cancelRef = useRef<() => void>(() => {});
  const getContextRef = useRef(getContext);
  getContextRef.current = getContext;

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

  const pushAssistantAndStream = useCallback((result: { reply: string; formlCode?: string; applyLabel?: string }) => {
    const id = makeId("a");
    setMessages((prev) => [
      ...prev,
      // formlCode starts undefined even when the result has one — the code
      // panel only appears once its own stream phase begins, right after the
      // reply text finishes, so the FormL reveals progressively like the
      // prose does instead of dumping in fully formed.
      { id, role: "assistant", text: "", formlCode: undefined, applyLabel: result.applyLabel, streaming: true, createdAt: Date.now() },
    ]);
    setIsStreaming(true);

    const finish = () => {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, streaming: false } : m)));
      setIsStreaming(false);
    };

    const streamCode = () => {
      if (!result.formlCode) { finish(); return; }
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, formlCode: "" } : m)));
      cancelRef.current = streamReply(
        result.formlCode,
        (soFar) => setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, formlCode: soFar } : m))),
        finish,
      );
    };

    cancelRef.current = streamReply(
      result.reply,
      (soFar) => setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: soFar } : m))),
      streamCode,
    );
  }, []);

  const run = useCallback((intent: AiIntent, userText: string | null) => {
    if (userText !== null) {
      setMessages((prev) => [...prev, { id: makeId("u"), role: "user", text: userText, createdAt: Date.now() }]);
    }
    const result = runAssistant(intent, userText ?? "", getContextRef.current());
    pushAssistantAndStream(result);
  }, [pushAssistantAndStream]);

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
