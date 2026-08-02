// lib/ai-loop.ts
//
// The compile-and-repair loop that makes the LLM-backed Formix AI *trustworthy*:
//
//   1. Send the user's turn to the backend (which streams the explanation).
//   2. If the reply is conversational (`revised_source: null` — a question,
//      doubt, or explanation), there is nothing to compile: it's a normal
//      chat turn and the loop finishes successfully.
//   3. When an edit comes back, compile its revisedSource with the client's
//      WASM compiler.
//   4. If it compiles clean → done: the revised source is safe to apply.
//   5. If it doesn't → send a repair turn back carrying the EXACT compiler
//      diagnostics (repair_context), so the model fixes rather than guesses.
//      At most MAX_REPAIR_ATTEMPTS repairs.
//   6. If it still won't compile after the repairs → report failure with the
//      final broken source and its errors. Never apply, never silently loop.
//
// The loop is deliberately pure-ish: `compile` and `streamTurn` are injected,
// so unit tests can exercise the whole repair choreography with fakes (no WASM,
// no network).

import type { AiChatEvent, AiChatRequestPayload, AiHistoryMessageInput } from "@/lib/api";
import type { FormlCompileResult, FormlDiagnostic } from "@/lib/use-forml-compiler";

export const MAX_REPAIR_ATTEMPTS = 2;

export interface RepairLoopInput {
  formId: string;
  /** The user's raw message for this turn. */
  userMessage: string;
  /** The editor source the model is asked to edit (the diff baseline). */
  source: string;
  /** Diagnostics from the last compile of the editor source. */
  diagnostics: FormlDiagnostic[];
  /** The currently selected code range, if any. */
  selection: string;
  /** Last ~6 conversation messages, verbatim. */
  recentMessages: AiHistoryMessageInput[];
  /** One-line summary of anything older than recentMessages. */
  historySummary: string;
  /** Synchronous WASM compiler (lib/use-forml-compiler.ts). */
  compile: (src: string) => FormlCompileResult;
  /** Streams one LLM turn via chatAiStream, forwarding parsed SSE events. */
  streamTurn: (
    payload: AiChatRequestPayload,
    onEvent: (evt: AiChatEvent) => void,
    signal?: AbortSignal,
  ) => Promise<void>;
  /** Called with every streamed explanation delta so the UI can reveal text live. */
  onDelta?: (text: string) => void;
  /** Optional abort signal; aborting mid-turn throws ApiError("Cancelled"). */
  signal?: AbortSignal;
}

export type RepairFailureReason = "unparseable" | "compile_failed" | "http" | "aborted";

export interface RepairOutcome {
  /** True when the final source compiles clean OR the model made no change
   *  (including a purely conversational reply). */
  ok: boolean;
  /** True when the model actually modified the source (a diff exists). False
   *  for conversational turns and "no change needed" replies. */
  changed: boolean;
  /** The final (or failed) source; null when the turn was conversational or
   *  the LLM reply was unparseable. */
  revisedSource: string | null;
  /** The source that passed compile; null when there was no edit or the final
   *  attempt failed. */
  appliedSource: string | null;
  /** Number of LLM turns performed (1 initial + repairs). */
  attempts: number;
  /** How the turn ended up without an applied source. */
  failureReason?: RepairFailureReason;
  /** Compiler errors of the final failed attempt. */
  finalErrors: FormlDiagnostic[];
  /** The full explanation (initial + any repair commentary). */
  explanation: string;
}

/**
 * A class so the hook can distinguish "network/config failure — show the
 * raw message" from "the LLM reply was malformed — same handling on the
 * panel, but the distinction matters for diagnostics".
 */
export class AiTurnError extends Error {
  constructor(public readonly reason: RepairFailureReason, message: string) {
    super(message);
    this.name = "AiTurnError";
  }
}

async function sendTurn(
  payload: AiChatRequestPayload,
  input: RepairLoopInput,
  onDeltaText: (t: string) => void,
): Promise<{ explanation: string; revisedSource: string | null } | null> {
  let explanation = "";
  let revised: string | null = null;
  let gotResult = false;
  let errorMessage: string | null = null;

  await input.streamTurn(
    payload,
    (evt) => {
      if (evt.type === "delta") {
        explanation += evt.text;
        onDeltaText(evt.text);
      } else if (evt.type === "result") {
        explanation = evt.explanation;
        revised = evt.revised_source; // null = conversational turn
        gotResult = true;
      } else if (evt.type === "error") {
        errorMessage = evt.message;
      }
    },
    input.signal,
  );

  if (errorMessage) throw new AiTurnError("http", errorMessage);
  // No result event at all → the reply never satisfied the response contract.
  if (!gotResult) return null;
  return { explanation, revisedSource: revised };
}

export async function runRepairLoop(input: RepairLoopInput): Promise<RepairOutcome> {
  const onDelta = (t: string) => input.onDelta?.(t);
  let attempts = 0;

  // ── Initial turn ────────────────────────────────────────────────────────────
  const turn = await sendTurn(
    {
      form_id: input.formId,
      user_message: input.userMessage,
      source: input.source,
      diagnostics: input.diagnostics,
      selection: input.selection,
      recent_messages: input.recentMessages,
      history_summary: input.historySummary,
    },
    input,
    onDelta,
  );

  if (turn === null) {
    return {
      ok: false, changed: false, revisedSource: null, appliedSource: null,
      attempts: 1, failureReason: "unparseable", finalErrors: [], explanation: "",
    };
  }
  attempts = 1;

  // Model only chatted (question / doubt / explanation) → nothing to compile
  // or apply. This is a normal, successful conversational turn.
  if (turn.revisedSource === null) {
    return {
      ok: true, changed: false, revisedSource: null, appliedSource: null,
      attempts, finalErrors: [],
      explanation: turn.explanation,
    };
  }

  // Model answered but echoed the source back unchanged → nothing to apply.
  if (turn.revisedSource === input.source) {
    return {
      ok: true, changed: false, revisedSource: turn.revisedSource,
      appliedSource: turn.revisedSource, attempts, finalErrors: [],
      explanation: turn.explanation,
    };
  }

  let currentSource = turn.revisedSource;
  const result = input.compile(currentSource);
  let finalErrors = result.diagnostics.filter((d) => d.severity === "error");

  // ── Repair loop ─────────────────────────────────────────────────────────────
  let repairs = 0;
  while (finalErrors.length > 0 && repairs < MAX_REPAIR_ATTEMPTS) {
    repairs++;
    attempts++;

    const repair = await sendTurn(
      {
        form_id: input.formId,
        user_message: input.userMessage, // unused on repair turns — backend builds its own prompt
        source: currentSource,           // the model's own (broken) output
        diagnostics: [],                 // the errors travel in repair_context.errors
        selection: "",
        recent_messages: [],
        history_summary: "",
        repair_context: { attempt: repairs, errors: finalErrors },
      },
      input,
      onDelta,
    );

    if (repair === null || repair.revisedSource === null) {
      // The backend treats a source-less reply on a repair turn as a shape
      // failure (it errors rather than emits a result), but defend anyway:
      // never let a conversational reply to a fix request stand as the result.
      return {
        ok: false, changed: true, revisedSource: currentSource, appliedSource: null,
        attempts, failureReason: "unparseable", finalErrors,
        explanation: turn.explanation,
      };
    }
    turn.explanation = repair.explanation;
    currentSource = repair.revisedSource;

    const check = input.compile(currentSource);
    finalErrors = check.diagnostics.filter((d) => d.severity === "error");
  }

  const compiled = finalErrors.length === 0;
  return {
    ok: compiled,
    changed: true,
    revisedSource: currentSource,
    appliedSource: compiled ? currentSource : null,
    attempts,
    failureReason: compiled ? undefined : "compile_failed",
    finalErrors,
    explanation: turn.explanation,
  };
}
